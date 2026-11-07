import re, os
# (warn, alert): change these numbers to tune
TH_NEW = {
    "vert":  (3.00, 6.00),   # g      (original 0.15, 0.30)
    "roll":  (30.0, 60.0),   # deg/s  (original 3.0, 6.0)
    "jerk":  (4.2, 6.0),     # m/s3   (original 0.7, 1.0)
    "lat":   (1.20, 2.40),   # g      (original 0.15, 0.30)
    "accel": (0.85, 1.15),   # unchanged
    "brake": (0.85, 1.05),   # unchanged
}
EDGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "edge"))
p = os.environ.get("ITMS_DASHBOARD_PATH", os.path.join(EDGE_DIR, "dashboard.py"))
s = open(p).read()
for k, (w, a) in TH_NEW.items():
    s, n = re.subn(r'^(\s*"%s":\s*)\([^)]*\)' % k, r'\g<1>(%.2f, %.2f)' % (w, a), s, flags=re.M)
    print(k, "->", "%.2f, %.2f" % (w, a), "(ok)" if n == 1 else "NOT FOUND")
open(p, "w").write(s)
