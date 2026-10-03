"""Synthesised sound design + music loop for the Hungrillz reel (numpy/scipy only).

Usage: python3 scripts/sfx.py
Outputs (48 kHz, 16-bit stereo WAV) in reel/public/audio/sfx and reel/public/audio/music:
  flame-whoosh.wav   rising/falling filtered-noise whoosh with a low roar
  bass-hit.wav       80 Hz sine hit with pitch drop + transient click
  sizzle-bed.wav     loopable grill sizzle (8 s, seamless)
  ember-crackle.wav  loopable ember crackle (6 s, seamless)
  text-tick.wav      short UI tick for text/price reveals
  music-loop-100bpm.wav  seamless 8-bar dark cinematic loop (sub bass, soft kick, warm pad)
Levels are then normalised with ffmpeg (static gain, so loops stay seamless).
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, sosfiltfilt, fftconvolve

ROOT = Path(__file__).resolve().parent.parent
SFX = ROOT / "reel/public/audio/sfx"
MUS = ROOT / "reel/public/audio/music"
SR = 48000
rng = np.random.default_rng(2026)


def t_axis(sec):
    return np.arange(int(SR * sec)) / SR


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x)


def lp(x, f, order=2, zero_phase=False):
    sos = butter(order, f, "lowpass", fs=SR, output="sos")
    return sosfiltfilt(sos, x) if zero_phase else sosfilt(sos, x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "highpass", fs=SR, output="sos"), x)


def sweep_filter(x, f_curve, q=1.2, block=256):
    """Time-varying band-pass: filter block by block following a centre-frequency curve."""
    out = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        f = float(np.clip(f_curve[min(i, len(f_curve) - 1)], 40, SR / 2 - 2000))
        lo, hi = f / (1 + 1 / q), f * (1 + 1 / q)
        sos = butter(2, [lo, min(hi, SR / 2 - 100)], "bandpass", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        seg, zi = sosfilt_zi_step(sos, x[i:i + block], zi)
        out[i:i + block] = seg
    return out


def sosfilt_zi_step(sos, seg, zi):
    from scipy.signal import sosfilt as _s

    y, zf = _s(sos, seg, zi=zi)
    return y, zf


def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def stereo(l, r=None):
    r = l if r is None else r
    return np.stack([l, r], axis=1)


def write(path, x):
    path.parent.mkdir(parents=True, exist_ok=True)
    x = np.asarray(x, np.float64)
    if x.ndim == 1:
        x = stereo(x)
    peak = np.max(np.abs(x)) or 1
    wavfile.write(str(path), SR, (x / peak * 0.89 * 32767).astype(np.int16))


def fold_loop(x, n):
    """Wrap everything after n samples back onto the start: tails ring into the loop seam."""
    out = x[:n].copy()
    k = n
    while k < len(x):
        seg = x[k:k + n]
        out[: len(seg)] += seg
        k += n
    return out


def schroeder_ir(sec=2.6, decay=2.2, bright=5000):
    """Simple stereo reverb impulse: exponentially decaying filtered noise."""
    t = t_axis(sec)
    env = np.exp(-t * (6.9 / decay))
    l = lp(rng.standard_normal(len(t)), bright) * env
    r = lp(rng.standard_normal(len(t)), bright) * env
    pre = int(0.012 * SR)
    l[:pre] = r[:pre] = 0
    return l / np.sqrt(np.sum(l ** 2)), r / np.sqrt(np.sum(r ** 2))


# ------------------------------------------------------------------ SFX
def flame_whoosh():
    dur = 1.6
    t = t_axis(dur)
    n = rng.standard_normal(len(t))
    # centre frequency rises then falls (the flame "breathes" past)
    peak_t = 0.62
    f = np.where(t < peak_t, 250 * (2600 / 250) ** (t / peak_t), 2600 * (300 / 2600) ** ((t - peak_t) / (dur - peak_t)))
    body = sweep_filter(n, f, q=1.1)
    env = np.where(t < peak_t, (t / peak_t) ** 2.2, np.exp(-(t - peak_t) * 3.6))
    roar = lp(rng.standard_normal(len(t)), 220, order=4) * 2.8
    roar_env = np.where(t < peak_t, (t / peak_t) ** 1.5, np.exp(-(t - peak_t) * 2.6))
    # flicker: fast random amplitude wobble = fire texture
    flick = 1 + 0.35 * lp(rng.standard_normal(len(t)), 18, zero_phase=True) * 8
    mono = (body * env * flick + roar * roar_env) * 0.9
    # pan sweep left -> right
    pan = np.clip(t / dur, 0, 1)
    l = mono * np.cos(pan * np.pi / 2) * 1.2
    r = mono * np.sin(pan * np.pi / 2) * 1.2
    fade = np.minimum(1, (len(t) - np.arange(len(t))) / (0.05 * SR))
    return stereo(soft_clip(l, 1.3) * fade, soft_clip(r, 1.3) * fade)


def bass_hit():
    dur = 1.8
    t = t_axis(dur)
    # 80 Hz sine with a fast pitch drop from 130 Hz (punch) settling at 80 Hz
    f = 80 + 50 * np.exp(-t * 38)
    phase = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(phase) * np.exp(-t * 2.4) * np.minimum(1, t / 0.002)
    harm = np.sin(2 * phase) * 0.18 * np.exp(-t * 6)  # a touch of 2nd harmonic so it reads on phones
    # click: 4 ms high-passed noise burst + a 2.5 kHz blip
    nclick = int(0.004 * SR)
    click = np.zeros(len(t))
    click[:nclick] = hp(rng.standard_normal(nclick), 1800) * np.hanning(nclick * 2)[nclick:]
    click += np.sin(2 * np.pi * 2500 * t) * np.exp(-t * 900) * 0.6
    mono = soft_clip(sub * 1.0 + harm, 1.6) + click * 0.55
    return stereo(mono)


def sizzle_bed(loop=8.0):
    n = int(loop * SR)
    total = n + int(1.0 * SR)
    t = np.arange(total) / SR
    base = hp(rng.standard_normal(total), 3500, order=3)
    base = lp(base, 11000)
    # bubbling amplitude: slow random modulation + fast micro-pops
    slow = 0.6 + 0.4 * lp(rng.standard_normal(total), 1.2, zero_phase=True) * 25
    pops = np.zeros(total)
    for _ in range(int(loop * 140)):
        i = rng.integers(0, total - 400)
        L = rng.integers(60, 380)
        pops[i:i + L] += rng.uniform(0.3, 1.0) * np.exp(-np.arange(L) / (L / 4))
    tex = base * (0.35 * np.clip(slow, 0.1, 1.5) + 0.9 * pops)
    xl = tex
    xr = np.roll(hp(rng.standard_normal(total), 3500, order=3), 1234) * (0.35 * np.clip(slow, 0.1, 1.5) + 0.9 * np.roll(pops, 7777))
    # seamless loop: crossfade the extra second back over the start
    cf = int(1.0 * SR)
    w = np.sin(np.linspace(0, np.pi / 2, cf)) ** 2
    out = []
    for ch in (xl, xr):
        y = ch[:n].copy()
        y[:cf] = ch[n:n + cf] * (1 - w) + ch[:cf] * w
        out.append(y)
    return stereo(*out)


def ember_crackle(loop=6.0):
    n = int(loop * SR)
    chans = []
    for c in range(2):
        x = np.zeros(n)
        for _ in range(int(loop * 26)):
            i = rng.integers(0, n)
            L = int(rng.integers(40, 900))
            seg = rng.standard_normal(L) * np.exp(-np.arange(L) / (L / rng.uniform(3, 9)))
            seg = bp(seg, rng.uniform(900, 2500), rng.uniform(4000, 9000))
            amp = rng.uniform(0.15, 1.0) ** 2
            idx = (i + np.arange(L)) % n  # wrap = seamless
            x[idx] += seg * amp
        # occasional low "pop" (wood/fat)
        for _ in range(int(loop * 3)):
            i = rng.integers(0, n)
            L = int(0.03 * SR)
            tt = np.arange(L) / SR
            idx = (i + np.arange(L)) % n
            x[idx] += np.sin(2 * np.pi * rng.uniform(90, 180) * tt) * np.exp(-tt * 90) * rng.uniform(0.3, 0.8)
        chans.append(x)
    return stereo(*chans)


def text_tick():
    t = t_axis(0.09)
    tone = np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 120) + np.sin(2 * np.pi * 3300 * t) * 0.4 * np.exp(-t * 180)
    noise = hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 400) * 0.5
    x = (tone + noise) * np.minimum(1, t / 0.0008)
    return stereo(x, np.roll(x, 12))


# ------------------------------------------------------------------ music
def music_loop(bpm=100, bars=8):
    beat = 60 / bpm
    bar = beat * 4
    n = int(round(bar * bars * SR))  # exact loop length in samples
    total = n * 2
    L = np.zeros(total)
    R = np.zeros(total)
    tt = np.arange(total) / SR

    # D minor, cinematic: Dm | Bb | Gm | A   (2 bars each)
    def hz(midi):
        return 440 * 2 ** ((midi - 69) / 12)

    chords = [  # (bass root midi, pad voicing midis)
        (38, [50, 53, 57, 62]),   # Dm  : D2 | D3 F3 A3 D4
        (34, [50, 53, 58, 62]),   # Bb  : Bb1 | D3 F3 Bb3 D4
        (31, [50, 55, 58, 62]),   # Gm  : G1 | D3 G3 Bb3 D4
        (33, [49, 52, 57, 61]),   # A   : A1 | C#3 E3 A3 C#4
    ]

    # warm pad: detuned saw stack -> low-pass, slow attack/release, slight stereo detune
    def saw(f, t):
        return 2 * ((t * f) % 1) - 1

    pad_l = np.zeros(total)
    pad_r = np.zeros(total)
    for ci, (_, notes) in enumerate(chords):
        start = ci * 2 * bar
        length = 2 * bar
        i0, i1 = int(start * SR), int((start + length + 2.5) * SR)
        t = np.arange(i1 - i0) / SR
        env = np.minimum(1, t / 1.1) * np.where(t < length, 1, np.exp(-(t - length) * 2.2))
        for m in notes:
            f = hz(m)
            for d, side in ((-0.09, "l"), (0.0, "c"), (0.11, "r")):
                fd = f * 2 ** (d / 12)
                v = saw(fd, t + rng.uniform(0, 1)) * env * 0.13
                if side in ("l", "c"):
                    pad_l[i0:i1] += v
                if side in ("r", "c"):
                    pad_r[i0:i1] += v
    # gentle filter movement: two passes of low-pass at different cut-offs blended by a slow LFO
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * tt / (bar * bars) * 2)  # 2 cycles per loop -> seamless
    for ch in ("l", "r"):
        src = pad_l if ch == "l" else pad_r
        dark, open_ = lp(src, 700, order=4), lp(src, 1600, order=4)
        mixd = dark * (1 - lfo) + open_ * lfo
        if ch == "l":
            pad_l = mixd
        else:
            pad_r = mixd

    # sub bass: sine roots, half-note pulses following the kick, soft saturation
    sub = np.zeros(total)
    for ci, (root, _) in enumerate(chords):
        for b in range(8):  # 8 beats per chord (2 bars)
            if b % 2:  # pulse on beats 1 and 3
                continue
            st = (ci * 2 * bar) + b * beat
            i0 = int(st * SR)
            dur = beat * 1.9
            t = np.arange(int(dur * SR)) / SR
            f = hz(root + 12)
            env = np.minimum(1, t / 0.012) * np.exp(-t * 1.1) * np.where(t > dur - 0.05, (dur - t) / 0.05, 1)
            sub[i0:i0 + len(t)] += np.sin(2 * np.pi * f * t) * env * 0.55
    sub = soft_clip(sub, 1.4)

    # soft kick: beats 1 and 3, low sine thump without a hard click
    kick = np.zeros(total)
    kt = np.arange(int(0.45 * SR)) / SR
    kf = 52 + 70 * np.exp(-kt * 30)
    kwave = np.sin(2 * np.pi * np.cumsum(kf) / SR) * np.exp(-kt * 7) * np.minimum(1, kt / 0.003)
    kwave += lp(rng.standard_normal(len(kt)), 900) * np.exp(-kt * 80) * 0.08
    for b in range(bars * 4):
        if b % 2:
            continue
        i0 = int(b * beat * SR)
        kick[i0:i0 + len(kt)] += kwave * (0.85 if b % 4 == 0 else 0.6)

    # sidechain-style duck on the pad from the kick (classic cinematic pump, very gentle)
    duck = np.ones(total)
    for b in range(0, bars * 4, 2):
        i0 = int(b * beat * SR)
        d = np.arange(int(0.5 * SR)) / SR
        duck[i0:i0 + len(d)] = np.minimum(duck[i0:i0 + len(d)], 1 - 0.28 * np.exp(-d * 7))

    # low, distant "ember" texture so the loop never sits on pure silence
    air = lp(hp(rng.standard_normal(total), 2500), 7000) * 0.012

    # reverb on the pad (circular, so tails wrap into the seam)
    irl, irr = schroeder_ir()
    pl = pad_l * duck
    pr = pad_r * duck
    wet_l = fftconvolve(pl, irl)[:total]
    wet_r = fftconvolve(pr, irr)[:total]

    L = pl * 0.8 + wet_l * 0.45 + sub + kick + air
    R = pr * 0.8 + wet_r * 0.45 + sub + kick + np.roll(air, 999)
    L, R = fold_loop(L, n), fold_loop(R, n)
    # tame the very lows a touch and glue
    L, R = soft_clip(hp(L, 28) * 0.9, 1.1), soft_clip(hp(R, 28) * 0.9, 1.1)
    return stereo(L, R), {"bpm": bpm, "bars": bars, "seconds": n / SR, "samples": n, "key": "D minor", "progression": "Dm | Bb | Gm | A (2 bars each)"}


# ------------------------------------------------------------------ normalise
def ffmpeg_measure(path):
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    j = r.stderr[r.stderr.rindex("{"): r.stderr.rindex("}") + 1]
    return json.loads(j)


def normalise(path, target_lufs=None, peak_db=-1.0):
    """Static-gain normalisation with ffmpeg: integrated loudness target, capped by true peak."""
    m = ffmpeg_measure(path)
    gain = 0.0
    if target_lufs is not None and m["input_i"] not in ("-inf", "inf"):
        gain = target_lufs - float(m["input_i"])
    gain = min(gain, peak_db - float(m["input_tp"]))
    tmp = path.with_suffix(".tmp.wav")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-af", f"volume={gain:.2f}dB", "-ar", str(SR), "-c:a", "pcm_s16le", str(tmp)],
        check=True,
    )
    tmp.replace(path)
    m2 = ffmpeg_measure(path)
    return float(m2["input_i"]), float(m2["input_tp"])


if __name__ == "__main__":
    jobs = [
        (SFX / "flame-whoosh.wav", flame_whoosh(), -14),
        (SFX / "bass-hit.wav", bass_hit(), -12),
        (SFX / "sizzle-bed.wav", sizzle_bed(), -24),
        (SFX / "ember-crackle.wav", ember_crackle(), -26),
        (SFX / "text-tick.wav", text_tick(), None),
    ]
    music, meta = music_loop()
    jobs.append((MUS / "music-loop-100bpm.wav", music, -18))
    report = {}
    for path, audio, lufs in jobs:
        write(path, audio)
        i, tp = normalise(path, lufs, peak_db=-1.0 if lufs is not None else -3.0)
        dur = len(audio) / SR
        report[path.name] = {"seconds": round(dur, 3), "lufs": round(i, 1), "truePeak": round(tp, 1)}
        print(f"{path.relative_to(ROOT)}  {dur:.2f}s  {i:.1f} LUFS  TP {tp:.1f} dBTP")
    (MUS / "music-loop-100bpm.json").write_text(json.dumps(meta, indent=2))
    (SFX / "levels.json").write_text(json.dumps(report, indent=2))
