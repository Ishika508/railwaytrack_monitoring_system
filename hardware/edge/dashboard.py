#!/usr/bin/env python3
# ITMS train ride monitor: ISM330DHCX IMU (I2C) + Radxa Camera 4K -> ILI9341 TFT (SPI1)
# on Radxa Cubie A7A. One screen: live camera (with detection boxes) + ride metrics side by side.
#   Run:            sudo python3 dashboard.py
#   Terminal only:  sudo python3 dashboard.py --print     (no screen, prints metrics)
#   Recalibrate:    sudo pkill -USR1 -f dashboard.py      (train/IMU must be still)
#   Camera on/off:  sudo pkill -USR2 -f dashboard.py      (saves CPU when off)
#   Needs camera_feed.py in the same folder for the camera picture, and
#   detector.py + own_track_head.onnx for the bounding boxes.
import math
import os
import signal
import socket
import struct
import sys
import textwrap
import threading
import time
from collections import deque

import gpiod
import numpy as np
import spidev
from PIL import Image, ImageDraw, ImageFont

try:
    from smbus2 import SMBus
except ImportError:
    from smbus import SMBus

try:
    from camera_feed import CameraFeed
except ImportError:
    CameraFeed = None

try:
    from detector import Detector            # CPU (onnxruntime) detector, used as the fallback
except ImportError:
    Detector = None

try:
    from npu_detector import NpuDetector     # NPU detector (npu_runner + .nb), preferred
except ImportError:
    NpuDetector = None

try:
    from itms_link import Link               # LoRa alert link (Wi-Fi UDP -> Heltec -> 433 MHz)
except ImportError:
    Link = None

# =========================== SETTINGS ===========================
# --- IMU (I2C) ---
I2C_BUS = 7          # /dev/i2c-7 (confirmed)
IMU_ADDR = 0x6B      # confirmed with i2cdetect (WHO_AM_I = 0x6B)
RATE = 100           # processing rate in Hz (IMU itself runs at 416 Hz)
CAL_SECONDS = 3      # time to hold still at start for zeroing

# Which IMU axis points where. (axis index 0=X 1=Y 2=Z, sign +1/-1)
# Forward sign decides which way is "accelerating". Flip it if ACCEL/BRAKE are reversed.
AXES = {
    # From the photo: connector end points DOWN, so IMU X runs up/down in the photo
    # (wobble axis) and IMU Y runs left/right (accel/brake axis, forward = LEFT).
    "forward":  (1, -1),   # IMU Y, reversed: arrow in the photo points left
    "lateral":  (0, +1),   # IMU X: wobble / side-to-side
    "vertical": (2, +1),   # IMU Z: up/down
}

# Alert thresholds (warn, alert) based on Indian Railways / RDSO figures.
# Status turns WARN at the first value and ALERT at the second.
MOUNT = "coach"            # "coach" (IMU on coach floor) or "loco" (loco cab floor)
#   Vertical / lateral peak acceleration [g]  (IRPWM Ch.VI threshold: 0.15 g coach floor,
#   0.20 g loco cab floor; RDSO OMS-2000 peak limit 0.30 g preferable / 0.35 g limiting)
G_WARN = {"coach": 0.15, "loco": 0.20}[MOUNT]
TH = {
    "vert":  (3.00, 6.00),   # vertical peak over 3 s             [g]
    "lat":   (1.20, 2.40),   # lateral peak over 3 s              [g]
    #   Longitudinal: RDSO EMU spec starting accel 0.54, service braking 0.76-0.84 m/s2,
    #   jerk limit 1.0 m/s3; Vande Bharat accel/decel 0.8 m/s2, jerk 0.7 m/s3,
    #   full-service braking up to 1.05 and emergency 1.15 m/s2.
    "accel": (0.85, 1.15),     # forward acceleration               [m/s2]
    "brake": (0.85, 1.05),     # deceleration magnitude             [m/s2]
    "jerk":  (4.20, 6.00),       # peak |jerk| over last 3 s          [m/s3]
    #   Roll rate has NO published IR limit - this one is your own setting.
    "roll":  (30.00, 60.00),       # roll rate, RMS over 2 s            [deg/s]
}
STEADY_BAND = 0.15         # |accel| below this shows STEADY    [m/s2]
HP_TAU = 0.3               # high-pass time constant [s]: ignores slow changes (braking, curves)

# --- TFT (same wiring as test.py) ---
CHIP_PATH = "/dev/gpiochip0"
DC_LINE = 312      # PJ24 (header pin 16)
RST_LINE = 313     # PJ25 (header pin 18)
SPI_BUS, SPI_DEV = 1, 0
SPI_SPEED = 32_000_000
MADCTL = 0xE8      # 0x28 landscape, 0xE8 landscape flipped
INVERT = False
W, H = 320, 240
REFRESH_SECONDS = 0.25

# --- Live camera (Radxa Camera 4K) ---
CAM_ENABLED = True        # start with the camera on (toggle with SIGUSR2)
CAM_DEVICE = "/dev/video0"
CAM_ROTATE = 0
                          # 0/180 -> wide picture, 90/270 -> tall strip layout
CAM_FPS = 25
CAM_REFRESH_SECONDS = 0.05

# --- Object detection (boxes drawn on the camera picture) ---
DET_ENABLED = True
USE_NPU = True              # NPU detector first; falls back to the CPU one if it cannot start
DET_CONF = 0.4             # minimum confidence to show a box
DET_NAMES = ["Rail_Gap", "Severe_Crack", "Severe_Gap", "Sleeper_Crack", "Sleeper_weak"]
# Size the camera captures at when detection is on (the TFT box is scaled down from it).
DET_CAPTURE = (360, 640) if CAM_ROTATE in (90, 270) else (640, 360)

# --- Real-time clock ---
USE_RTC = True                                   # read the Radxa's hardware RTC directly
RTC_PATH = "/sys/class/rtc/rtc0/since_epoch"     # falls back to system time if missing
# ================================================================

