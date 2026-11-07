"""NPU detector: calls the custom C++ npu_runner on own_track_6_uint8_a733.nb.

ASSUMED runner interface (adjust RUNNER_CMD to match your build):
    npu_runner <model.nb> <input.bin> <out_dir>
    input.bin : 640*640*3 uint8, RGB, HWC
    out_dir   : 6 float32 files (any order); shape is inferred from file size
"""
import os
import subprocess
import tempfile
import threading
import time
import numpy as np
from detector import letterbox, decode, IMG

MODEL = os.path.expanduser("~/model/own_track_6_uint8_a733.nb")
RUNNER = os.path.expanduser("~/npu_runner")
LIB = os.path.expanduser("~/lib")   # libNBGlinker.so, libVIPhal.so

# element count -> shape (1,C,H,W)
SHAPES = {
    64 * 80 * 80: (1, 64, 80, 80),  # 409600
    5 * 80 * 80: (1, 5, 80, 80),    # 32000
    64 * 40 * 40: (1, 64, 40, 40),  # 102400
    5 * 40 * 40: (1, 5, 40, 40),    # 8000
    64 * 20 * 20: (1, 64, 20, 20),  # 25600
    5 * 20 * 20: (1, 5, 20, 20),    # 2000
}


class NpuDetector:
    def __init__(self):
        self.tmp = tempfile.mkdtemp(prefix="npu_")
        self._frame, self._result, self._ms = None, [], 0.0
        self._lock, self._ev, self._run = threading.Lock(), threading.Event(), True
        threading.Thread(target=self._loop, daemon=True).start()

    def submit(self, frame):
        with self._lock:
            self._frame = frame
        self._ev.set()

    def get(self):
        with self._lock:
            return self._result, self._ms

    def stop(self):
        self._run = False
        self._ev.set()

    def _infer(self, frame):
        img, r, left, top = letterbox(frame, IMG)
        inp = os.path.join(self.tmp, "in.bin")
        img[:, :, ::-1].astype(np.uint8).tofile(inp)
        env = dict(os.environ, LD_LIBRARY_PATH=LIB + ":" + os.environ.get("LD_LIBRARY_PATH", ""))
        subprocess.run([RUNNER, MODEL, inp, self.tmp], check=True, env=env,
                       stdout=subprocess.DEVNULL)
        outs = []
        for f in sorted(os.listdir(self.tmp)):
            if f.startswith("out_"):
                a = np.fromfile(os.path.join(self.tmp, f), np.float32)
                outs.append(a.reshape(SHAPES[a.size]))
        return decode(outs, r, left, top)

    def _loop(self):
        while self._run:
            self._ev.wait()
            self._ev.clear()
            with self._lock:
                frame = self._frame
            if frame is None:
                continue
            t0 = time.time()
            try:
                res = self._infer(frame)
            except Exception as e:
                print("NPU error:", e)
                res = []
            with self._lock:
                self._result, self._ms = res, (time.time() - t0) * 1000


if __name__ == "__main__":
    import sys
    import cv2
    d = NpuDetector()
    d.submit(cv2.imread(sys.argv[1]))
    time.sleep(3)
    print(d.get())
