#!/usr/bin/env python3
"""Hooks itms_link.py into ~/dashboard.py. Backs up first; safe to re-run."""
import os
import shutil

EDGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "edge"))
p = os.environ.get("ITMS_DASHBOARD_PATH", os.path.join(EDGE_DIR, "dashboard.py"))
bak = os.path.splitext(p)[0] + "_before_link.py"
if not os.path.exists(bak):
    shutil.copy(p, bak)
s = open(p).read()

IMPORT = '''try:
    from itms_link import Link               # LoRa alert link (Wi-Fi UDP -> Heltec -> 433 MHz)
except ImportError:
    Link = None

'''
if "from itms_link import Link" not in s:
    anchor = "# =========================== SETTINGS ==========================="
    if anchor not in s:
        raise SystemExit("settings marker not found; nothing changed")
    s = s.replace(anchor, IMPORT + anchor, 1)
    print("import added")

if "link = Link(" not in s:
    old = "    sampler.start()\n"
    if old not in s:
        raise SystemExit("sampler.start() not found; nothing changed")
    s = s.replace(old, old + "    link = Link(TH, STEADY_BAND, DET_NAMES) if Link else None\n", 1)
    print("Link created in main()")

HOOK_OLD = "            disp.show(render(sampler, cam, cam_on, det))\n"
HOOK_NEW = HOOK_OLD + '''            if link is not None:
                try:
                    st_, _e, _c, m_ = snapshot_metrics(sampler)
                    link.update(m_ if st_ == "RUNNING" else None, det)
                except Exception as e:               # the alert link must never stop the screen
                    print("[link] error:", e, flush=True)
'''
if "link.update(" not in s:
    if HOOK_OLD not in s:
        raise SystemExit("display loop line not found; nothing changed")
    s = s.replace(HOOK_OLD, HOOK_NEW, 1)
    print("update hook added")

open(p, "w").write(s)
print("done; backup at", bak)
