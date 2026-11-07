#!/usr/bin/env python3
"""Credits screen v4 for ~/dashboard.py: skull artwork background, the name
"Sir Vedant Burde" and a solo-build flex, shown on the TFT when the dashboard stops (service stop,
reboot, poweroff). Replaces the earlier credits screen. Backs up first; safe to re-run."""
import os
import shutil

EDGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "edge"))
p = os.environ.get("ITMS_DASHBOARD_PATH", os.path.join(EDGE_DIR, "dashboard.py"))
bak = os.path.splitext(p)[0] + "_before_shutdown.py"
if not os.path.exists(bak):
    shutil.copy(p, bak)
s = open(p).read()

NEW = r'''# ===== SHUTDOWN SCREEN =====
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


'''

if "# ===== SHUTDOWN SCREEN =====" in s:
    a = s.find("# ===== SHUTDOWN SCREEN =====")
    b = s.find("def main():")
    s = s[:a] + NEW + s[b:]
else:
    s = s.replace("def main():", NEW + "def main():", 1)

OLD_FINALLY = '''    finally:
        if cam is not None:
            cam.stop()
        disp.show(Image.new("RGB", (W, H), (0, 0, 0)))'''
NEW_FINALLY = '''    finally:
        try:
            disp.show(shutdown_screen())
        except Exception:
            disp.show(Image.new("RGB", (W, H), (0, 0, 0)))
        if cam is not None:
            cam.stop()'''
if OLD_FINALLY in s:
    s = s.replace(OLD_FINALLY, NEW_FINALLY)
    print("finally block patched")
elif "disp.show(shutdown_screen())" in s:
    print("finally block already patched")
else:
    raise SystemExit("could not find the finally block in main(); nothing changed")

if "_term_handler" not in s.split("def main():", 1)[1]:
    s = s.replace("    sampler.start()\n",
                  "    sampler.start()\n    signal.signal(signal.SIGTERM, _term_handler)\n", 1)
    print("SIGTERM handler added")

open(p, "w").write(s)
print("done; backup at", bak)
