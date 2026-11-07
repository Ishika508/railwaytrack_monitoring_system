"""Cosine similarity between float and uint8 NPU tensors.
usage: python3 compare.py <float_dir> <uint8_dir>   (matching *.bin / *.tensor float32 files)
Pass threshold: cos >= 0.99 on all 6 output tensors.
"""
import os
import sys
import numpy as np

THRESH = 0.99


def cos(a, b):
    a, b = a.ravel().astype(np.float64), b.ravel().astype(np.float64)
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))


fd, ud = sys.argv[1], sys.argv[2]
files = sorted(f for f in os.listdir(fd) if f.endswith((".bin", ".tensor")))
ok = True
for f in files:
    p = os.path.join(ud, f)
    if not os.path.exists(p):
        print(f, "missing in", ud)
        ok = False
        continue
    c = cos(np.fromfile(os.path.join(fd, f), np.float32), np.fromfile(p, np.float32))
    print(f"{f}: cos={c:.4f} {'OK' if c >= THRESH else 'LOW'}")
    ok &= c >= THRESH
print("PASS" if ok else "FAIL")
