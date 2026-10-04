"""v1.9 timing plan: cuts on the 104 BPM eighth-note grid, scene lengths from the real voice.

Usage: python3 scripts/plan_v19.py   -> reel/src/v19/plan.json
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS, BPM = 30, 104
EIGHTH = 60 / BPM / 2
HOOK_END = None  # set from the extended hook below
v19 = json.loads((ROOT / "reel/public/audio/v19/vo/vo19.json").read_text())["lines"]
hook = json.loads((ROOT / "out/hook-analysis.json").read_text())

VO = {k: (v19[k]["file"], v19[k]["duration"], v19[k]["words"]) for k in ("L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9")}
F = lambda t: int(round(t * FPS))
snap = lambda sec, n: max(math.ceil(sec / EIGHTH - 1e-6), n) * EIGHTH

cut = hook["edit_v18"]["cut_timeline_frame"]
HOOK_END = round(cut / FPS + 1.1, 3)  # "ON FIRE." gets ~0.9 s after the cut
vo_at = {"L1": round(cut / FPS - 0.167, 3)}  # J-cut, 5 frames before the cut
vo_at["L2"] = round(vo_at["L1"] + VO["L1"][1] + 0.04, 3)
scenes = [("hook", 0.0, HOOK_END)]
loc_end = HOOK_END + snap(vo_at["L2"] + VO["L2"][1] + 0.05 - HOOK_END, 1)
scenes.append(("location", HOOK_END, loc_end))
t = loc_end
for sid, line, n in [("shawarma", "L3", 10), ("burgers", "L4", 10), ("sandwiches", "L5", 10), ("kebabs", "L6", 10), ("fries", "L7", 7), ("finally", "L8", 8)]:
    vo_at[line] = round(t + 0.12, 3)
    length = snap(0.12 + VO[line][1] + 0.04, n)
    scenes.append((sid, t, t + length))
    t += length
vo_at["L9"] = round(t + 0.1, 3)
end = vo_at["L9"] + VO["L9"][1] + 0.45
scenes.append(("outro", t, end))
S = {sid: {"from": F(a), "to": F(b)} for sid, a, b in scenes}
total = F(end)
S["outro"]["to"] = total

# the price locks as the voice starts "one ..." (averaged over the three food lines, 2 frames early)
one_at = sum(0.12 + VO[l][2][2]["start"] for l in ("L3", "L4", "L5")) / 3
food = {"flavours": [F(0.2), 0], "lock": F(one_at) - 2, "meal": F(one_at) - 2 + F(0.45)}
locks = {k: S[k]["from"] + food["lock"] for k in ("shawarma", "burgers", "sandwiches")}
kebab = {"names": [F(0.3) + i * F(0.2) for i in range(4)], "rumali": F(1.15)}
locks["kebabs"] = S["kebabs"]["from"] + kebab["names"][0]
fries = {"classic": F(0.3), "mayo": F(0.75)}
locks["fries"] = S["fries"]["from"] + fries["classic"]

CHUNKS = {
    "L3": [["SHAWARMA."], ["FROM", "ONE", "TWENTY-NINE."]],
    "L4": [["BURGERS."], ["FROM", "ONE", "NINETEEN."]],
    "L5": [["SANDWICHES."], ["FROM", "ONE", "OH NINE."]],
    "L6": [["KEBABS."], ["TWELVE", "WAYS"], ["TO", "CRAVE."]],
    "L7": [["FRIES."], ["SEVENTY-NINE."]],
}
KEY = {"SHAWARMA.", "BURGERS.", "SANDWICHES.", "KEBABS.", "CRAVE.", "FRIES."}
captions = []
for line, chunks in CHUNKS.items():
    words, i = VO[line][2], 0
    for ch in chunks:
        n = sum(len(c.split()) for c in ch)
        start = vo_at[line] + words[i]["start"]
        end_w = words[min(i + n, len(words)) - 1]["end"]
        nxt = words[i + n]["start"] if i + n < len(words) else end_w + 0.25
        text = " ".join(ch)
        captions.append({"text": text, "key": next((w for w in text.split() if w in KEY), None), "from": F(start), "to": F(vo_at[line] + max(end_w + 0.12, nxt))})
        i += n

plan = {
    "fps": FPS, "frames": total, "seconds": round(total / FPS, 3), "bpm": BPM,
    "grid": {"origin_s": HOOK_END, "eighth_s": round(EIGHTH, 5)},
    "hook": {"cut": cut, "clipFrames": cut, "onFire": cut + 6, "flowPxPerFrame": hook["flow_peak"]["dy_px_per_frame_1080x1920"]},
    "scenes": S,
    "vo": {k: {"file": VO[k][0], "at": vo_at[k], "duration": VO[k][1], "words": VO[k][2]} for k in VO},
    "food": food, "kebab": kebab, "fries": fries, "priceLocks": locks, "captions": captions,
    "locationTag": [S["shawarma"]["from"], S["outro"]["from"]],
}
(ROOT / "reel/src/v19/plan.json").write_text(json.dumps(plan, indent=1, default=float))
print(plan["frames"], plan["seconds"], {k: (v["from"], v["to"]) for k, v in S.items()}, locks)
print({k: v for k, v in vo_at.items()})
