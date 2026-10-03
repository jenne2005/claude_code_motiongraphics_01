"""ReelV4 audio: caption timings, 108 BPM A-minor score, SFX, sidechain mix, -14 LUFS master (A/B/C).

Usage: python3 scripts/audio_v4.py
Reads   reel/src/v4/plan.json, reel/public/audio/v4/vo/*.wav
Writes  reel/src/v4/captions.json, reel/public/audio/v4/music.wav, reel/public/audio/v4/mix-{A,B,C}.wav
All synthesised (numpy/scipy/pedalboard). Instruments are shared with scripts/audio_v2.py.
"""
import json
import sys
from pathlib import Path

import numpy as np
from pedalboard import Compressor, HighpassFilter, Pedalboard, PeakFilter, Reverb

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audio_v2 as K  # noqa: E402  (instrument + mix helpers)

ROOT = Path(__file__).resolve().parent.parent
PLAN = json.loads((ROOT / "reel/src/v4/plan.json").read_text())
VO = ROOT / "reel/public/audio/v4/vo"
OUT = ROOT / "reel/public/audio/v4"
SR = K.SR
FPS = PLAN["fps"]
DUR = PLAN["frames"] / FPS
N = int(round(DUR * SR))
BEAT = 60 / PLAN["bpm"]
G0 = PLAN["gridOrigin"]
CUT = {k: v / FPS for k, v in PLAN["cuts"].items()}
rng = np.random.default_rng(404)


def S(t):
    return int(round(t * SR))


def place(buf, x, t, g=1.0):
    i = S(t)
    if i >= len(buf) or i < 0:
        return
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i] * g


def ramp(x, a, b):
    return x * np.linspace(a, b, len(x))


def bt(n):
    return G0 + n * BEAT


# ------------------------------------------------------------------ captions
def captions():
    """Proportional split by characters, each chunk start snapped to the nearest energy valley."""
    meta = json.loads((VO / "vo.json").read_text())["lines"]
    per_line = {}
    for key, chunks in PLAN["captions"].items():
        x = K.read_wav(VO / f"{key}.wav")
        d = len(x) / SR
        env = K.valleys(x, SR)
        lens = [len(c[0]) for c in chunks]
        starts, acc = [], 0
        for i, L in enumerate(lens):
            est = 0.08 + (d - 0.16) * acc / sum(lens)
            if i:
                lo, hi = S(max(0, est - 0.14)), S(min(d, est + 0.14))
                est = (lo + int(np.argmin(env[lo:hi]))) / SR if hi > lo else est
            starts.append(est)
            acc += L
        per_line[key] = [(c[0], c[1], s, starts[i + 1] if i + 1 < len(starts) else d) for i, (c, s) in enumerate(zip(chunks, starts))]
    out = {}
    for v, lines in PLAN["vo"].items():
        out[v] = []
        for key, t0 in lines:
            for text, kw, s, e in per_line.get(key, []):
                out[v].append({"text": text, "key": kw, "start": round(t0 + s, 3), "end": round(t0 + e + 0.12, 3), "line": key})
    (ROOT / "reel/src/v4/captions.json").write_text(json.dumps(out, indent=1))
    return out


# ------------------------------------------------------------------ score
CHORDS = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]  # Am F C G
ARP = [0, 2, 1, 2, 0, 1, 2, 1]


def groove(mus, t_from, t_to, vel=1.0, chord_shift=0):
    n = int(np.ceil((t_from - G0) / BEAT - 1e-6))
    while bt(n) < t_to - 1e-3:
        t = bt(n)
        bar, b = divmod(n, 4)
        root, tones = CHORDS[(bar + chord_shift) % 4]
        place(mus, K.kick(0.9 if b == 0 else 0.72), t, vel)
        place(mus, K.hat(0.8), t + BEAT / 2, vel)
        if b == 0:
            place(mus, K.sub(root - 24, BEAT * 3.8, 0.55), t, vel)
            place(mus, K.pad([m + 12 for m in tones], BEAT * 4, 0.24), t, vel)
        for e in range(2):
            step = b * 2 + e
            if t + e * BEAT / 2 >= t_to:
                break
            m = tones[ARP[step]] + 12 + (12 if step >= 4 and ARP[step] == 0 else 0)
            place(mus, K.pluck(m, 0.34, 0.3), t + e * BEAT / 2, vel)
        n += 1


def bass_drop(dur=1.2):
    """808-style sub that slides down: the pattern interrupt."""
    t = K.tt(dur)
    f = 110 * np.exp(-t * 2.2) + 38
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    return np.tanh(x * 2.2) / np.tanh(2.2)


