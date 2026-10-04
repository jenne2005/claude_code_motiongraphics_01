"""v1.8 sound: 4 buses (VOICE, MUSIC, SFX, ATMOS) -> master. Everything synthesised (plus the real kick
from the hook clip). Writes out/stems/{voice,music,sfx,atmos}.wav and reel/public/audio/v16/mix.wav.

Usage: python3 scripts/audio_v16.py
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from pedalboard import (Compressor, Delay, Distortion, HighpassFilter, HighShelfFilter, Limiter, LowpassFilter,
                        Pedalboard, PeakFilter, Reverb)
from scipy.io import wavfile
from scipy.signal import butter, resample_poly, sosfilt

ROOT = Path(__file__).resolve().parent.parent
PLAN = json.loads((ROOT / "reel/src/v18/plan.json").read_text())
V1VO = json.loads((ROOT / "reel/public/audio/vo/vo-timings.json").read_text())
STEMS = ROOT / "out/stems"
OUT = ROOT / "reel/public/audio/v18"
SR = 48000
FPS = PLAN["fps"]
DUR = PLAN["frames"] / FPS
N = int(round(DUR * SR))
BPM = PLAN["bpm"]
BEAT = 60 / BPM
SC = {k: (v["from"] / FPS, v["to"] / FPS) for k, v in PLAN["scenes"].items()}
CUT = PLAN["hook"]["cut"] / FPS
rng = np.random.default_rng(16)


# ------------------------------------------------------------------ helpers
def S(t):
    return int(round(t * SR))


def tt(sec):
    return np.arange(max(1, int(sec * SR))) / SR


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, kind, fs=SR, output="sos"), x)


def place(buf, x, t, g=1.0, pan=0.0):
    """Add mono x (or stereo [2,n]) into a stereo bus at time t, with constant-power pan."""
    i = S(t)
    if i >= buf.shape[1]:
        return
    if i < 0:
        x = x[..., -i:]
        i = 0
    if x.ndim == 1:
        a = (pan + 1) * np.pi / 4
        x = np.stack([x * np.cos(a), x * np.sin(a)]) * np.sqrt(2)
    j = min(buf.shape[1], i + x.shape[1])
    buf[:, i:j] += x[:, : j - i] * g


def read(p):
    sr, x = wavfile.read(str(p))
    x = x.astype(np.float32) / 32768
    if x.ndim > 1:
        x = x.mean(1)
    return resample_poly(x, SR, sr) if sr != SR else x


def env_ad(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(d, 1e-4))


def vary(i, amt=0.03):
    """Deterministic +/-3 % variation for repeated cues."""
    r = np.random.default_rng(1000 + i)
    return 1 + r.uniform(-amt, amt), r.uniform(-amt, amt) * 0.05


def pitch(x, k):
    """Resample-based pitch shift by factor k (also changes length slightly, like a varispeed)."""
    if abs(k - 1) < 1e-3:
        return x
    up, down = int(round(1000 / k)), 1000
    return resample_poly(x, up, down)


def stereo(l, r=None):
    return np.stack([l, l if r is None else r])


def write(path, st):
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(path), SR, (np.clip(st.T, -1, 1) * 32767).astype(np.int16))


def measure(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    s = r[r.rindex("Summary:"):]
    g = lambda k: float(s.split(k)[1].split()[0])
    return {"I": g("I:"), "LRA": g("LRA:"), "TP": g("Peak:")}


def lufs_gain(st, target):
    tmp = OUT / "_tmp.wav"
    write(tmp, st)
    i = measure(tmp)["I"]
    tmp.unlink()
    return st * 10 ** ((target - i) / 20)


# ------------------------------------------------------------------ VOICE bus
VO_ORDER = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9"]
# Delivery weight per line: the hook and the menu are forward, the location is intimate, the
# "finally" line and the sign-off are pulled back so the reel breathes (target LRA >= 5 LU).
VO_GAIN_DB = {"L1": 0.0, "L2": -2.0, "L3": 0.0, "L4": 0.0, "L5": 0.0, "L6": 0.0, "L7": 0.0, "L8": -8.5, "L9": -8.5}


def voice_bus():
    v = np.zeros((2, N))
    pre = Pedalboard([
        HighpassFilter(90),
        PeakFilter(cutoff_frequency_hz=6500, gain_db=-3.0, q=2.0),  # gentle de-ess
        Compressor(threshold_db=-20, ratio=2.0, attack_ms=6, release_ms=120),
        Distortion(drive_db=2.0),  # light saturation
    ])
    plate = Pedalboard([Delay(delay_seconds=0.02, feedback=0.0, mix=1.0), HighpassFilter(250), Reverb(room_size=0.38, damping=0.3, wet_level=1.0, dry_level=0.0, width=0.0)])
    for key in VO_ORDER:
        meta = PLAN["vo"][key]
        x = read(ROOT / "reel/public" / meta["file"])
        dry = pre(x[None, :].astype(np.float32), SR)[0]
        wet = plate(dry[None, :].astype(np.float32), SR)[0]
        y = dry + 0.08 * wet / max(np.abs(wet).max(), 1e-9) * np.abs(dry).max()
        place(v, y, meta["at"], 10 ** (VO_GAIN_DB[key] / 20), 0.0)
    v = Pedalboard([Limiter(threshold_db=-1.0, release_ms=60)])(v.astype(np.float32), SR)
    return v / np.abs(v).max() * 10 ** (-6 / 20)  # voice peaks at -6 dBFS


def vo_activity():
    a = np.zeros(N)
    for key in VO_ORDER:
        m = PLAN["vo"][key]
        a[S(m["at"]): S(m["at"] + m["duration"])] = 1
    return a


# ------------------------------------------------------------------ MUSIC bus (104 BPM, A minor)
def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def kick(vel=1.0):
    t = tt(0.38)
    f = 46 + 70 * np.exp(-t * 34)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)
    return filt(x * vel, "lowpass", 900)  # soft, low-passed


def hat(vel=1.0):
    t = tt(0.05)
    return filt(rng.standard_normal(len(t)), "highpass", 8000, 4) * np.exp(-t * 90) * 0.18 * vel


def pluck(m, cutoff, vel=1.0, dur=0.32):
    f = hz(m)
    n = int(dur * SR)
    p = max(2, int(SR / f))
    buf = filt(rng.uniform(-1, 1, p), "lowpass", 2500)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.994
    out *= np.minimum(1, np.arange(n) / (0.002 * SR))
    return filt(out, "lowpass", cutoff) * vel  # muted pluck


def sub_note(m, dur, vel=1.0):
    t = tt(dur)
    ph = 2 * np.pi * hz(m) * t
    tri = 2 / np.pi * np.arcsin(np.sin(ph))
    x = 0.7 * np.sin(ph) + 0.3 * tri
    x = np.tanh(x * 1.4) / np.tanh(1.4)
    return x * np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.06) * vel


def pad_chord(notes, dur, cut0, cut1, vel=1.0):
    t = tt(dur)
    L = np.zeros(len(t))
    R = np.zeros(len(t))
    for m in notes:
        for d, side in ((-0.1, 0), (0.0, 2), (0.11, 1)):
            f = hz(m) * 2 ** (d / 12)
            saw = (2 * ((t * f + rng.uniform()) % 1) - 1) * 0.1
            if side in (0, 2):
                L += saw
            if side in (1, 2):
                R += saw
    out = []
    for ch in (L, R):
        # lowpass swell: blend two filtered copies along the note
        a, b = filt(ch, "lowpass", cut0, 4), filt(ch, "lowpass", cut1, 4)
        k = np.linspace(0, 1, len(t)) ** 1.5
        out.append(a * (1 - k) + b * k)
    env = np.minimum(1, t / 0.7) * np.minimum(1, (dur - t) / 0.5)
    return np.stack(out) * env * vel


CHORDS = [(45, [57, 60, 64]), (41, [53, 57, 60]), (43, [55, 59, 62]), (45, [57, 60, 64])]  # Am F G Am
ARP = [57, 60, 64, 67, 69, 67, 64, 60]  # A-C-E-G up and back, 8th notes


def music_bus():
    mono_low = np.zeros((2, N))  # kick + sub (mono)
    wide = np.zeros((2, N))  # pad + pluck (wide)
    tick_bus = np.zeros((2, N))
    g0 = SC["location"][0]  # groove grid origin = 2.2 s
    fin0, fin1 = SC["finally"]
    out0 = SC["outro"][0]
    # 0 - 2.2: sub drone + tick (the hook owns the sound)
    drone0 = sub_note(33, g0 + 0.3, 0.24)
    place(mono_low, drone0 * np.linspace(0.6, 1, len(drone0)), 0)
    n = 0
    while n * BEAT < g0:
        place(tick_bus, filt(rng.standard_normal(S(0.02)), "bandpass", [3000, 6000]) * np.exp(-tt(0.02) * 200) * 0.08, n * BEAT, 1, 0.2)
        n += 1
    # scene-by-scene pluck brightness (filters up each scene)
    scene_cut = [(SC[k][0], c) for k, c in [("location", 700), ("shawarma", 1100), ("burgers", 1500), ("sandwiches", 1900), ("kebabs", 2400), ("fries", 3000)]]

    def cutoff_at(t):
        c = 700
        for s0, cv in scene_cut:
            if t >= s0:
                c = cv
        return c

    b = 0
    while True:
        t = g0 + b * BEAT
        if t >= fin0 - 1e-3:
            break
        bar, beat = divmod(b, 4)
        root, tones = CHORDS[bar % 4]
        build = min(1.0, (t - g0) / (4 * BEAT))  # 1-bar filter-sweep build into the groove
        if beat in (0, 2):
            place(mono_low, kick(0.9 if beat == 0 else 0.75) * build, t)
        if beat == 1:
            place(mono_low, kick(0.28), t + BEAT * 0.75)  # ghost kick
        place(tick_bus, hat(0.9 * build), t + BEAT / 2, 1, 0.25)
        if beat == 0:
            place(mono_low, sub_note(root - 12, BEAT * 3.85, 0.3 * build), t)
            place(wide, pad_chord([m + 12 for m in tones], BEAT * 4, 400 + 900 * build, 900 + 900 * build, 0.16), t)
        for e in range(2):
            step = beat * 2 + e
            te = t + e * BEAT / 2
            pl = pluck(ARP[step] + (0 if step < 4 else 0), cutoff_at(te) * (0.4 + 0.6 * build), 0.22)
            pan = -0.45 if step % 2 == 0 else 0.45
            place(wide, pl, te, 1, pan)
            place(wide, pl * 0.35, te + BEAT * 0.75, 1, -pan)  # light dotted-8th delay
        b += 1
    # FINALLY: dropout -> pad + sub only
    place(wide, pad_chord([57, 60, 64, 69], fin1 - fin0 + 0.6, 500, 1100, 0.2), fin0)
    place(mono_low, sub_note(33, fin1 - fin0, 0.38), fin0)
    # OUTRO: gentle swell, final 0.4 s near-silent
    swell = DUR - out0 - 0.4
    place(wide, pad_chord([57, 64, 69, 72], swell, 600, 1800, 0.22), out0)
    place(mono_low, sub_note(33, swell, 0.3), out0)
    mus = mono_low + Pedalboard([Reverb(room_size=0.45, wet_level=0.16, dry_level=0.9, width=1.0)])(wide.astype(np.float32), SR) + tick_bus
    t = np.arange(N) / SR
    contour = np.interp(t, [0, fin0 - 0.05, fin0, out0, DUR], [1.0, 1.0, 0.36, 0.4, 0.4])
    mus = mus * contour[None, :]
    fade = np.ones(N)
    a = S(DUR - 0.4)
    fade[a:] = np.linspace(1, 0.02, N - a)
    return mus * fade


# ------------------------------------------------------------------ SFX bus
def noise(sec):
    return rng.standard_normal(S(sec))


def bandsweep(x, f0, f1, q=1.2, block=256):
    out = np.zeros_like(x)
    for i in range(0, len(x), block):
        f = f0 * (f1 / f0) ** (i / max(1, len(x)))
        lo, hi = f / (1 + 1 / q), min(f * (1 + 1 / q), SR / 2 - 200)
        seg = x[max(0, i - 2048): i + block]
        y = filt(seg, "bandpass", [max(30, lo), hi])
        out[i:i + block] = y[-len(x[i:i + block]):]
    return out


def reverse_riser(dur):
    t = tt(dur)
    body = bandsweep(noise(dur), 250, 6000) * (t / dur) ** 2.2
    burst = filt(noise(0.25), "bandpass", [400, 5000]) * np.exp(-tt(0.25) * 18)
    tail = Pedalboard([Reverb(room_size=0.95, damping=0.4, wet_level=1.0, dry_level=0.0, width=0.0)])(np.pad(burst, (0, S(dur)))[None, :].astype(np.float32), SR)[0][: len(t)]
    rev = tail[::-1] / max(np.abs(tail).max(), 1e-9)
    return body * 0.8 + rev * 0.6


def airy_wind(dur):
    """Light, airy rising wind/whoosh under the daylight clip."""
    t = tt(dur)
    x = bandsweep(noise(dur), 600, 4500, q=0.8)
    flutter = 1 + 0.25 * np.sin(2 * np.pi * 3.2 * t)
    return x * np.minimum(1, t / 0.15) * (0.4 + 0.6 * t / dur) * flutter


def impact():
    """Hook hit: sub drop 60->38 Hz + 2 ms click + fire burst + dark 1.2 s tail."""
    t = tt(1.5)
    f = 38 + 22 * np.exp(-t / 0.12)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45)
    sub = np.tanh(sub * 1.8) / np.tanh(1.8)
    click = np.zeros(len(t))
    click[: S(0.002)] = np.hanning(S(0.004))[S(0.002):] * 1.0
    click = filt(click, "highpass", 1500)
    burst = filt(noise(1.5), "bandpass", [800, 4000]) * np.exp(-t / 0.07)
    dry = sub + click * 0.8 + burst * 0.5
    tail = Pedalboard([LowpassFilter(1800), Reverb(room_size=0.85, damping=0.75, wet_level=1.0, dry_level=0.0, width=1.0)])(np.stack([burst + click, burst + click]).astype(np.float32) * 0.6, SR)
    out = stereo(dry) + tail[:, : len(t)] * 0.5 * np.exp(-t / 1.2)
    return out


def whoosh(dur=0.3, down=True, tone=True):
    t = tt(dur)
    pk = 0.55
    env = np.where(t < dur * pk, (t / (dur * pk)) ** 2, np.exp(-(t - dur * pk) * 18))
    x = bandsweep(noise(dur), 3500 if down else 500, 500 if down else 3500, q=1.0) * env
    if tone:
        f = np.linspace(900, 260, len(t)) if down else np.linspace(260, 900, len(t))
        x += np.sin(2 * np.pi * np.cumsum(f) / SR) * env * 0.15
    return x


def air_tick():
    t = tt(0.03)
    return filt(noise(0.03), "highpass", 7000) * np.exp(-t * 220) * 0.6


def sizzle(dur=0.5):
    t = tt(dur)
    base = filt(noise(dur), "highpass", 4000, 3)
    pops = np.zeros(len(t))
    for _ in range(int(dur * 120)):
        i = rng.integers(0, max(1, len(t) - 300))
        L = int(rng.integers(40, 240))
        pops[i:i + L] += rng.uniform(0.3, 1) * np.exp(-np.arange(L) / (L / 4))
    return base * (0.3 + pops) * np.minimum(1, t / 0.01) * np.exp(-t / (dur * 0.5))


def ignite():
    t = tt(0.6)
    flutter = 1 + 0.35 * np.sin(2 * np.pi * 14 * t)
    swell = filt(noise(0.6), "lowpass", 1800) * np.sin(np.pi * np.minimum(1, t / 0.6)) ** 1.5 * flutter
    return swell


def crackle_tick():
    L = int(rng.integers(60, 300))
    return filt(rng.standard_normal(L), "bandpass", [1500, 6000]) * np.exp(-np.arange(L) / (L / 5))


def tonal_swell(dur=1.0):
    t = tt(dur)
    x = sum(np.sin(2 * np.pi * hz(m) * t) for m in (69, 76)) * 0.2
    return x * np.sin(np.pi * np.minimum(1, t / dur)) ** 2


def soft_tick(f=3500, dur=0.04):
    t = tt(dur)
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 120)


def sub_thump():
    t = tt(0.25)
    return np.sin(2 * np.pi * 55 * t) * np.minimum(1, t / 0.008) * np.exp(-t / 0.08)  # no click (soft attack)


def shimmer(dur=0.6, base=1760):
    t = tt(dur)
    x = sum(np.sin(2 * np.pi * base * k * t + k) for k in (1, 1.5, 2.01)) * 0.12
    return x * np.minimum(1, t / 0.01) * np.exp(-t / (dur * 0.35))


def bell(f=880, dur=2.2):
    t = tt(dur)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6)
    return x * np.minimum(1, t / 0.004) * np.exp(-t / 0.7)


def drone(dur):
    t = tt(dur)
    return (np.sin(2 * np.pi * 55 * t) * 0.6 + np.sin(2 * np.pi * 82.5 * t) * 0.25) * np.sin(np.pi * np.minimum(1, t / dur)) ** 1.2


def boom():
    t = tt(1.6)
    f = 45 + 25 * np.exp(-t / 0.08)
    sub = np.tanh(1.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.5)) / np.tanh(1.6)
    hitn = filt(noise(1.6), "lowpass", 600) * np.exp(-t / 0.05)
    plate = Pedalboard([Reverb(room_size=0.8, damping=0.5, wet_level=1.0, dry_level=0.0, width=1.0)])(np.stack([hitn, hitn]).astype(np.float32), SR)
    return stereo(sub + hitn * 0.4) + plate[:, : len(t)] * 0.45 * np.exp(-t / 1.8)


def ember_tick():
    t = tt(0.1)
    return (np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 90) + filt(noise(0.1), "highpass", 6000) * np.exp(-t * 200) * 0.5) * 0.5


def sfx_bus():
    fx = np.zeros((2, N))
    hero = np.zeros((2, N))  # hook hit + logo boom (allowed closer to the voice)
    lf_hits = []  # times of low-frequency SFX (the music's low end ducks under them)
    # --- hook
    place(fx, airy_wind(CUT), 0.0, 0.35)  # keeps the bright clip alive
    place(fx, reverse_riser(CUT - 0.5), 0.5, 0.55)  # builds INTO the cut frame
    kick = read(ROOT / "reel/public/audio/v17/kick.wav")
    place(hero, kick, 0.98 - 14 / FPS - 0.04, 1.0)  # transient at ~0.59 s  # source 0.98 s -> timeline 0.473 s, so the transient lands at ~0.59 s
    place(hero, impact(), CUT, 1.0)
    lf_hits.append((CUT, 0.8))
    place(fx, whoosh(0.32, down=True), CUT - 0.02, 0.7)
    place(fx, sizzle(0.5), CUT + 0.05, 0.35)
    # --- ON FIRE
    of = PLAN["hook"]["onFire"] / FPS
    place(fx, ignite(), of - 0.05, 0.5)
    for i in range(6):
        k, dt = vary(i)
        place(fx, pitch(crackle_tick(), k), of + 0.08 + i * 0.1 + dt, 0.35, rng.uniform(-0.5, 0.5))
    # --- location line
    loc0 = SC["location"][0]
    place(fx, tonal_swell(1.1), loc0, 0.3)
    for i, d in enumerate((2 / FPS, 5 / FPS, 16 / FPS)):
        k, dt = vary(10 + i)
        place(fx, pitch(soft_tick(2800), k), loc0 + d + dt, 0.25)
    # --- hex wipes (x4): directional whoosh + air tick
    for i, key in enumerate(("shawarma", "burgers", "sandwiches", "kebabs")):
        k, dt = vary(20 + i)
        t0 = SC[key][0] - 14 / FPS
        place(fx, pitch(whoosh(0.3, down=False), k), t0 + dt, 0.55, [-0.6, 0.6][i % 2])
        place(fx, air_tick(), SC[key][0] - 0.02, 0.4, [0.6, -0.6][i % 2])
    # --- food hero entrances: 0.5 s sizzle one-shot (~ -26 dB)
    for i, key in enumerate(("shawarma", "burgers", "sandwiches", "kebabs", "fries")):
        k, dt = vary(30 + i)
        place(fx, pitch(sizzle(0.5), k), SC[key][0] + 0.03 + dt, 10 ** (-26 / 20) * 3)
    # --- price locks (x5)
    for i, (key, fr) in enumerate(PLAN["priceLocks"].items()):
        t = fr / FPS
        k, dt = vary(40 + i)
        place(fx, sub_thump(), t, 0.55)
        lf_hits.append((t, 0.25))
        place(fx, pitch(soft_tick(3500), k), t, 0.3)
        place(fx, pitch(shimmer(0.5), k), t + 0.01, 0.3, 0.2)
    # --- flavour flicks and kebab names: very quiet filtered clicks (-30 dB)
    q = 10 ** (-30 / 20) * 4
    fstart, _ = PLAN["food"]["flavours"]
    lock = PLAN["food"]["lock"]
    for key in ("shawarma", "burgers", "sandwiches"):
        step = max(4, round(((lock - 10) - fstart) / 7))
        for i in range(7):
            k, dt = vary(60 + i)
            place(fx, filt(pitch(crackle_tick(), k), "lowpass", 3000), SC[key][0] + (fstart + i * step) / FPS + dt, q)
    for i, fr in enumerate(PLAN["kebab"]["names"] + [PLAN["kebab"]["rumali"]]):
        k, dt = vary(70 + i)
        place(fx, filt(pitch(crackle_tick(), k), "lowpass", 3000), SC["kebabs"][0] + fr / FPS + dt, q)
    # --- FINALLY: low drone + one bell on "CHEATING."
    fin0, fin1 = SC["finally"]
    place(fx, drone(fin1 - fin0), fin0, 0.05)
    cheating = PLAN["vo"]["L8"]["at"] + PLAN["vo"]["L8"]["words"][-1]["start"]
    place(fx, Pedalboard([Reverb(room_size=0.7, wet_level=0.35, dry_level=0.8)])(stereo(bell(880)).astype(np.float32), SR), cheating, 0.09)
    # --- logo reveal: boom + flame whoosh + warm shimmer
    out0 = SC["outro"][0]
    logo_land = out0 + (round(PLAN["vo"]["L9"]["at"] * FPS) - PLAN["scenes"]["outro"]["from"] + 2) / FPS
    place(hero, boom(), logo_land, 0.9)
    lf_hits.append((logo_land, 1.2))
    place(fx, whoosh(0.45, down=True), logo_land - 0.3, 0.5)
    place(fx, shimmer(1.2, 1320), logo_land + 0.05, 0.35)
    # --- loop: silence, then one ember tick at the loop point
    place(fx, ember_tick(), DUR - 0.11, 0.5)
    return fx, hero, lf_hits


# ------------------------------------------------------------------ ATMOS
def atmos_bus():
    x = filt(filt(rng.standard_normal(N), "lowpass", 900), "highpass", 60)
    x = x / np.sqrt((x ** 2).mean()) * 10 ** (-42 / 20) * 0.5
    return stereo(x, np.roll(x, 3000))


# ------------------------------------------------------------------ mix
def sidechain(act_level, depth_db, attack, release):
    env = np.zeros(N)
    a, r = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    g = 0.0
    for i, x in enumerate(act_level):
        c = a if x > g else r
        g = c * g + (1 - c) * x
        env[i] = g
    return 10 ** (-depth_db * env / 20)


def main():
    STEMS.mkdir(parents=True, exist_ok=True)
    voice = voice_bus()
    vlev = np.sqrt(np.convolve(voice[0] ** 2, np.ones(S(0.01)) / S(0.01), "same"))
    vgate = np.clip((20 * np.log10(vlev + 1e-7) + 46) / 14, 0, 1)

    music = music_bus()
    music = Pedalboard([HighpassFilter(35), PeakFilter(cutoff_frequency_hz=3000, gain_db=-5, q=0.8)])(music.astype(np.float32), SR)
    music = lufs_gain(music, -21.0)
    write(STEMS / "music_raw.wav", music)
    duck = sidechain(vgate, 9, 0.015, 0.25)

    fx, hero, lf_hits = sfx_bus()
    # one low-frequency source at a time: the music's low end ducks under SFX sub hits
    lf = np.zeros(N)
    for t, d in lf_hits:
        lf[S(t): S(t + d)] = 1
    lf_duck = sidechain(lf, 10, 0.005, 0.2)
    music_lo = filt(music, "lowpass", 160)
    music = (music - music_lo) + music_lo * lf_duck[None, :]
    music = music * duck[None, :]

    vpk = np.abs(voice).max()
    fx = fx / max(np.abs(fx).max(), 1e-9) * vpk * 10 ** (-6.5 / 20)  # SFX peaks >= 6 dB under the voice
    hero = hero / max(np.abs(hero).max(), 1e-9) * vpk * 10 ** (-3.2 / 20)  # hook hit + logo boom: 3 dB under
    # the SFX bus also yields to the voice (6 dB), except the first 120 ms of the hook hit and the logo boom
    sfx_duck = sidechain(vgate, 6, 0.015, 0.25)
    keep = np.zeros(N)
    for t, d in lf_hits:
        if d >= 0.8:
            keep[S(t): S(t + 0.12)] = 1
    sfx_duck = np.maximum(sfx_duck, keep)
    sfx = (fx + hero) * sfx_duck[None, :]
    atmos = atmos_bus()

    for name, st in (("voice", voice), ("music", music), ("sfx", sfx), ("atmos", atmos)):
        write(STEMS / f"{name}.wav", st)
    (STEMS / "music_raw.wav").unlink()

    # loop beat: everything but the ember tick falls to near-silence over the last 0.4 s
    tail = np.ones(N)
    a = S(DUR - 0.45)
    tail[a:] = np.linspace(1, 0.0, N - a) ** 2
    tick = np.zeros((2, N))
    place(tick, ember_tick(), DUR - 0.11, 1.0)
    tick = tick / max(np.abs(tick).max(), 1e-9) * vpk * 10 ** (-10 / 20)
    mix = (voice + music + sfx + atmos) * tail[None, :] + tick
    mix = Pedalboard([Compressor(threshold_db=-16, ratio=1.5, attack_ms=25, release_ms=200), HighShelfFilter(cutoff_frequency_hz=9000, gain_db=1.0), Limiter(threshold_db=-1.5, release_ms=80)])(mix.astype(np.float32), SR)
    pre = OUT / "mix.pre.wav"
    write(pre, mix)
    m = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(pre), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"): m.rindex("}") + 1])
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,alimiter=limit=0.85:attack=1:release=60:level=false")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(pre), "-af", af, "-ar", str(SR), "-c:a", "pcm_s16le", str(OUT / "mix.wav")], check=True)
    pre.unlink()
    print("music alone:", measure(STEMS / "music.wav"), "(after ducking)")
    print("mix:", measure(OUT / "mix.wav"))
    # QA: wherever the voice plays, music + SFX at least 6 dB below it (400 ms windows)
    w = S(0.4)
    worst = 99.0
    for i in range(0, N - w, w):
        if vgate[i:i + w].mean() < 0.85:  # only windows where the voice is actually sounding
            continue
        v = np.sqrt((voice[:, i:i + w] ** 2).mean())
        o = np.sqrt(((music + sfx)[:, i:i + w] ** 2).mean())
        worst = min(worst, 20 * np.log10(v / max(o, 1e-9)))
    print(f"voice-over-bed margin (worst 400 ms window while voiced): {worst:.1f} dB")


if __name__ == "__main__":
    main()
