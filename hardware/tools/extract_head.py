"""Cut best.onnx before the final concat -> 6 raw head outputs (box+cls per scale)."""
import sys
import onnx
import onnx.utils

SRC = sys.argv[1] if len(sys.argv) > 1 else "best.onnx"
DST = sys.argv[2] if len(sys.argv) > 2 else "own_track_head.onnx"

# Ultralytics YOLOv8 Detect head: cv2.i = box branch, cv3.i = class branch, i = 0,1,2 (strides 8,16,32)
OUTPUTS = []
for i in range(3):
    OUTPUTS.append(f"/model.22/cv2.{i}/cv2.{i}.2/Conv_output_0")  # box: 4*16 = 64 ch
    OUTPUTS.append(f"/model.22/cv3.{i}/cv3.{i}.2/Conv_output_0")  # cls: 5 ch

names = {o.name for n in onnx.load(SRC).graph.node for o in n.output}
missing = [o for o in OUTPUTS if o not in names]
if missing:
    print("Tensor names not found (export naming differs):", missing)
    print("Candidates:", sorted(n for n in names if "model.22" in n and "Conv_output_0" in n))
    sys.exit(1)

onnx.utils.extract_model(SRC, DST, ["images"], OUTPUTS)
print("saved", DST)
