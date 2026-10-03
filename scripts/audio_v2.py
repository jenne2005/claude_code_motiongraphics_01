"""v2 audio: caption timings, 108 BPM A-minor score, SFX, sidechain mix and master.

Usage: python3 scripts/audio_v2.py
Reads   reel/src/v2/plan.json, reel/public/audio/vo2/*.wav
Writes  reel/src/v2/captions.json           caption chunks (absolute seconds, per variant)
        reel/public/audio/v2/music.wav      score stem (-20 LUFS on its own)
        reel/public/audio/v2/mix-A.wav      mastered mix, hook A
        reel/public/audio/v2/mix-B.wav      mastered mix, hook B
Everything is synthesised here (numpy/scipy + pedalboard): no samples, no downloads.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from pedalboard import Compressor, HighpassFilter, Limiter, LowpassFilter, PeakFilter, Pedalboard, Reverb
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
PLAN = json.loads((ROOT / "reel/src/v2/plan.json").read_text())
VO_DIR = ROOT / "reel/public/audio/vo2"
OUT = ROOT / "reel/public/audio/v2"
SR = 48000
DUR = PLAN["duration"]
N = int(round(DUR * SR))
BEAT = 60 / PLAN["bpm"]
G0 = PLAN["gridOrigin"]
C = PLAN["cuts"]
rng = np.random.default_rng(108)


def S(t):
    return int(round(t * SR))


def tt(sec):
    return np.arange(int(sec * SR)) / SR


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, kind, fs=SR, output="sos"), x)


def place(buf, x, t, gain=1.0):
    i = S(t)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    if i < 0:
        x, i = x[-i:], 0
        j = min(len(buf), len(x))
    buf[i:j] += x[: j - i] * gain


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def read_wav(p):
    sr, x = wavfile.read(str(p))
    x = x.astype(np.float32) / 32768
    if x.ndim > 1:
        x = x.mean(1)
    if sr != SR:
        from scipy.signal import resample_poly

        x = resample_poly(x, SR, sr)
    return x


# ------------------------------------------------------------------ captions
CHUNKS = {
    "L3": [("NEAR TCS,", None), ("ADIBATLA...", "ADIBATLA..."), ("A GRILL IS AWAKE.", "AWAKE.")],
    "L4a": [("SMOKY SHAWARMAS.", "SMOKY")],
    "L4b": [("STACKED BURGERS.", "STACKED")],
    "L4c": [("KEBABS STRAIGHT", None), ("OFF THE FLAME.", "FLAME.")],
    "L5": [("MEALS FROM", None), ("ONE SEVENTY-NINE,", "SEVENTY-NINE,"), ("FRIES AND A", None), ("DRINK INCLUDED.", "INCLUDED.")],
}


def valleys(x, sr):
    w = int(0.015 * sr)
    return np.convolve(np.abs(x), np.ones(w) / w, "same")


def caption_timings():
    """Split each line into chunks by character count, then snap each start to a low-energy valley."""
    out = {}
    for key, chunks in CHUNKS.items():
        x = read_wav(VO_DIR / f"{key}.wav")
        d = len(x) / SR
        env = valleys(x, SR)
        lens = [len(c[0]) for c in chunks]
        starts, acc = [], 0
        for i, L in enumerate(lens):
            est = d * acc / sum(lens)
            if i > 0:
                lo, hi = S(max(0, est - 0.14)), S(min(d, est + 0.14))
                est = (lo + int(np.argmin(env[lo:hi]))) / SR if hi > lo else est
            starts.append(round(est, 3))
            acc += L
        out[key] = [{"text": c[0], "key": c[1], "start": s, "end": round(starts[i + 1] if i + 1 < len(starts) else d, 3)} for i, (c, s) in enumerate(zip(chunks, starts))]
    caps = {}
    for v, lines in PLAN["vo"].items():
        caps[v] = []
        for key, t0 in lines:
            for c in out.get(key, []):
                if key in PLAN["captioned"]:
                    caps[v].append({**c, "start": round(t0 + c["start"], 3), "end": round(t0 + c["end"] + 0.15, 3), "line": key})
    (ROOT / "reel/src/v2/captions.json").write_text(json.dumps(caps, indent=1))
    return caps


# ------------------------------------------------------------------ instruments
def kick(vel=1.0):
    t = tt(0.42)
    f = 48 + 75 * np.exp(-t * 32)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    x += filt(rng.standard_normal(len(t)), "lowpass", 1200) * np.exp(-t * 90) * 0.12
    return x * np.minimum(1, t / 0.002) * vel


def hat(vel=1.0):
    t = tt(0.07)
    return filt(rng.standard_normal(len(t)), "highpass", 7500, 4) * np.exp(-t * 70) * 0.35 * vel


def tick(vel=1.0):
    t = tt(0.05)
    return (np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 160) + filt(rng.standard_normal(len(t)), "highpass", 5000) * np.exp(-t * 300) * 0.4) * vel * 0.4


def pluck(m, dur=0.42, vel=1.0):
    """Karplus-Strong pluck: clean, modern, slightly woody."""
    f = hz(m)
    n = int(dur * SR)
    p = int(SR / f)
    buf = rng.uniform(-1, 1, p)
    buf = filt(buf, "lowpass", 3500)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    env = np.minimum(1, np.arange(n) / (0.003 * SR))
    return out * env * vel


def sub(m, dur, vel=1.0):
    t = tt(dur)
    x = np.sin(2 * np.pi * hz(m) * t) + 0.12 * np.sin(2 * np.pi * 2 * hz(m) * t)
    env = np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.06)
    return x * env * vel


def pad(notes, dur, vel=1.0):
    t = tt(dur)
    x = np.zeros(len(t))
    for m in notes:
        for d in (-0.08, 0.0, 0.09):
            f = hz(m) * 2 ** (d / 12)
            x += (2 * ((t * f + rng.uniform()) % 1) - 1) * 0.12
    x = filt(x, "lowpass", 900, 4)
    env = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.5)
    return x * env * vel


def noise_riser(dur, f0=300, f1=6000):
    t = tt(dur)
    x = rng.standard_normal(len(t))
    out = np.zeros_like(x)
    blk = 512
    for i in range(0, len(x), blk):
        k = i / len(x)
        f = f0 * (f1 / f0) ** k
        out[i:i + blk] = filt(x[i:i + blk + 2000], "bandpass", [f * 0.7, min(f * 1.4, 20000)])[:len(x[i:i + blk])]
    return out * (t / dur) ** 2.2


# ------------------------------------------------------------------ score
CHORDS = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]  # Am F C G (roots as MIDI)
ARP = [0, 2, 1, 2, 0, 1, 2, 1]  # 8-note pattern over chord tones (+octave on 2nd half)


def beat_time(n):
    return G0 + n * BEAT


def score():
    mus = np.zeros(N)
    # 0 - 3.6: sparse sub + soft tick + riser into 3.6
    place(mus, sub(33, 3.6, 0.45) * np.linspace(0.3, 1, S(3.6)), 0)
    n = -6
    while beat_time(n) < G0:
        if beat_time(n) >= 0:
            place(mus, tick(0.6), beat_time(n))
        n += 1
    place(mus, noise_riser(1.6, 400, 7000) * 0.25, G0 - 1.6)
    # 3.6 - 15.8: groove
    end_groove = C["bundle"]
    n = 0
    while beat_time(n) < end_groove - 1e-3:
        t = beat_time(n)
        bar, b = divmod(n, 4)
        root, tones = CHORDS[(bar // 1) % 4]
        place(mus, kick(0.9 if b == 0 else 0.75), t)
        place(mus, hat(0.8), t + BEAT / 2)
        if b == 0:
            place(mus, sub(root - 24, BEAT * 3.8, 0.55), t)
            place(mus, pad([m + 12 for m in tones], BEAT * 4, 0.25), t)
        for e in range(2):  # 8th-note arpeggio
            step = b * 2 + e
            m = tones[ARP[step]] + 12 + (12 if step >= 4 and ARP[step] == 0 else 0)
            place(mus, pluck(m, 0.36, 0.32), t + e * BEAT / 2)
        n += 1
    # 15.8: half-bar drop (near silence), then the biggest swell into the bundle hit
    place(mus, noise_riser(C["bundleHit"] - C["bundle"], 200, 9000) * 0.5, C["bundle"])
    place(mus, sub(33, C["bundleHit"] - C["bundle"], 0.25) * np.linspace(0.2, 1, S(C["bundleHit"] - C["bundle"])), C["bundle"])
    # bundle groove (fuller) until the cheat line
    n = int(round((C["bundleHit"] - G0) / BEAT))
    while beat_time(n) < C["cheat"] - 1e-3:
        t = beat_time(n)
        b = n % 4
        place(mus, kick(1.0), t)
        place(mus, hat(1.0), t + BEAT / 2)
        if (n - int(round((C["bundleHit"] - G0) / BEAT))) % 4 == 0:
            place(mus, sub(33, BEAT * 3.8, 0.65), t)
            place(mus, pad([69, 72, 76, 81], BEAT * 4, 0.32), t)
        for e in range(2):
            step = b * 2 + e
            place(mus, pluck([69, 72, 76][ARP[step]] + 12, 0.34, 0.34), t + e * BEAT / 2)
        n += 1
    # 19 - 21.8: strip back to pad + sub so the line lands
    seg = C["end"] - C["cheat"]
    place(mus, pad([57, 60, 64, 69], seg + 0.2, 0.35), C["cheat"])
    place(mus, sub(33, seg, 0.5), C["cheat"])
    # end card: soft pad tail, then near-silence in the last 0.4 s
    place(mus, pad([57, 64, 69], C["loop"] - C["end"], 0.22), C["end"])
    # FX bus on the music: gentle glue + room
    board = Pedalboard([HighpassFilter(30), Reverb(room_size=0.35, wet_level=0.12, dry_level=0.95, width=0.9),
                        Compressor(threshold_db=-18, ratio=2.0, attack_ms=10, release_ms=150)])
    st = board(np.stack([mus, mus]).astype(np.float32), SR)
    # last 0.4 s: fade to near-silence for the loop beat
    fade = np.ones(N)
    a = S(DUR - 0.4)
    fade[a:] = np.linspace(1, 0.03, N - a)
    return st * fade


# ------------------------------------------------------------------ SFX
def whoosh(dur=0.25):
    t = tt(dur)
    x = rng.standard_normal(len(t))
    pk = 0.6
    env = np.where(t < dur * pk, (t / (dur * pk)) ** 2, np.exp(-(t - dur * pk) * 22))
    lo = filt(x, "bandpass", [500, 2500]) * env
    hi = filt(x, "bandpass", [2500, 9000]) * env * (t / dur)
    return (lo + hi * 0.7) * 1.2


def bass_hit(big=False):
    t = tt(1.4 if big else 0.9)
    f = 55 + 60 * np.exp(-t * 35)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (2.2 if big else 3.5))
    x += np.sin(2 * np.pi * 2500 * t) * np.exp(-t * 900) * 0.35  # click
    if big:
        x += filt(rng.standard_normal(len(t)), "lowpass", 400) * np.exp(-t * 6) * 0.35
    return np.tanh(x * 1.6) / np.tanh(1.6)


def stamp_thump():
    t = tt(0.45)
    body = np.sin(2 * np.pi * np.cumsum(90 + 80 * np.exp(-t * 60)) / SR) * np.exp(-t * 14)
    slap = filt(rng.standard_normal(len(t)), "bandpass", [300, 3000]) * np.exp(-t * 55) * 0.8
    return body + slap


def sizzle(dur=0.9):
    t = tt(dur)
    x = filt(rng.standard_normal(len(t)), "highpass", 3800, 3)
    pops = np.zeros(len(t))
    for _ in range(int(dur * 160)):
        i = rng.integers(0, len(t) - 300)
        L = rng.integers(40, 260)
        pops[i:i + L] += rng.uniform(0.3, 1) * np.exp(-np.arange(L) / (L / 4))
    env = np.minimum(1, t / 0.01) * np.exp(-t * 2.2)
    return x * (0.35 + pops) * env


def boom_reverse(dur_tail):
    t = tt(1.6)
    boom = np.sin(2 * np.pi * np.cumsum(45 + 40 * np.exp(-t * 20)) / SR) * np.exp(-t * 2.5)
    boom = np.tanh(boom * 1.5)
    rev = Pedalboard([Reverb(room_size=0.9, wet_level=1.0, dry_level=0.0)])(
        np.stack([filt(rng.standard_normal(S(0.4)), "bandpass", [300, 5000]) * np.exp(-tt(0.4) * 10)] * 2).astype(np.float32), SR)[0]
    tail = np.zeros(S(dur_tail))
    r = rev[: len(tail)][::-1] if len(rev) >= len(tail) else np.pad(rev, (len(tail) - len(rev), 0))[::-1]
    tail[: len(r)] = r[: len(tail)]
    return boom, tail * 0.6


def ember_tick():
    t = tt(0.12)
    return (np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 90) + filt(rng.standard_normal(len(t)), "highpass", 6000) * np.exp(-t * 200) * 0.5) * 0.5


def sfx_bus():
    fx = np.zeros(N)
    place(fx, sizzle(0.9), 0.0, 0.8)
    place(fx, stamp_thump(), C["stamp"], 1.0)
    for w in PLAN["whooshes"][:6]:
        place(fx, whoosh(0.25), w - 0.16, 0.8)
    for i, t in enumerate(PLAN["priceLocks"]):
        place(fx, bass_hit(big=(i == len(PLAN["priceLocks"]) - 1)), t, 1.0 if i == 3 else 0.75)
    boom, tail = boom_reverse(DUR - C["end"] - 0.45)
    place(fx, boom, C["end"], 0.9)
    place(fx, tail, C["end"] + 0.2, 0.5)
    place(fx, ember_tick(), DUR - 0.14, 0.6)  # the tick that loops into frame 0's sizzle
    return fx


# ------------------------------------------------------------------ mix
def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    s = r.stderr[r.stderr.rindex("Summary:"):]
    get = lambda k: float(s.split(k)[1].split()[0])
    return get("I:"), get("LRA:"), get("Peak:")


def write(path, st):
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(path), SR, (np.clip(st.T, -1, 1) * 32767).astype(np.int16))


def gain_to(st, target, path):
    write(path, st)
    i, _, _ = lufs(path)
    return st * 10 ** ((target - i) / 20)


# Performance dynamics: an intimate hook, a confident middle, the bundle line pushed, the
# cheat line pulled back. Keeps the loudness range musical (target LRA >= 5 LU).
VO_GAIN_DB = {"L1": -8.5, "L2": -7.0, "B1": -8.0, "L3": -2.0, "L4a": 0.5, "L4b": 0.5, "L4c": 1.0, "L5": 2.0, "L6": -4.5, "L7": -3.5}


def vo_track(variant):
    v = np.zeros(N)
    for key, t0 in PLAN["vo"][variant]:
        place(v, read_wav(VO_DIR / f"{key}.wav"), t0, 10 ** (VO_GAIN_DB.get(key, 0.0) / 20))
    return v


def section_gain():
    """Arrangement-level dynamics for the music bus."""
    pts = [(0, 0.3), (C["logo"] - 0.05, 0.45), (C["logo"], 0.9), (C["bundle"], 0.9), (C["bundle"] + 0.05, 0.7),
           (C["bundleHit"], 1.7), (C["cheat"] - 0.05, 1.7), (C["cheat"], 0.45), (C["end"], 0.45), (DUR, 0.45)]
    t = np.arange(N) / SR
    return np.interp(t, [p[0] for p in pts], [p[1] for p in pts])


def duck_env(vo, depth_db=9, attack=0.015, release=0.25):
    """Sidechain: follow the VO level, duck the music by up to depth_db."""
    w = S(0.01)
    lvl = np.sqrt(np.convolve(vo ** 2, np.ones(w) / w, "same"))
    gate = np.clip((20 * np.log10(lvl + 1e-6) + 45) / 15, 0, 1)  # 0 below -45 dBFS, 1 above -30
    env = np.zeros_like(gate)
    a, r = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    g = 0.0
    for i, x in enumerate(gate):
        c = a if x > g else r
        g = c * g + (1 - c) * x
        env[i] = g
    return 10 ** (-depth_db * env / 20)


def master(st, path):
    tmp = path.with_suffix(".pre.wav")
    write(tmp, st)
    m = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(tmp), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"): m.rindex("}") + 1])
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,alimiter=limit=0.84:attack=1:release=60:level=false")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-af", af, "-ar", str(SR), "-c:a", "pcm_s16le", str(path)], check=True)
    tmp.unlink()
    return lufs(path)


if __name__ == "__main__":
    caps = caption_timings()
    print("captions:", {k: len(v) for k, v in caps.items()})
    mus = score()
    mus = gain_to(mus, -20.0, OUT / "music.wav")
    write(OUT / "music.wav", mus)
    print("music LUFS / LRA / peak:", lufs(OUT / "music.wav"))
    # music bus: carve 2-4 kHz so the voice sits on top
    carve = Pedalboard([PeakFilter(cutoff_frequency_hz=3000, gain_db=-5, q=0.9)])
    mus_c = carve(mus.astype(np.float32), SR)
    fx = sfx_bus()
    for variant in ("A", "B"):
        vo = vo_track(variant)
        duck = duck_env(vo)
        vo_peak = np.max(np.abs(vo))
        fx_scaled = fx / max(np.max(np.abs(fx)), 1e-9) * vo_peak * 10 ** (-6.5 / 20)  # SFX peaks >= 6 dB under VO
        mix = mus_c * (duck * section_gain())[None, :] + vo[None, :] * 1.0 + fx_scaled[None, :] * 1.0
        res = master(mix, OUT / f"mix-{variant}.wav")
        print(f"mix-{variant}: I {res[0]} LUFS, LRA {res[1]} LU, peak {res[2]} dBFS")
