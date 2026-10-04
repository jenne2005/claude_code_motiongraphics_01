"""v2.0 hook: the original clip, untouched. Source frames 0-83 at real speed (no grade, no slow motion,
no interpolation, no zoom), saved losslessly as PNG; the cut lands at 2.8 s as the camera leaves the turbine.
Usage: python3 scripts/hook_v20.py   -> reel/public/hook20/fNNN.png, updates out/hook-analysis.json
"""
import json
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parent.parent
CLIP = ROOT / "assets/hooks/Man_Kicks_Ball_Beside_Wind_Turbine.mp4"
OUT = ROOT / "reel/public/hook20"
START, END_SRC = 0, 84

cap = cv2.VideoCapture(str(CLIP))
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("f*.png"):
    old.unlink()
for tl, i in enumerate(range(START, END_SRC)):
    cv2.imwrite(str(OUT / f"f{tl:03d}.png"), frames[i], [cv2.IMWRITE_PNG_COMPRESSION, 1])
a = json.loads((ROOT / "out/hook-analysis.json").read_text())
cut = END_SRC - START
a["edit_v20"] = {"timeline0_source_frame": START, "cut_source_frame": END_SRC, "cut_timeline_frame": cut, "cut_timeline_s": round(cut / 30, 3),
                 "source_times": list(range(START, END_SRC)), "speed": "real time, original pixels"}
(ROOT / "out/hook-analysis.json").write_text(json.dumps(a, indent=1))
print("cut at timeline frame", cut)
