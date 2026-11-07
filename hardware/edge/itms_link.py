#!/usr/bin/env python3
"""ITMS alert link: Radxa -> Wi-Fi UDP -> Heltec LoRa 32 V3.2 -> LoRa 433 MHz -> control room.

Used by dashboard.py (see link_patch.py). Watches the NPU defect detector and the IMU metrics,
and sends one small 28-byte packet when something happens:
  defect (confirmed on 3 of the last 5 detector frames), sudden acceleration, sudden braking,
  wobble (lateral or roll), vibration (vertical), jerk. Also a heartbeat every 30 s.

Test the radio path without the dashboard:   python3 itms_link.py test
"""
import json
import os
import socket
import struct
import sys
import threading
import time
from collections import deque

# ------------------------------ settings ------------------------------
HELTEC_IP = os.environ.get("ITMS_HELTEC_IP", "192.168.4.1")    # Heltec SoftAP address
HELTEC_PORT = int(os.environ.get("ITMS_HELTEC_PORT", "4210"))
NODE_ID = 1                 # which unit this is (0-255)
TX_MIN_LEVEL = 1            # 1 = send at warn and above, 2 = alert only
MIN_GAP_S = 1.5             # never send faster than this (LoRa airtime / duty cycle)
REPEAT_S = 10.0             # while a condition stays active, repeat this often
HEARTBEAT_S = 30.0          # "I am alive" packet when nothing is happening
LOC_FILE = os.path.expanduser("~/itms_location.json")   # {"lat": 21.1458, "lon": 79.0882}
# -----------------------------------------------------------------------

VER = 0xA1
# ver, node, seq, unix time, flags, severity, defect class, defect conf %, accel cm/s2,
# vertical mg, lateral mg, roll 0.1 deg/s, latitude e6, longitude e6
FMT = "<BBHIBBBBhHHHii"
SIZE = struct.calcsize(FMT)
assert SIZE == 28
NO_FIX = 2147483647

F_DEFECT, F_ACCEL, F_BRAKE, F_WOBBLE, F_VIB, F_JERK, F_HEART = 1, 2, 4, 8, 16, 32, 128
FLAG_NAMES = {F_DEFECT: "DEFECT", F_ACCEL: "ACCEL", F_BRAKE: "BRAKE", F_WOBBLE: "WOBBLE",
              F_VIB: "VIBRATION", F_JERK: "JERK", F_HEART: "HEARTBEAT"}


def flag_text(flags):
    return "+".join(n for b, n in FLAG_NAMES.items() if flags & b) or "-"


def read_location():
    try:
        with open(LOC_FILE) as f:
            j = json.load(f)
        return int(round(float(j["lat"]) * 1e6)), int(round(float(j["lon"]) * 1e6))
    except Exception:
        return NO_FIX, NO_FIX


def _lvl(v, warn_alert):
    return 2 if v >= warn_alert[1] else 1 if v >= warn_alert[0] else 0


def _clip(v, lo, hi):
    return int(max(lo, min(hi, v)))


