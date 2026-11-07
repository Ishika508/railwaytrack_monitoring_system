"""CPU detector: onnxruntime on own_track_head.onnx (6 raw outputs) + threaded wrapper."""
import threading
import cv2
import numpy as np
import onnxruntime as ort

CLASSES = ["Rail_Gap", "Severe_Crack", "Severe_Gap", "Sleeper_Crack", "Sleeper_weak"]
IMG = 640
STRIDES = (8, 16, 32)       # grids: 640/8 = 80, 640/16 = 40, 640/32 = 20
REG_MAX = 16                # DFL bins; box channels = 4 * 16 = 64
NC = len(CLASSES)           # 5
CONF_THR = 0.25
IOU_THR = 0.45
THREADS = 2                 # measured fastest on Cubie A7A: 842 ms (2) vs 1440 ms (1), 968 ms (3)


def letterbox(img, size=IMG):
    h, w = img.shape[:2]
    r = min(size / h, size / w)
    nh, nw = round(h * r), round(w * r)
    top, left = (size - nh) // 2, (size - nw) // 2
    canvas = np.full((size, size, 3), 114, np.uint8)
    canvas[top:top + nh, left:left + nw] = cv2.resize(img, (nw, nh))
    return canvas, r, left, top


def decode(outs, r, left, top, conf_thr=CONF_THR, iou_thr=IOU_THR):
    """outs: 6 float arrays (1,C,H,W). Returns [(x1,y1,x2,y2,score,cls_id)] in original frame coords."""
    box_t = sorted([o for o in outs if o.shape[1] == 4 * REG_MAX], key=lambda o: -o.shape[2])
    cls_t = sorted([o for o in outs if o.shape[1] == NC], key=lambda o: -o.shape[2])
    bxs, scs, cls = [], [], []
    bins = np.arange(REG_MAX, dtype=np.float32).reshape(1, REG_MAX, 1)
    for bt, ct, s in zip(box_t, cls_t, STRIDES):
        H, W = bt.shape[2:]
        b = bt[0].reshape(4, REG_MAX, H * W)
        b = np.exp(b - b.max(1, keepdims=True))
        b /= b.sum(1, keepdims=True)
        d = (b * bins).sum(1) * s                            # (4, HW) l,t,r,b in pixels
        sc = 1.0 / (1.0 + np.exp(-ct[0].reshape(NC, H * W)))
        ys, xs = np.divmod(np.arange(H * W), W)
        cx, cy = (xs + 0.5) * s, (ys + 0.5) * s
        best, bid = sc.max(0), sc.argmax(0)
        k = best > conf_thr
        if not k.any():
            continue
        x1, y1 = cx[k] - d[0][k], cy[k] - d[1][k]
        x2, y2 = cx[k] + d[2][k], cy[k] + d[3][k]
        bxs.append(np.stack([x1, y1, x2, y2], 1))
        scs.append(best[k])
        cls.append(bid[k])
    if not bxs:
        return []
    bxs, scs, cls = np.concatenate(bxs), np.concatenate(scs), np.concatenate(cls)
    xywh = np.stack([bxs[:, 0], bxs[:, 1], bxs[:, 2] - bxs[:, 0], bxs[:, 3] - bxs[:, 1]], 1)
    keep = cv2.dnn.NMSBoxes(xywh.tolist(), scs.tolist(), conf_thr, iou_thr)
    res = []
    for i in np.array(keep).flatten():
        x1, y1, x2, y2 = bxs[i]
        res.append(((x1 - left) / r, (y1 - top) / r, (x2 - left) / r, (y2 - top) / r,
                    float(scs[i]), int(cls[i])))
    return res


class Detector:
    """Background-thread detector. submit(frame) never blocks; get() returns latest result."""

    def __init__(self, model="own_track_head.onnx"):
        so = ort.SessionOptions()
        so.intra_op_num_threads = THREADS
        self.sess = ort.InferenceSession(model, so, providers=["CPUExecutionProvider"])
        self.inp = self.sess.get_inputs()[0].name
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

    def _loop(self):
        import time
        while self._run:
            self._ev.wait()
            self._ev.clear()
            with self._lock:
                frame = self._frame
            if frame is None:
                continue
            t0 = time.time()
            img, r, left, top = letterbox(frame)
            x = img[:, :, ::-1].transpose(2, 0, 1)[None].astype(np.float32) / 255.0
            outs = self.sess.run(None, {self.inp: np.ascontiguousarray(x)})
            res = decode(outs, r, left, top)
            with self._lock:
                self._result, self._ms = res, (time.time() - t0) * 1000


if __name__ == "__main__":
    import sys
    det = Detector()
    im = cv2.imread(sys.argv[1])
    det.submit(im)
    import time
    time.sleep(3)
    print(det.get())