G = 9.80665
ACC_SCALE = 0.000122 * G   # +-4 g range, m/s2 per LSB
GYR_SCALE = 0.0175         # +-500 dps range, deg/s per LSB


# ------------------------------ TFT ------------------------------
class Pin:
    def __init__(self, offset, name):
        self.offset = offset
        if hasattr(gpiod, "request_lines"):  # libgpiod v2
            from gpiod.line import Direction, Value
            self._V = Value
            self.req = gpiod.request_lines(
                CHIP_PATH, consumer=name,
                config={offset: gpiod.LineSettings(direction=Direction.OUTPUT)})
            self.v2 = True
        else:  # libgpiod v1
            chip = gpiod.Chip(CHIP_PATH.replace("/dev/", ""))
            self.line = chip.get_line(offset)
            self.line.request(consumer=name, type=gpiod.LINE_REQ_DIR_OUT)
            self.v2 = False

    def set(self, v):
        if self.v2:
            self.req.set_value(self.offset, self._V.ACTIVE if v else self._V.INACTIVE)
        else:
            self.line.set_value(1 if v else 0)


class Display:
    def __init__(self):
        self.dc = Pin(DC_LINE, "tft-dc")
        self.rst = Pin(RST_LINE, "tft-rst")
        self.spi = spidev.SpiDev()
        self.spi.open(SPI_BUS, SPI_DEV)
        self.spi.max_speed_hz = SPI_SPEED
        self.spi.mode = 0
        self.rst.set(1); time.sleep(0.05)
        self.rst.set(0); time.sleep(0.05)
        self.rst.set(1); time.sleep(0.15)
        self.cmd(0x01); time.sleep(0.15)
        self.cmd(0x11); time.sleep(0.12)
        if INVERT:
            self.cmd(0x21)
        self.cmd(0x3A, [0x55])
        self.cmd(0x36, [MADCTL])
        self.cmd(0x29); time.sleep(0.05)

    def _write(self, data):
        if hasattr(self.spi, "writebytes2"):
            self.spi.writebytes2(data)
        else:
            data = list(data)
            for i in range(0, len(data), 4096):
                self.spi.writebytes(data[i:i + 4096])

    def cmd(self, c, data=()):
        self.dc.set(0)
        self.spi.writebytes([c])
        if len(data):
            self.dc.set(1)
            self._write(bytes(data))

    def show(self, img):
        a = np.asarray(img.convert("RGB"), dtype=np.uint16)
        rgb565 = ((a[..., 0] & 0xF8) << 8) | ((a[..., 1] & 0xFC) << 3) | (a[..., 2] >> 3)
        self.cmd(0x2A, [0, 0, (W - 1) >> 8, (W - 1) & 0xFF])
        self.cmd(0x2B, [0, 0, (H - 1) >> 8, (H - 1) & 0xFF])
        self.cmd(0x2C)
        self.dc.set(1)
        self._write(rgb565.astype(">u2").tobytes())


# ------------------------------ IMU ------------------------------
def pick(vec, key):
    idx, sign = AXES[key]
    return sign * vec[idx]


class Sampler(threading.Thread):
    """Reads the IMU, zeroes it, and stores filtered train-motion signals."""

    def __init__(self):
        super().__init__(daemon=True)
        self.lock = threading.Lock()
        self.buf = deque(maxlen=RATE * 60)   # last 60 s of rows
        self.state = "STARTING"              # STARTING / CALIBRATING / RUNNING / ERROR
        self.error = ""
        self.cal_started = 0.0
        self.recal = False
        self.block_ok = True

    def request_recalibrate(self):
        self.recal = True

    def snapshot(self):
        with self.lock:
            return self.state, self.error, self.cal_started, list(self.buf)

    def _setup(self, bus):
        who = bus.read_byte_data(IMU_ADDR, 0x0F)
        if who != 0x6B:
            raise IOError(f"WHO_AM_I=0x{who:02X}, expected 0x6B")
        bus.write_byte_data(IMU_ADDR, 0x12, 0x01)   # software reset
        time.sleep(0.05)
        bus.write_byte_data(IMU_ADDR, 0x12, 0x44)   # BDU on, auto-increment
        bus.write_byte_data(IMU_ADDR, 0x10, 0x68)   # accel 416 Hz, +-4 g
        bus.write_byte_data(IMU_ADDR, 0x11, 0x64)   # gyro 416 Hz, +-500 dps
        time.sleep(0.1)

    def _read(self, bus):
        if self.block_ok:
            try:
                raw = bus.read_i2c_block_data(IMU_ADDR, 0x22, 12)
            except OSError:
                self.block_ok = False   # this controller can't do block reads
                raw = [bus.read_byte_data(IMU_ADDR, 0x22 + i) for i in range(12)]
        else:
            raw = [bus.read_byte_data(IMU_ADDR, 0x22 + i) for i in range(12)]
        gx, gy, gz, ax, ay, az = struct.unpack("<6h", bytes(raw))
        return (np.array([ax, ay, az], dtype=float) * ACC_SCALE,
                np.array([gx, gy, gz], dtype=float) * GYR_SCALE)

    def run(self):
        while True:
            bus = None
            try:
                bus = SMBus(I2C_BUS)
                self._setup(bus)
                self._loop(bus)
            except Exception as e:  # keep trying if the IMU drops out
                with self.lock:
                    self.state = "ERROR"
                    self.error = f"{type(e).__name__}: {e}"[:44]
                if "--print" in sys.argv:
                    import traceback
                    traceback.print_exc()
                time.sleep(2)
            finally:
                if bus is not None:
                    try:
                        bus.close()
                    except Exception:
                        pass

    def _loop(self, bus):
        dt = 1.0 / RATE
        k_hp = dt / (HP_TAU + dt)   # high-pass: keeps vibration, removes slow motion
        k_s = dt / (0.3 + dt)       # smoothing for accel/brake (tau 0.3 s)
        self.recal = True           # always zero at start
        calibrating = False
        cal_a, cal_g = [], []
        off_a, off_g = np.zeros(3), np.zeros(3)
        lp_v = lp_l = lp_f = long_s = 0.0
        hist = deque(maxlen=int(0.5 * RATE) + 1)
        next_t = time.perf_counter()

        while True:
            next_t += dt
            a, g = self._read(bus)

            if self.recal:
                self.recal = False
                calibrating = True
                cal_a, cal_g = [], []
                t0 = time.time()
                with self.lock:
                    self.state = "CALIBRATING"
                    self.cal_started = t0
                    self.buf.clear()

            if calibrating:
                cal_a.append(a)
                cal_g.append(g)
                if time.time() - self.cal_started >= CAL_SECONDS:
                    off_a = np.mean(cal_a, axis=0)
                    off_g = np.mean(cal_g, axis=0)
                    lp_v = lp_l = lp_f = long_s = 0.0
                    hist.clear()
                    calibrating = False
                    with self.lock:
                        self.state = "RUNNING"
                        self.error = ""
            else:
                a = a - off_a
                g = g - off_g
                v = pick(a, "vertical")
                l = pick(a, "lateral")
                f = pick(a, "forward")
                roll = pick(g, "forward")          # rotation about the forward axis

                lp_v += k_hp * (v - lp_v)
                lp_l += k_hp * (l - lp_l)
                lp_f += k_hp * (f - lp_f)
                long_s += k_s * (f - long_s)
                hist.append(long_s)
                jerk = (long_s - hist[0]) / ((len(hist) - 1) * dt) if len(hist) > 1 else 0.0

                with self.lock:
                    self.buf.append((time.time(), v - lp_v, l - lp_l, long_s, jerk, roll, f - lp_f))

            delay = next_t - time.perf_counter()
            if delay > 0:
                time.sleep(delay)
            else:
                next_t = time.perf_counter()


