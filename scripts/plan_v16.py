"""v1.6 timing plan: scene cuts on the 104 BPM eighth-note grid, lengths driven by the voice.

Usage: python3 scripts/plan_v16.py   -> reel/src/v16/plan.json (read by the composition and audio_v16.py)
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS = 30
BPM = 104
EIGHTH = 60 / BPM / 2
GROOVE_IN = 2.2  # the groove (and the grid) starts where the hook ends

v1 = {l["id"]: l for l in json.loads((ROOT / "reel/public/audio/vo/vo-timings.json").read_text())["lines"]}
v16 = json.loads((ROOT / "reel/public/audio/v16/vo/vo16.json").read_text())["lines"]
hook = json.loads((ROOT / "out/hook-analysis.json").read_text())

# voice lines in reel order -> (source file, duration, word timings)
VO = {
    "L1": (v1[1]["file"], v1[1]["duration"], v1[1]["words"]),
    "L2": (v16["L2"]["file"], v16["L2"]["duration"], v16["L2"]["words"]),
    "L3": (v1[2]["file"], v1[2]["duration"], v1[2]["words"]),
    "L4": (v1[3]["file"], v1[3]["duration"], v1[3]["words"]),
    "L5": (v1[4]["file"], v1[4]["duration"], v1[4]["words"]),
    "L6": (v1[5]["file"], v1[5]["duration"], v1[5]["words"]),
    "L7": (v1[6]["file"], v1[6]["duration"], v1[6]["words"]),
    "L8": (v1[7]["file"], v1[7]["duration"], v1[7]["words"]),
    "L9": (v16["L9"]["file"], v16["L9"]["duration"], v16["L9"]["words"]),
}


def snap_len(sec, minimum):
    """Round a scene length up to whole eighth notes so every cut lands on the grid."""
    return max(math.ceil(sec / EIGHTH - 1e-6), minimum) * EIGHTH


def F(t):
    return int(round(t * FPS))


cut_frame = hook["edit"]["cut_timeline_frame"]
scenes = []
t = 0.0
scenes.append(("hook", 0.0, GROOVE_IN))
t = GROOVE_IN
vo_at = {"L1": round(cut_frame / FPS - 0.167, 3)}  # J-cut: 5 frames before the cut
l1_end = vo_at["L1"] + VO["L1"][1]
vo_at["L2"] = round(max(l1_end + 0.08, t + 0.6), 3)
loc_end = GROOVE_IN + snap_len(vo_at["L2"] + VO["L2"][1] + 0.08 - GROOVE_IN, 1)
scenes.append(("location", t, loc_end))
t = loc_end
for sid, line, n in [("shawarma", "L3", 11), ("burgers", "L4", 11), ("sandwiches", "L5", 11), ("kebabs", "L6", 10), ("fries", "L7", 8), ("finally", "L8", 9)]:
    vo_at[line] = round(t + 0.15, 3)
    length = snap_len(0.15 + VO[line][1] + 0.05, n)
    scenes.append((sid, t, t + length))
    t += length
vo_at["L9"] = round(t + 0.1, 3)
end = vo_at["L9"] + VO["L9"][1] + 0.45  # sign-off, then a near-silent loop beat
scenes.append(("outro", t, end))
total_frames = F(end)

S = {sid: {"from": F(a), "to": F(b)} for sid, a, b in scenes}
S["outro"]["to"] = total_frames

# price locks (frames relative to scene start) and per-scene beats
food_beats = {"flavours": [F(0.25), F(0.15)], "lock": F(1.35), "meal": F(1.85)}
price_locks = {k: S[k]["from"] + food_beats["lock"] for k in ("shawarma", "burgers", "sandwiches")}
kebab = {"title": F(0.05), "names": [F(0.35) + i * F(0.25) for i in range(4)], "rumali": F(1.35)}
price_locks["kebabs"] = S["kebabs"]["from"] + kebab["names"][0]
fries = {"classic": F(0.35), "mayo": F(0.85)}
price_locks["fries"] = S["fries"]["from"] + fries["classic"]

# captions: 2-3 words, matched to each line's word timings; only where no on-screen text says it already
CHUNKS = {
    "L3": [["SHAWARMA."], ["FROM", "ONE", "TWENTY-NINE."]],
    "L4": [["BURGERS."], ["FROM", "ONE", "NINETEEN."]],
    "L5": [["SANDWICHES."], ["FROM", "ONE", "OH NINE."]],
    "L6": [["KEBABS."], ["TWELVE", "WAYS"], ["TO", "CRAVE."]],
    "L7": [["FRIES."], ["SEVENTY-NINE."]],
}
KEY = {"SHAWARMA.": "SHAWARMA.", "BURGERS.": "BURGERS.", "SANDWICHES.": "SANDWICHES.", "KEBABS.": "KEBABS.", "CRAVE.": "CRAVE.", "FRIES.": "FRIES."}
captions = []
for line, chunks in CHUNKS.items():
    words = VO[line][2]
    i = 0
    for ch in chunks:
        n = sum(len(c.split()) for c in ch)  # number of spoken words in this chunk
        start = vo_at[line] + words[i]["start"]
        end_w = words[min(i + n, len(words)) - 1]["end"]
        nxt = words[i + n]["start"] if i + n < len(words) else end_w + 0.25
        text = " ".join(ch)
        captions.append({"text": text, "key": next((KEY[w] for w in text.split() if w in KEY), None), "from": F(start), "to": F(vo_at[line] + max(end_w + 0.12, nxt))})
        i += n

plan = {
    "fps": FPS,
    "frames": total_frames,
    "seconds": round(total_frames / FPS, 3),
    "bpm": BPM,
    "grid": {"origin_s": GROOVE_IN, "eighth_s": round(EIGHTH, 5)},
    "hook": {
        "cut": cut_frame,
        "clipFrames": cut_frame,
        "onFire": cut_frame + 6,
        "kickTimelineS": hook["edit"]["kick_transient_timeline_s"],
        "flowPxPerFrame": hook["flow_peak"]["dy_px_per_frame_1080x1920"],
        "flowDxPxPerFrame": round(hook["flow_peak"]["dx_px_per_frame_180x320"] * 6, 1),
    },
    "scenes": S,
    "vo": {k: {"file": VO[k][0], "at": vo_at[k], "duration": VO[k][1]} for k in VO},
    "food": food_beats,
    "kebab": kebab,
    "fries": fries,
    "priceLocks": price_locks,
    "captions": captions,
    "locationTag": [S["shawarma"]["from"], S["outro"]["from"]],
}
(ROOT / "reel/src/v16/plan.json").write_text(json.dumps(plan, indent=1))
print(json.dumps({k: plan[k] for k in ("frames", "seconds", "scenes", "priceLocks")}, indent=1))
print({k: v["at"] for k, v in plan["vo"].items()})
