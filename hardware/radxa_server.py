#!/usr/bin/env python3
"""
TrackGuard reference server for the Radxa edge device.

Endpoints (CORS enabled so the dashboard can call them from the browser):
  GET /api/status    -> {"ok": true, "device": "radxa", "uptime": 123}
  GET /api/sensors   -> {"speed", "vibration", "accel":[x,y,z], "orientation":{roll,pitch,yaw}, "temperature"}
  GET /stream.mjpg   -> MJPEG video from the top-view camera

Install:   pip install flask opencv-python smbus2
Run:       python3 radxa_server.py            (listens on 0.0.0.0:8080)

Replace read_imu() with your real MPU-6050 / IMU driver. If no camera or IMU is
found the server falls back to generated values so you can test the link.
"""
import math, random, time
from flask import Flask, Response, jsonify

try:
    import cv2
    cam = cv2.VideoCapture(0)
except Exception:  # OpenCV or camera missing
    cv2, cam = None, None

app = Flask(__name__)
T0 = time.time()


@app.after_request
def cors(r):
    r.headers["Access-Control-Allow-Origin"] = "*"
    return r


def read_imu():
    """TODO: replace with real IMU reads. Units: g, m/s^2, degrees, Celsius, km/h."""
    t = time.time()
    return {
        "speed": 62 + math.sin(t / 7) * 4,
        "vibration": 0.2 + random.random() * 0.05,
        "accel": [0.12 + random.gauss(0, 0.03), -0.03 + random.gauss(0, 0.02), 9.78 + random.gauss(0, 0.02)],
        "orientation": {"roll": 0.8 + math.sin(t / 9) * 0.4, "pitch": -1.2, "yaw": 178.5},
        "temperature": 36.2,
    }


@app.get("/api/status")
def status():
    return jsonify(ok=True, device="radxa", uptime=int(time.time() - T0), camera=bool(cam and cam.isOpened()))


@app.get("/api/sensors")
def sensors():
    return jsonify(read_imu())


def frames():
    while True:
        if cam is not None and cam.isOpened():
            ok, frame = cam.read()
            if not ok:
                time.sleep(0.05)
                continue
            _, jpg = cv2.imencode(".jpg", frame)
            data = jpg.tobytes()
        else:
            time.sleep(0.2)
            continue
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + data + b"\r\n"


@app.get("/stream.mjpg")
def stream():
    return Response(frames(), mimetype="multipart/x-mixed-replace; boundary=frame")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, threaded=True)