def rms(x):
    return float(math.sqrt(np.mean(np.square(x)))) if len(x) else 0.0


def level(value, warn_alert):
    warn, alert = warn_alert
    return 2 if value >= alert else 1 if value >= warn else 0


def compute(rows):
    """Turn the last 60 s of rows into the dashboard metrics."""
    if len(rows) < RATE:
        return None
    arr = np.array(rows)
    t = arr[:, 0]
    now = t[-1]
    w2 = arr[t > now - 2.0]
    w3 = arr[t > now - 3.0]
    return {
        "vert": float(np.max(np.abs(w3[:, 1]))) / G,
        "lat": float(np.max(np.abs(w3[:, 2]))) / G,
        "roll": rms(w2[:, 5]),
        "long": float(arr[-1, 3]),
        "jerk": float(np.max(np.abs(w3[:, 4]))),
        "peak_brake": float(min(0.0, np.min(arr[:, 3]))),
    }


# ----------------------------- Drawing ----------------------------
def load_font(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    for base in ("/usr/share/fonts/truetype/dejavu/", "/usr/share/fonts/dejavu/"):
        try:
            return ImageFont.truetype(base + name, size)
        except OSError:
            pass
    return ImageFont.load_default()


F_TITLE = load_font(16, True)
F_VAL = load_font(22, True)
F_CLOCK = load_font(15, True)
F_CHIP = load_font(11, True)
F_LABEL = load_font(11)
F_BIG = load_font(18, True)

BG = (236, 241, 247)
PANEL = (255, 255, 255)
BORDER = (208, 217, 229)
TEXT = (20, 30, 48)
MUTED = (98, 112, 135)
LEVEL_COL = {0: (22, 163, 74), 1: (217, 119, 6), 2: (220, 38, 38)}
LEVEL_TXT = {0: "OK", 1: "WARN", 2: "ALERT"}
BLUE = (37, 99, 235)

TOP, BOT = 32, H - 24            # body area between the header and the footer
CAM_TALL = CAM_ROTATE in (90, 270)
# Camera box: x, y, w, h. Wide picture on top-left, or a tall strip on the left.
CAM_BOX = (4, TOP, 104, BOT - TOP) if CAM_TALL else (4, TOP, 192, 108)
METRICS_INTERVAL = 0.25          # recompute the 60 s statistics at most this often [s]
F_HUGE = load_font(30, True)


def tile_c(d, x, y, w, h, label, value, unit, status, lvl):
    """Compact metric tile. Adapts the unit and status chip to the space available."""
    col = (90, 100, 120) if value == "--" else LEVEL_COL[lvl]   # grey while there is no data
    d.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=7, fill=PANEL)
    d.rectangle([x, y + 7, x + 3, y + h - 8], fill=col)
    lw = d.textlength(label, font=F_LABEL)
    cw = d.textlength(status, font=F_CHIP)
    vw = d.textlength(value, font=F_VAL)
    uw = d.textlength(unit, font=F_LABEL)
    unit_inline = 10 + vw + 4 + uw + 6 <= w
    chip_top = unit_inline and (10 + lw + 8 + cw + 8 <= w or h < 52)
    d.text((x + 10, y + 3), label, font=F_LABEL, fill=MUTED)
    if chip_top:
        d.text((x + w - cw - 8, y + 3), status, font=F_CHIP, fill=col)
    else:
        d.text((x + 10, y + h - 15), status, font=F_CHIP, fill=col)
    vy = y + 16
    d.text((x + 10, vy), value, font=F_VAL, fill=col if lvl else TEXT)
    if unit_inline:
        d.text((x + 14 + vw, vy + 10), unit, font=F_LABEL, fill=MUTED)
    else:
        d.text((x + w - uw - 8, y + 3), unit, font=F_LABEL, fill=MUTED)