def score():
    mus = np.zeros(N)
    logo, interrupt = CUT["logo"], PLAN["interrupt"] / FPS
    bundle, cheat, end = CUT["bundle"], CUT["cheat"], CUT["end"]
    meals_hit = PLAN["prices"]["meals"]["lock"] / FPS
    # intro: sparse sub + soft ticks, riser into the groove
    place(mus, ramp(K.sub(33, logo, 0.4), 0.35, 1), 0)
    n = int(np.floor(-G0 / BEAT))
    while bt(n) < logo:
        if bt(n) >= 0.2:
            place(mus, K.tick(0.5), bt(n))
        n += 1
    place(mus, K.noise_riser(1.2, 400, 7000) * 0.22, logo - 1.2)
    # groove from the logo, hard cut + bass drop at the interrupt, groove resumes
    groove(mus, logo, interrupt - 0.02)
    place(mus, bass_drop(), interrupt, 0.9)
    groove(mus, interrupt + BEAT, bundle - 0.55)
    # half-bar drop (near silence) into the swell at the bundle, building to the meals hit
    swell = meals_hit - bundle
    place(mus, K.noise_riser(swell + 0.55, 200, 9000) * 0.42, bundle - 0.55)
    place(mus, ramp(K.sub(33, swell, 0.3), 0.2, 1), bundle)
    groove(mus, bundle, meals_hit - 0.02, vel=0.8)
    groove(mus, meals_hit, cheat - 0.02, vel=1.1)
    # stripped pad + sub so the cheat line lands
    place(mus, K.pad([57, 60, 64, 69], cheat_len := end - cheat + 0.3, 0.34), cheat)
    place(mus, K.sub(33, cheat_len - 0.3, 0.45), cheat)
    # end card: soft pad, near-silent final 0.4 s
    place(mus, K.pad([57, 64, 69], DUR - end - 0.4, 0.22), end)
    board = Pedalboard([HighpassFilter(30), Reverb(room_size=0.35, wet_level=0.12, dry_level=0.95, width=0.9),
                        Compressor(threshold_db=-18, ratio=2.0, attack_ms=10, release_ms=150)])
    st = board(np.stack([mus, mus]).astype(np.float32), SR)
    fade = np.ones(N)
    a = S(DUR - 0.4)
    fade[a:] = np.linspace(1, 0.02, N - a)
    # hard cut on the interrupt: 4 frames of silence before the drop
    i0, i1 = S(interrupt - 4 / FPS), S(interrupt)
    fade[i0:i1] = 0.0
    return st * fade


# ------------------------------------------------------------------ SFX
def record_scratch(dur=0.75):
    t = K.tt(dur)
    wob = np.sin(2 * np.pi * (3 + 9 * t / dur) * t)
    f = 300 + 1800 * (t / dur) ** 1.5 + 250 * wob
    x = K.filt(rng.standard_normal(len(t)), "bandpass", [500, 4000]) * 0.4 + np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.6
    return x * (t / dur) ** 1.4 * (1 - np.exp(-(dur - t) * 40))


def sfx():
    fx = np.zeros(N)
    place(fx, K.sizzle(0.8), 0.0, 0.8)
    place(fx, record_scratch(0.8), CUT["stamp"] - 0.82, 0.55)
    place(fx, K.stamp_thump(), CUT["stamp"], 1.0)
    for w in PLAN["whooshes"][:6]:
        place(fx, K.whoosh(0.25), w / FPS - 0.16, 0.8)
    for name, p in PLAN["prices"].items():
        if p["bass"]:
            place(fx, K.bass_hit(big=p["bass"] == "big"), p["lock"] / FPS, 1.0 if p["bass"] == "big" else 0.7)
    place(fx, K.ember_tick(), DUR - 0.14, 0.6)
    return fx


# ------------------------------------------------------------------ mix
VO_GAIN_DB = {"L1A": -6.0, "L1B": -6.0, "L1C": -6.0, "L2": -5.0, "L3": -2.0, "L5": 2.0, "L6": -4.0, "L7": -3.0}


def vo_track(v):
    x = np.zeros(N)
    for key, t0 in PLAN["vo"][v]:
        place(x, K.read_wav(VO / f"{key}.wav"), t0, 10 ** (VO_GAIN_DB.get(key, 0.0) / 20))
    return x


def section_gain():
    c = CUT
    hit = PLAN["prices"]["meals"]["lock"] / FPS
    pts = [(0, 0.3), (c["logo"] - 0.05, 0.42), (c["logo"], 0.9), (c["bundle"], 0.9), (c["bundle"] + 0.05, 0.75),
           (hit, 1.7), (c["cheat"] - 0.05, 1.7), (c["cheat"], 0.45), (DUR, 0.45)]
    t = np.arange(N) / SR
    return np.interp(t, [p[0] for p in pts], [p[1] for p in pts])


if __name__ == "__main__":
    caps = captions()
    print("caption chunks:", {k: len(v) for k, v in caps.items()})
    mus = score()
    mus = K.gain_to(mus, -20.0, OUT / "music.wav")
    K.write(OUT / "music.wav", mus)
    print("music:", K.lufs(OUT / "music.wav"))
    mus_c = Pedalboard([PeakFilter(cutoff_frequency_hz=3000, gain_db=-5, q=0.9)])(mus.astype(np.float32), SR)
    fx = sfx()
    sg = section_gain()
    for v in ("A", "B", "C"):
        vo = vo_track(v)
        duck = K.duck_env(vo, depth_db=9, attack=0.015, release=0.25)
        fx_s = fx / max(np.abs(fx).max(), 1e-9) * np.abs(vo).max() * 10 ** (-6.5 / 20)
        mix = mus_c * (duck * sg)[None, :] + vo[None, :] + fx_s[None, :]
        print(f"mix-{v}:", K.master(mix, OUT / f"mix-{v}.wav"))
