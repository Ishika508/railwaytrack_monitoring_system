#!/usr/bin/env python3
"""Modern UI for ~/dashboard.py (320x240 ILI9341): gradient header with NPU badge, rounded camera
with LIVE/FPS chips and red defect boxes, gauge-bar tiles, diverging accel/brake bar, icon footer
with CPU temperature and IP location. Backs up first; safe to re-run; replaces ui_pro.py."""
import os
import re
import shutil

EDGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "edge"))
p = os.environ.get("ITMS_DASHBOARD_PATH", os.path.join(EDGE_DIR, "dashboard.py"))
bak = os.path.splitext(p)[0] + "_before_pro.py"
if not os.path.exists(bak):
    shutil.copy(p, bak)
s = open(p).read()

NEW = r'''# ===== PRO UI =====
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


'''


def sub(pattern, repl):
    global s
    s, n = re.subn(pattern, repl, s, flags=re.M)
    print(f"{n} x {pattern[:40]!r}")


sub(r"^BG = .*$", "BG = (236, 241, 247)")
if "BORDER =" not in s:
    sub(r"^PANEL = .*$", "PANEL = (255, 255, 255)\nBORDER = (208, 217, 229)")
sub(r"^TEXT = .*$", "TEXT = (20, 30, 48)")
sub(r"^MUTED = .*$", "MUTED = (98, 112, 135)")
sub(r"^LEVEL_COL = .*$", "LEVEL_COL = {0: (22, 163, 74), 1: (217, 119, 6), 2: (220, 38, 38)}")
sub(r"^BLUE = .*$", "BLUE = (37, 99, 235)")

start = s.find("# ===== PRO UI =====")
if start < 0:
    start = s.find("def draw_footer(d, state):")
end = s.find("def main():")
if start < 0 or end < 0 or end < start:
    raise SystemExit("could not find draw_footer/main in dashboard.py; nothing changed")
s = s[:start] + NEW + s[end:]

if "LOC.start()" not in s:
    s = s.replace("    sampler.start()\n", "    sampler.start()\n    LOC.start()\n", 1)

open(p, "w").write(s)
print("done; backup at", bak)