def accel_tile(d, x, y, w, h, acc, peak, note):
    """Large acceleration/braking tile with the 60 s peak-brake line underneath."""
    label, value, unit, status, lvl = acc
    col = (90, 100, 120) if value == "--" else LEVEL_COL[lvl]
    d.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=7, fill=PANEL)
    d.rectangle([x, y + 7, x + 3, y + h - 8], fill=col)
    d.text((x + 10, y + 4), label, font=F_LABEL, fill=MUTED)
    cw = d.textlength(status, font=F_CHIP)
    d.text((x + w - cw - 8, y + 4), status, font=F_CHIP, fill=col)
    d.text((x + 10, y + 15), value, font=F_HUGE, fill=col if lvl else TEXT)
    vw = d.textlength(value, font=F_HUGE)
    d.text((x + 14 + vw, y + 36), unit, font=F_LABEL, fill=MUTED)
    if note is not None:
        d.text((x + 10, y + h - 17), note, font=F_LABEL, fill=LEVEL_COL[1])
    else:
        _, pvalue, punit, _, plvl = peak
        d.text((x + 10, y + h - 17), "PEAK BRAKE 60 s", font=F_LABEL, fill=MUTED)
        txt = f"{pvalue} {punit}"
        tw = d.textlength(txt, font=F_LABEL)
        d.text((x + w - tw - 8, y + h - 17), txt, font=F_LABEL,
               fill=LEVEL_COL[plvl] if plvl else TEXT)


def build_tiles(m):
    """Return 6 tuples (label, value, unit, status, level):
    0 vertical, 1 lateral, 2 roll, 3 acc/dec, 4 jerk, 5 peak brake."""
    tiles = []

    lv = level(m["vert"], TH["vert"])
    tiles.append(("VERTICAL", f"{m['vert']:.2f}", "g", LEVEL_TXT[lv], lv))

    ls = level(m["lat"], TH["lat"])
    tiles.append(("LATERAL", f"{m['lat']:.2f}", "g", LEVEL_TXT[ls], ls))

    lr = level(m["roll"], TH["roll"])
    tiles.append(("ROLL", f"{m['roll']:.1f}", "\u00b0/s", LEVEL_TXT[lr], lr))

    f = m["long"]
    if f >= STEADY_BAND:
        la = level(f, TH["accel"])
        st = ("ACCEL", "HARSH ACC", "HARSH ACC")[la]
    elif f <= -STEADY_BAND:
        la = level(-f, TH["brake"])
        st = ("BRAKE", "HARSH BRK", "SUDDEN")[la]
    else:
        la, st = 0, "STEADY"
    tiles.append(("ACC/DEC", f"{f:+.2f}", "m/s\u00b2", st, la))

    lj = level(m["jerk"], TH["jerk"])
    tiles.append(("JERK", f"{m['jerk']:.2f}", "m/s\u00b3", LEVEL_TXT[lj], lj))

    pb = m["peak_brake"]
    lp = level(-pb, TH["brake"])
    tiles.append(("PK BRAKE", f"{pb:+.2f}", "m/s\u00b2", LEVEL_TXT[lp], lp))
    return tiles


def placeholder_tiles():
    base = [("VERTICAL", "g"), ("LATERAL", "g"), ("ROLL", "\u00b0/s"),
            ("ACC/DEC", "m/s\u00b2"), ("JERK", "m/s\u00b3"), ("PK BRAKE", "m/s\u00b2")]
    return [(name, "--", unit, "", 0) for name, unit in base]


def rtc_now():
    """Return (local struct_time, from_rtc). Reads the hardware RTC, else system time."""
    if USE_RTC:
        try:
            with open(RTC_PATH) as f:
                return time.localtime(int(f.read().strip())), True
        except (OSError, ValueError):
            pass
    return time.localtime(), False


def ip_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


_ip_cache = {"t": -100.0, "v": None}


def cached_ip():
    if time.time() - _ip_cache["t"] > 10:      # no need to look it up on every frame
        _ip_cache["v"] = ip_address()
        _ip_cache["t"] = time.time()
    return _ip_cache["v"]


_metrics_cache = {"t": 0.0, "val": None}


def snapshot_metrics(sampler):
    """(state, error, cal_started, metrics). The 60 s statistics are recomputed only
    every METRICS_INTERVAL seconds so the faster camera refresh stays cheap."""
    now = time.time()
    if _metrics_cache["val"] is None or now - _metrics_cache["t"] >= METRICS_INTERVAL:
        state, error, cal_started, rows = sampler.snapshot()
        metrics = compute(rows) if state == "RUNNING" else None
        _metrics_cache["val"] = (state, error, cal_started, metrics)
        _metrics_cache["t"] = now
    return _metrics_cache["val"]