class Link:
    def __init__(self, th, steady_band, det_names):
        self.th, self.steady, self.names = th, steady_band, list(det_names)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(("", 0))
        self.sock.settimeout(2.0)
        self.seq = 0
        self.last_tx = 0.0
        self.last_hb = time.time()
        self.last_flags = 0
        self.last_sev = 0
        self.last_ack = None            # (seq, status, time) from the Heltec
        self._dhist = deque(maxlen=5)
        self._dkey = -1.0
        self._dbest = None
        self._err_t = 0.0
        threading.Thread(target=self._listen, daemon=True).start()

    # ------------------------------------------------------------ ack
    def _listen(self):
        while True:
            try:
                data, _ = self.sock.recvfrom(64)
            except socket.timeout:
                continue
            except OSError:
                time.sleep(1)
                continue
            if len(data) >= 4 and data[0] == 0xAC:
                self.last_ack = (struct.unpack("<H", data[2:4])[0], data[1], time.time())

    # --------------------------------------------------------- events
    def _imu_flags(self, m):
        flags, sev = 0, 0
        if not m:
            return flags, sev

        def mark(flag, level):
            nonlocal flags, sev
            if level >= TX_MIN_LEVEL:
                flags |= flag
                sev = max(sev, level)

        f = m["long"]
        if f >= self.steady:
            mark(F_ACCEL, _lvl(f, self.th["accel"]))
        elif f <= -self.steady:
            mark(F_BRAKE, _lvl(-f, self.th["brake"]))
        mark(F_WOBBLE, max(_lvl(m["lat"], self.th["lat"]), _lvl(m["roll"], self.th["roll"])))
        mark(F_VIB, _lvl(m["vert"], self.th["vert"]))
        mark(F_JERK, _lvl(m["jerk"], self.th["jerk"]))
        return flags, sev

    def _defect(self, det):
        """(class, confidence %) once the detector has seen a defect in 3 of its last 5 frames."""
        if det is None or getattr(det, "error", ""):
            return None
        dets, _fsize, dage, _fps, _mx = det.latest()
        if dage >= 2.5:
            self._dhist.clear()
            return None
        key = time.time() - dage                    # identifies one detector result
        if abs(key - self._dkey) > 0.01:
            self._dkey = key
            self._dhist.append(bool(dets))
            if dets:
                self._dbest = max(dets, key=lambda r: r[1])
        if sum(self._dhist) >= 3 and self._dbest is not None:
            _, conf, cls = self._dbest
            return cls, int(round(conf * 100))
        return None

    # ----------------------------------------------------------- send
    def _send(self, flags, sev, cls, conf, m):
        self.seq = (self.seq + 1) & 0xFFFF
        la, lo = read_location()
        m = m or {}
        pkt = struct.pack(
            FMT, VER, NODE_ID, self.seq, int(time.time()), flags, sev, cls, conf,
            _clip(m.get("long", 0) * 100, -32768, 32767),
            _clip(m.get("vert", 0) * 1000, 0, 65535),
            _clip(m.get("lat", 0) * 1000, 0, 65535),
            _clip(m.get("roll", 0) * 10, 0, 65535), la, lo)
        try:
            self.sock.sendto(pkt, (HELTEC_IP, HELTEC_PORT))
        except OSError as e:
            if time.time() - self._err_t > 30:
                print("[link] cannot reach the Heltec:", e, flush=True)
                self._err_t = time.time()
        self.last_tx = time.time()
        print(f"[link] TX seq={self.seq} {flag_text(flags)} sev={sev} cls={cls} conf={conf}",
              flush=True)

    def update(self, m, det):
        """Call about 10 times a second with the IMU metrics dict (or None) and the detector."""
        now = time.time()
        flags, sev = self._imu_flags(m)
        cls, conf = 255, 0
        d = self._defect(det)
        if d:
            cls, conf = d
            flags |= F_DEFECT
            name = self.names[cls] if cls < len(self.names) else ""
            sev = max(sev, 2 if name.startswith("Severe") else 1)

        if flags:
            new = flags & ~self.last_flags
            escalated = sev > self.last_sev
            repeat = now - self.last_tx >= REPEAT_S
            if (new or escalated or repeat) and now - self.last_tx >= MIN_GAP_S:
                self._send(flags, sev, cls, conf, m)
                self.last_hb = now
        elif now - self.last_hb >= HEARTBEAT_S and now - self.last_tx >= MIN_GAP_S:
            self._send(F_HEART, 0, 255, 0, m)
            self.last_hb = now
        self.last_flags, self.last_sev = flags, sev


def _test():
    th = {"vert": (1, 2), "lat": (1, 2), "roll": (30, 60), "accel": (0.85, 1.15),
          "brake": (0.85, 1.05), "jerk": (4.2, 6.0)}
    link = Link(th, 0.15, ["Rail_Gap", "Severe_Crack", "Severe_Gap", "Sleeper_Crack", "Sleeper_weak"])
    m = {"vert": 0.05, "lat": 0.03, "roll": 1.2, "long": -1.3, "jerk": 0.4, "peak_brake": -1.3}
    print(f"sending a test BRAKE alert to {HELTEC_IP}:{HELTEC_PORT} ...")
    link.update(m, None)
    for _ in range(40):
        time.sleep(0.1)
        if link.last_ack:
            seq, status, _ = link.last_ack
            print("Heltec reply: seq", seq, "OK, sent on LoRa" if status == 0 else f"status {status}")
            return
    print("no reply from the Heltec (check Wi-Fi: Radxa must be joined to ITMS-NODE)")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        _test()
    else:
        print(__doc__)
