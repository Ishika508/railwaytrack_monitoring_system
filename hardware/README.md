# TrackGuard hardware stack

The Next.js dashboard runs on the operator computer. The files in this directory
run on the Radxa edge device and the two LoRa boards.

## Folders

- `radxa_server.py` - lightweight HTTP bridge used by the web app's Radxa connection flow.
- `edge/` - Radxa TFT dashboard, camera/IMU processing, defect detection, and alert link.
- `firmware/` - Arduino sketches for the Heltec transmitter and control-room receiver.
- `systemd/` - service units for the Radxa deployment.
- `tools/` - model conversion/validation and optional dashboard patch scripts.

## Radxa setup

```bash
cd hardware
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Copy `edge/` to the Radxa as `/opt/trackguard/hardware/edge` and install the
service files from `systemd/`. The service units assume that deployment path.
The dashboard requires the board-specific `camera_feed.py`, the exported model,
and (for NPU mode) `npu_runner` and its shared libraries beside the paths
configured in `edge/npu_detector.py`.

The browser-facing bridge is separate:

```bash
python3 hardware/radxa_server.py
```

It listens on port 8080 and exposes `/api/status`, `/api/sensors`, and
`/stream.mjpg`.

## Firmware

Open `firmware/heltec_tx.ino` and `firmware/node2_rx.ino` in Arduino IDE.
Install RadioLib and U8g2, select the board described in each sketch, and
verify that both radios use the same frequency and modulation settings.
Attach the correct antenna before transmitting.

## Optional dashboard patches

Run these from the repository root when preparing a Radxa deployment:

```bash
python3 hardware/tools/link_patch.py
python3 hardware/tools/ui_modern.py
python3 hardware/tools/shutdown_patch_v4.py
python3 hardware/tools/th_set.py
```

Each script edits the sibling `edge/dashboard.py` and creates a backup. Set
`ITMS_DASHBOARD_PATH` to target a different deployment copy.