def draw_camera(img, d, cam, cam_on, overall, det=None):
    x, y, w, h = CAM_BOX
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=(0, 0, 0))
    msg, warn = None, False
    if cam is None:
        msg = "No camera module (camera_feed.py missing)"
    elif not cam_on:
        msg = "CAMERA OFF"
    else:
        frame, age, err = cam.latest()
        if frame is not None and age < 3.0:
            # The camera may capture larger than the TFT box (for detection): scale to fit.
            s = min(w / frame.width, h / frame.height)
            dw, dh = int(frame.width * s), int(frame.height * s)
            shown = frame if s == 1 else frame.resize((dw, dh), Image.BILINEAR)
            ox, oy = x + (w - dw) // 2, y + (h - dh) // 2
            img.paste(shown, (ox, oy))
            if det is not None:
                dets, fsize, dage, dfps, dmax = det.latest()
                if det.error:                              # show why detection is failing
                    for i, line in enumerate(textwrap.wrap(det.error, max(8, (w - 8) // 6))[:6]):
                        d.text((x + 3, y + 2 + 12 * i), line, font=F_CHIP, fill=(255, 80, 80))
                elif dage < 2.5 and fsize == frame.size:   # only fresh boxes for this frame size
                    for (x1, y1, x2, y2), c, k in dets:
                        d.rectangle([ox + x1 * s, oy + y1 * s, ox + x2 * s, oy + y2 * s],
                                    outline=(0, 255, 0), width=1)
                        name = DET_NAMES[k] if k < len(DET_NAMES) else str(k)
                        d.text((ox + x1 * s + 2, oy + y1 * s), f"{name} {c:.0%}",
                               font=F_CHIP, fill=(0, 255, 0))
                    d.text((x + 3, y + h - 13), f"{len(dets)} det {dfps:.0f}fps max{dmax:.2f}",
                           font=F_CHIP, fill=(255, 255, 0))
                else:
                    d.text((x + 3, y + h - 13), "det: waiting", font=F_CHIP, fill=(255, 160, 0))
        elif err:
            msg, warn = err, True
        else:
            msg = "Starting camera..." if age > 1e8 else "No camera signal"
            warn = age < 1e8
    if msg:
        lines = textwrap.wrap(msg, max(8, (w - 16) // 7))[:5]
        for i, line in enumerate(lines):
            d.text((x + 8, y + h // 2 - 8 * len(lines) + 16 * i), line, font=F_LABEL,
                   fill=LEVEL_COL[1] if warn else MUTED)
    d.rectangle([x, y, x + w - 1, y + h - 1],
                outline=LEVEL_COL[2] if overall == 2 else (45, 56, 80))


# ===== PRO UI =====
import glob
import json
import urllib.request

HDR_H = 26
FOOT_H = 30
TOP = HDR_H + 4
BOT = H - FOOT_H - 2
CAM_TALL = False                       # wide layout only (CAM_ROTATE 0 or 180)
CAM_BOX = (4, TOP, 192, 108)
NAVY_A = (10, 26, 54)
NAVY_B = (33, 70, 135)
NAVY_TXT = (170, 190, 220)
SLATE = (15, 23, 42)
RED = (220, 38, 38)
WHITE = (255, 255, 255)
TRACK = (226, 232, 240)
DEFECT_HOLD = 1.5                      # keep the defect banner this long after the last box [s]
F_SMALL = load_font(10)
F_VAL2 = load_font(20, True)

_cache = {}
_temp_cache = {"t": -100.0, "v": None}


def header_bg():
    if "hdr" not in _cache:
        a = np.zeros((HDR_H, W, 3), dtype=np.uint8)
        for c in range(3):
            a[:, :, c] = np.linspace(NAVY_A[c], NAVY_B[c], W).astype(np.uint8)[None, :]
        _cache["hdr"] = Image.fromarray(a)
    return _cache["hdr"]


def round_mask(w, h, r):
    k = ("m", w, h, r)
    if k not in _cache:
        m = Image.new("L", (w, h), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
        _cache[k] = m
    return _cache[k]


def cpu_temp():
    if time.time() - _temp_cache["t"] > 2:
        best = None
        for path in glob.glob("/sys/class/thermal/thermal_zone*/temp"):
            try:
                v = float(open(path).read().strip())
                v = v / 1000.0 if v > 200 else v
                if 0 < v < 130 and (best is None or v > best):
                    best = v
            except (OSError, ValueError):
                pass
        _temp_cache["t"], _temp_cache["v"] = time.time(), best
    return _temp_cache["v"]


class Location(threading.Thread):
    """City-level location from the public IP (needs internet). Never blocks the UI."""
    URL = "http://ip-api.com/json/?fields=status,city,regionName,countryCode"

    def __init__(self):
        super().__init__(daemon=True)
        self.text = None

    def run(self):
        while True:
            try:
                with urllib.request.urlopen(self.URL, timeout=5) as r:
                    j = json.loads(r.read().decode())
                if j.get("status") == "success":
                    self.text = ", ".join(x for x in (j.get("city"), j.get("regionName") or j.get("countryCode")) if x)
                    time.sleep(900)
                    continue
            except Exception:
                pass
            time.sleep(30)


LOC = Location()


def temp_color(t):
    return LEVEL_COL[0] if t < 60 else LEVEL_COL[1] if t < 75 else LEVEL_COL[2]


def pill(d, right, y, text, col, h=18):
    w = int(d.textlength(text, font=F_CHIP)) + 18
    x = right - w
    d.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=h // 2, fill=col)
    d.text((x + 9, y + 2), text, font=F_CHIP, fill=WHITE)
    return x


def gauge(d, x, y, w, h, frac, col):
    d.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=h // 2, fill=TRACK)
    fw = int(w * max(0.0, min(1.0, frac)))
    if fw >= h:
        d.rounded_rectangle([x, y, x + fw - 1, y + h - 1], radius=h // 2, fill=col)
    elif fw > 0:
        d.rectangle([x, y, x + fw - 1, y + h - 1], fill=col)


def tile_m(d, x, y, w, h, label, value, unit, status, lvl, frac):
    col = (148, 163, 184) if value == "--" else LEVEL_COL[lvl]
    d.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=8, fill=PANEL, outline=BORDER)
    d.text((x + 9, y + 3), label, font=F_LABEL, fill=MUTED)
    if status:
        cw = d.textlength(status, font=F_CHIP)
        d.text((x + w - cw - 8, y + 3), status, font=F_CHIP, fill=col)
    d.text((x + 9, y + 13), value, font=F_VAL2, fill=col if lvl else TEXT)
    vw = d.textlength(value, font=F_VAL2)
    d.text((x + 13 + vw, y + 19), unit, font=F_LABEL, fill=MUTED)
    gauge(d, x + 9, y + h - 8, w - 18, 4, frac, col)


def acc_tile(d, x, y, w, h, acc, peak, note, f):
    label, value, unit, status, lvl = acc
    col = (148, 163, 184) if value == "--" else LEVEL_COL[lvl]
    d.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=8, fill=PANEL, outline=BORDER)
    d.text((x + 9, y + 3), label, font=F_LABEL, fill=MUTED)
    d.text((x + 9, y + 13), value, font=F_VAL2, fill=col if lvl else TEXT)
    vw = d.textlength(value, font=F_VAL2)
    d.text((x + 13 + vw, y + 19), unit, font=F_LABEL, fill=MUTED)
    if note is not None:
        nw = d.textlength(note, font=F_LABEL)
        d.text((x + w - nw - 8, y + 3), note, font=F_LABEL, fill=LEVEL_COL[1])
    else:
        cw = d.textlength(status, font=F_CHIP)
        d.text((x + w - cw - 8, y + 3), status, font=F_CHIP, fill=col)
        _, pvalue, _, _, plvl = peak
        txt = f"PK {pvalue}"
        tw = d.textlength(txt, font=F_LABEL)
        d.text((x + w - tw - 8, y + 17), txt, font=F_LABEL, fill=LEVEL_COL[plvl] if plvl else MUTED)
    # diverging bar: brake to the left of the centre mark, acceleration to the right
    bx, bw, by = x + 9, w - 18, y + h - 8
    d.rounded_rectangle([bx, by, bx + bw - 1, by + 3], radius=2, fill=TRACK)
    half = bw // 2
    if note is None and value != "--":
        lim = TH["accel"][1] if f >= 0 else TH["brake"][1]
        fw = int(half * max(0.0, min(1.0, abs(f) / lim)))
        if fw:
            if f >= 0:
                d.rectangle([bx + half, by, bx + half + fw - 1, by + 3], fill=col)
            else:
                d.rectangle([bx + half - fw, by, bx + half - 1, by + 3], fill=col)
    d.rectangle([bx + half - 1, by - 2, bx + half, by + 5], fill=MUTED)


_defect = {"t": 0.0, "text": ""}


def defect_state(det):
    if det is None:
        return "off", "DETECTION OFF"
    if det.error:
        return "error", "DETECTOR ERROR"
    dets, fsize, dage, dfps, dmax = det.latest()
    now = time.time()
    if dage < 2.5 and dets:
        (_, _, _, _), c, k = max(dets, key=lambda r: r[1])
        name = DET_NAMES[k] if k < len(DET_NAMES) else str(k)
        extra = f" +{len(dets) - 1}" if len(dets) > 1 else ""
        _defect["t"], _defect["text"] = now, f"{name.replace('_', ' ').upper()} {c:.0%}{extra}"
    if now - _defect["t"] < DEFECT_HOLD:
        return "defect", _defect["text"]
    return "clear", "TRACK CLEAR"


def draw_banner(d, x, y, w, h, mode, text, blink):
    if mode == "defect":
        fill, fg, edge = ((220, 38, 38) if blink else (185, 28, 28)), WHITE, (153, 27, 27)
    elif mode == "clear":
        fill, fg, edge = (220, 252, 231), (21, 128, 61), (134, 239, 172)
    elif mode == "error":
        fill, fg, edge = (254, 243, 199), (180, 83, 9), (252, 211, 77)
    else:
        fill, fg, edge = (226, 232, 240), (100, 116, 139), BORDER
    d.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=8, fill=fill, outline=edge)
    ix, iy = x + 13, y + h // 2
    if mode == "clear":
        d.ellipse([ix - 6, iy - 6, ix + 6, iy + 6], fill=fg)
        d.line([ix - 3, iy, ix - 1, iy + 3, ix + 3, iy - 3], fill=fill, width=2)
    elif mode in ("defect", "error"):
        d.polygon([(ix, iy - 7), (ix - 7, iy + 6), (ix + 7, iy + 6)], fill=fg)
        d.line([ix, iy - 2, ix, iy + 1], fill=fill, width=2)
        d.rectangle([ix, iy + 3, ix, iy + 4], fill=fill)
    else:
        d.ellipse([ix - 6, iy - 6, ix + 6, iy + 6], outline=fg, width=2)
    font = F_CHIP
    for f in (F_BIG, F_TITLE, F_CHIP):
        font = f
        if d.textlength(text, font=f) <= w - 40:
            break
    cx = x + 26 + (w - 30) / 2
    try:
        d.text((cx, y + h / 2), text, font=font, fill=fg, anchor="mm")
    except (ValueError, TypeError):
        d.text((cx - d.textlength(text, font=font) / 2, y + 3), text, font=font, fill=fg)


def draw_camera(img, d, cam, cam_on, overall, det=None):
    x, y, w, h = CAM_BOX
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=SLATE)
    msg, warn, live, fps_txt = None, False, False, None
    blink = int(time.time() * 2) % 2 == 0
    if cam is None:
        msg = "No camera module (camera_feed.py missing)"
    elif not cam_on:
        msg = "CAMERA OFF"
    else:
        frame, age, err = cam.latest()
        if frame is not None and age < 3.0:
            live = True
            s = min(w / frame.width, h / frame.height)
            dw, dh = int(frame.width * s), int(frame.height * s)
            shown = frame if s == 1 else frame.resize((dw, dh), Image.BILINEAR)
            ox, oy = x + (w - dw) // 2, y + (h - dh) // 2
            img.paste(shown, (ox, oy))
            if det is not None:
                dets, fsize, dage, dfps, dmax = det.latest()
                if det.error:
                    for i, line in enumerate(textwrap.wrap(det.error, max(8, (w - 8) // 6))[:6]):
                        d.text((x + 4, y + 24 + 12 * i), line, font=F_CHIP, fill=(255, 120, 120))
                elif dage < 2.5 and fsize == frame.size:
                    fps_txt = f"{dfps:.0f} FPS"
                    for (x1, y1, x2, y2), c, k in dets:
                        bx1, by1 = ox + x1 * s, oy + y1 * s
                        d.rectangle([bx1, by1, ox + x2 * s, oy + y2 * s], outline=(239, 68, 68), width=2)
                        name = DET_NAMES[k] if k < len(DET_NAMES) else str(k)
                        lab = f"{name.replace('_', ' ')} {c:.0%}"
                        lw = d.textlength(lab, font=F_CHIP)
                        ly = max(y + 22, by1 - 14)
                        d.rectangle([bx1, ly, bx1 + lw + 6, ly + 13], fill=RED)
                        d.text((bx1 + 3, ly), lab, font=F_CHIP, fill=WHITE)
                else:
                    fps_txt = "WAIT"
        elif err:
            msg, warn = err, True
        else:
            msg = "Starting camera..." if age > 1e8 else "No camera signal"
            warn = age < 1e8
    if msg:
        lines = textwrap.wrap(msg, max(8, (w - 16) // 7))[:5]
        for i, line in enumerate(lines):
            d.text((x + 8, y + h // 2 - 8 * len(lines) + 16 * i), line, font=F_LABEL,
                   fill=LEVEL_COL[1] if warn else (148, 163, 184))
    if live:
        d.rounded_rectangle([x + 6, y + 6, x + 48, y + 20], radius=7, fill=SLATE)
        d.ellipse([x + 11, y + 10, x + 16, y + 15], fill=(239, 68, 68) if blink else (120, 30, 30))
        d.text((x + 20, y + 6), "LIVE", font=F_CHIP, fill=WHITE)
    if fps_txt:
        fw = int(d.textlength(fps_txt, font=F_CHIP)) + 12
        d.rounded_rectangle([x + w - fw - 6, y + 6, x + w - 7, y + 20], radius=7, fill=SLATE)
        d.text((x + w - fw, y + 6), fps_txt, font=F_CHIP, fill=WHITE)
    region = img.crop((x, y, x + w, y + h))
    img.paste(Image.composite(region, Image.new("RGB", (w, h), BG), round_mask(w, h, 8)), (x, y))
    d.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=8,
                        outline=RED if overall == 2 else (170, 182, 200), width=2 if overall == 2 else 1)


def fit(d, text, font, width):
    while text and d.textlength(text, font=font) > width:
        text = text[:-1]
    return text


def icon_thermo(d, x, y, col):
    d.rounded_rectangle([x + 2, y, x + 4, y + 8], radius=1, fill=col)
    d.ellipse([x, y + 6, x + 6, y + 12], fill=col)


def icon_pin(d, x, y, col):
    d.ellipse([x, y, x + 8, y + 8], fill=col)
    d.polygon([(x + 1, y + 6), (x + 7, y + 6), (x + 4, y + 12)], fill=col)
    d.ellipse([x + 3, y + 3, x + 5, y + 5], fill=PANEL)


def draw_footer(d, state):
    y0 = H - FOOT_H
    d.rectangle([0, y0, W, H], fill=PANEL)
    d.line([0, y0, W, y0], fill=BORDER)
    now, from_rtc = rtc_now()
    clock = time.strftime("%d %b  %H:%M:%S", now)
    d.text((8, y0 + 2), clock, font=F_CLOCK, fill=TEXT)
    cx = 8 + d.textlength(clock, font=F_CLOCK) + 6
    d.text((cx, y0 + 5), "RTC" if from_rtc else "SYS", font=F_CHIP,
           fill=LEVEL_COL[0] if from_rtc else LEVEL_COL[1])

    right = W - 8
    imu_txt = "IMU" if state == "RUNNING" else "IMU " + state
    imu_col = LEVEL_COL[0] if state == "RUNNING" else LEVEL_COL[1]
    iw = d.textlength(imu_txt, font=F_CHIP)
    d.text((right - iw, y0 + 5), imu_txt, font=F_CHIP, fill=imu_col)
    d.ellipse([right - iw - 11, y0 + 8, right - iw - 5, y0 + 14], fill=imu_col)
    t = cpu_temp()
    ttxt = f"{t:.0f}°C" if t is not None else "--"
    tw = d.textlength(ttxt, font=F_CHIP)
    tx = right - iw - 22 - tw
    tcol = temp_color(t) if t is not None else MUTED
    d.text((tx, y0 + 5), ttxt, font=F_CHIP, fill=tcol)
    icon_thermo(d, int(tx) - 10, y0 + 4, tcol)

    ip = cached_ip()
    ipw = d.textlength(ip or "no network", font=F_SMALL)
    d.text((right - ipw, y0 + 18), ip or "no network", font=F_SMALL,
           fill=MUTED if ip else LEVEL_COL[2])
    if LOC.text:
        loc, lcol = LOC.text, TEXT
    else:
        loc, lcol = ("Locating..." if ip else "Location offline"), MUTED
    icon_pin(d, 8, y0 + 17, BLUE if LOC.text else (148, 163, 184))
    d.text((21, y0 + 17), fit(d, loc, F_LABEL, right - ipw - 30), font=F_LABEL, fill=lcol)


def render(sampler, cam, cam_on, det=None):
    state, error, cal_started, metrics = snapshot_metrics(sampler)
    tiles = build_tiles(metrics) if metrics else placeholder_tiles()
    overall = max(t[4] for t in tiles)
    mode, dtext = defect_state(det)
    if mode == "defect":
        overall = 2
    blink = int(time.time() * 2) % 2 == 0

    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Header: gradient, title, detector badge, status pill
    img.paste(header_bg(), (0, 0))
    d.text((10, 4), "ITMS", font=F_TITLE, fill=WHITE)
    tx = 10 + d.textlength("ITMS", font=F_TITLE) + 8
    d.text((tx, 8), "TRAIN MONITOR", font=F_CHIP, fill=NAVY_TXT)
    if det is not None:
        bx = tx + d.textlength("TRAIN MONITOR", font=F_CHIP) + 10
        bt = "NPU" if det.__class__.__name__ == "NpuDetector" else "CPU"
        bw = d.textlength(bt, font=F_CHIP) + 10
        d.rounded_rectangle([bx, 6, bx + bw, 20], radius=7, outline=NAVY_TXT)
        d.text((bx + 5, 6), bt, font=F_CHIP, fill=WHITE)
    left = max(0, CAL_SECONDS - (time.time() - cal_started))
    if mode == "defect" or (state == "RUNNING" and overall == 2):
        label, col = "ALERT", ((239, 68, 68) if blink else (220, 38, 38))
    elif state == "RUNNING":
        label, col = ("WARN", LEVEL_COL[1]) if overall == 1 else ("ALL OK", LEVEL_COL[0])
    elif state == "CALIBRATING":
        label, col = f"ZEROING {left:.0f}s", LEVEL_COL[1]
    else:
        label, col = ("NO IMU" if state == "ERROR" else "START"), (100, 116, 139)
    pill(d, W - 6, 4, label, col)

    # Body
    draw_camera(img, d, cam, cam_on, overall if (metrics or mode == "defect") else 0, det)
    by = CAM_BOX[1] + CAM_BOX[3] + 3
    draw_banner(d, CAM_BOX[0], by, CAM_BOX[2], 22, mode, dtext, blink)

    if metrics:
        fr = [metrics["vert"] / TH["vert"][1], metrics["lat"] / TH["lat"][1],
              metrics["roll"] / TH["roll"][1], metrics["jerk"] / TH["jerk"][1]]
        fcur = metrics["long"]
    else:
        fr, fcur = [0, 0, 0, 0], 0.0
    gx = CAM_BOX[0] + CAM_BOX[2] + 6
    rh = (BOT - TOP - 3 * 3) // 4
    for i, idx in enumerate([0, 1, 2, 4]):
        tile_m(d, gx, TOP + i * (rh + 3), W - 4 - gx, rh, *tiles[idx], fr[i])

    ay = by + 22 + 3
    note = None
    if state == "CALIBRATING":
        note = f"Zeroing {left:.0f}s"
    elif state == "ERROR":
        note = (error[:22] or "IMU not responding")
    elif not metrics:
        note = "Collecting data..."
    acc_tile(d, CAM_BOX[0], ay, CAM_BOX[2], BOT - ay, tiles[3], tiles[5], note, fcur)

    draw_footer(d, state)
    return img


# ===== SHUTDOWN SCREEN =====
import base64
import io


def _term_handler(*_):
    raise KeyboardInterrupt




BG_B64 = (
    "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"
    "296QZy2cnNGkZgSp7g0kf6VCVAFzNcoUKVOv/9k="
)


# Edit these lines to change the text: (y position, text, size, bold, colour)
SHUTDOWN_LINES = [
    (152, "DESIGNED & DEVELOPED BY", 9, True, (120, 235, 215)),
    (178, "SIR VEDANT BURDE", 24, True, (240, 248, 255)),
    (200, "ONE MAN. ONE BOARD. ZERO TEAMMATES.", 10, True, (255, 70, 70)),
    (216, "Your whole team vs my solo build. Try me.", 10, False, (205, 218, 232)),
    (231, "ITMS  TRAIN  MONITOR", 8, True, (110, 130, 160)),
]


def shutdown_screen():
    img = Image.open(io.BytesIO(base64.b64decode(BG_B64))).convert("RGB")
    d = ImageDraw.Draw(img)
    for y, text, size, bold, col in SHUTDOWN_LINES:
        if text.startswith("DESIGNED"):
            text = "   ".join(" ".join(w) for w in text.split())
        f = load_font(size, bold)
        try:
            d.text((W / 2, y), text, font=f, fill=col, anchor="mm")
        except (ValueError, TypeError):
            d.text((W / 2 - d.textlength(text, font=f) / 2, y - 8), text, font=f, fill=col)
    d.line([90, 191, 230, 191], fill=(220, 40, 40), width=1)
    return img


def main():
    sampler = Sampler()
    sampler.start()
    link = Link(TH, STEADY_BAND, DET_NAMES) if Link else None
    signal.signal(signal.SIGTERM, _term_handler)
    LOC.start()
    signal.signal(signal.SIGUSR1, lambda *_: sampler.request_recalibrate())

    if "--print" in sys.argv:
        while True:
            time.sleep(0.5)
            state, error, _, rows = sampler.snapshot()
            m = compute(rows) if state == "RUNNING" else None
            print(state, error, {k: round(v, 3) for k, v in m.items()} if m else "")

    # With detection on, the camera captures bigger frames (DET_CAPTURE); the TFT box
    # shows a scaled-down copy and the detector sees the full-size frame.
    cap_area = DET_CAPTURE if (DET_ENABLED and (Detector is not None or NpuDetector is not None)) else (CAM_BOX[2], CAM_BOX[3])
    cam = CameraFeed(CAM_DEVICE, CAM_ROTATE, CAM_FPS, area=cap_area) if CameraFeed else None
    cam_on = bool(CAM_ENABLED and cam is not None)
    want_toggle = {"flag": False}
    signal.signal(signal.SIGUSR2, lambda *_: want_toggle.update(flag=True))
    if cam_on:
        cam.start()

    det = None
    if DET_ENABLED and (Detector is not None or NpuDetector is not None) and cam is not None:
        if USE_NPU and NpuDetector is not None:
            try:
                det = NpuDetector(cam, conf=DET_CONF)
                det.start()
                print("Detector: NPU")
            except Exception as e:       # runner/driver/model missing: fall back to the CPU
                print("NPU detector failed, using CPU:", e)
                det = None
        if det is None:
            try:
                det = Detector(cam, conf=DET_CONF)
                det.start()
                print("Detector: CPU")
            except Exception as e:       # missing model / onnxruntime: run without boxes
                print("Detector disabled:", e)
                det = None

    disp = Display()
    try:
        while True:
            start = time.time()
            if want_toggle["flag"]:
                want_toggle["flag"] = False
                if cam is not None:
                    cam_on = not cam_on
                    cam.start() if cam_on else cam.stop()
            disp.show(render(sampler, cam, cam_on, det))
            if link is not None:
                try:
                    st_, _e, _c, m_ = snapshot_metrics(sampler)
                    link.update(m_ if st_ == "RUNNING" else None, det)
                except Exception as e:               # the alert link must never stop the screen
                    print("[link] error:", e, flush=True)
            period = CAM_REFRESH_SECONDS if cam_on else REFRESH_SECONDS
            time.sleep(max(0.0, period - (time.time() - start)))
    except KeyboardInterrupt:
        pass
    finally:
        try:
            disp.show(shutdown_screen())
        except Exception:
            disp.show(Image.new("RGB", (W, H), (0, 0, 0)))
        if cam is not None:
            cam.stop()


if __name__ == "__main__":
    main()
