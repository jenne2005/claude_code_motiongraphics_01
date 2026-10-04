"""v1.8 hook: the bright clip, extended so the kick, the watcher and the ball rising into the sky read.

Source 14-33 plays at normal speed, then the kick-and-whip eases into slow motion (speed 1.0 -> 0.55,
motion-compensated in-between frames) until the ball is up in the sky (source frame 52); the cut lands there.
Usage: python3 scripts/hook_v18.py   -> reel/public/hook18/fNNN.png, updates out/hook-analysis.json
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hook_v16 as analysis  # noqa: E402
import hook_v17 as bright  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "reel/public/hook18"
START, SLOW_FROM, END_SRC = 14, 33, 52
SLOW, RAMP = 0.55, 8  # slow-motion speed, frames to ease into it


def source_times():
    """Fractional source frame for each timeline frame before the cut."""
    t, s = [], float(START)
    tl = 0
    while s < END_SRC:
        t.append(s)
        if s < SLOW_FROM:
            v = 1.0
        else:
            k = min(1.0, (tl - (SLOW_FROM - START)) / RAMP)
            v = 1.0 + (SLOW - 1.0) * k * k * (3 - 2 * k)
        s += v
        tl += 1
    return t


def between(a, b, w):
    """Motion-compensated in-between frame (DIS optical flow, warp both ways, blend)."""
    if w < 1e-3:
        return a
    ga, gb = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY), cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    fab = dis.calc(ga, gb, None)
    fba = dis.calc(gb, ga, None)
    h, wd = ga.shape
    gx, gy = np.meshgrid(np.arange(wd, dtype=np.float32), np.arange(h, dtype=np.float32))
    wa = cv2.remap(a, gx - fab[..., 0] * w, gy - fab[..., 1] * w, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    wb = cv2.remap(b, gx - fba[..., 0] * (1 - w), gy - fba[..., 1] * (1 - w), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return cv2.addWeighted(wa, 1 - w, wb, w, 0)


def main():
    frames = analysis.read_frames()
    times = source_times()
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("f*.png"):
        old.unlink()
    for tl, s in enumerate(times):
        i = int(np.floor(s))
        img = between(frames[i], frames[min(i + 1, len(frames) - 1)], s - i)
        cv2.imwrite(str(OUT / f"f{tl:03d}.png"), bright.pop(img))
    cut = len(times)
    a = json.loads((ROOT / "out/hook-analysis.json").read_text())
    a["edit_v18"] = {
        "timeline0_source_frame": START,
        "normal_speed_source_frames": [START, SLOW_FROM],
        "slow_motion": {"from_source_frame": SLOW_FROM, "speed": SLOW, "ease_in_frames": RAMP, "interpolation": "DIS optical flow, motion-compensated"},
        "cut_source_frame": END_SRC,
        "cut_timeline_frame": cut,
        "cut_timeline_s": round(cut / 30, 3),
        "why": "longer hook: the kick, the watcher and the ball rising into the sky stay on screen",
    }
    (ROOT / "out/hook-analysis.json").write_text(json.dumps(a, indent=1))
    print("timeline frames before the cut:", cut, f"({cut / 30:.2f} s)")


if __name__ == "__main__":
    main()
