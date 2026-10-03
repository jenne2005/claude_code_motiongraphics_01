"""v2 voiceover: Kokoro TTS (female), one WAV per line, trimmed, high-passed, lightly compressed.

Usage:
  python3 scripts/voiceover_v2.py audition        # render all lines for each candidate voice -> work/vo2/<voice>/
  python3 scripts/voiceover_v2.py final <voice>   # final VO -> reel/public/audio/vo2/ (+ vo2-timings.json)
Models: ~/.kokoro/kokoro-v1.0.onnx and voices-v1.0.bin (kokoro-onnx GitHub release model-files-v1.0).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
KOKORO = Path.home() / ".kokoro"
VOICES = ["af_heart", "af_bella", "bf_emma"]
SPEED = 1.08

# Spoken text (what the TTS reads) and the display text (captions).
LINES_A = [
    ("Ten P.M. Still at your desk.", "Ten PM. Still at your desk."),
    ("Your stomach just filed a complaint.", "Your stomach just filed a complaint."),
    ("Near T.C.S., Adibatla... a grill is awake.", "Near TCS, Adibatla... a grill is awake."),
    ("Smoky shawarmas. Stacked burgers. Kebabs, straight off the flame.", "Smoky shawarmas. Stacked burgers. Kebabs straight off the flame."),
    ("Meals from one seventy-nine, fries and a drink included.", "Meals from one seventy-nine, fries and a drink included."),
    ("Finally, a cheat meal that isn't cheating.", "Finally, a cheat meal that isn't cheating."),
    ("Hungrillz. Crave. Grill. Repeat.", "Hungrillz. Crave. Grill. Repeat."),
]
# Hook B replaces lines 1-2 with one line.
LINE_B1 = ("Adibatla. We need to talk about your dinner. Your stomach just filed a complaint.",
           "Adibatla. We need to talk about your dinner. Your stomach just filed a complaint.")


def kokoro():
    from kokoro_onnx import Kokoro

    return Kokoro(str(KOKORO / "kokoro-v1.0.onnx"), str(KOKORO / "voices-v1.0.bin"))


def trim(x, sr, thresh_db=-45, pad=0.03):
    env = np.abs(x)
    th = 10 ** (thresh_db / 20) * max(env.max(), 1e-9)
    idx = np.nonzero(env > th)[0]
    if not len(idx):
        return x
    a = max(0, idx[0] - int(pad * sr))
    b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]


def polish(x, sr):
    """High-pass 80 Hz, gentle 2:1 compression, light presence, peak-safe."""
    from pedalboard import Compressor, HighpassFilter, HighShelfFilter, LowShelfFilter, Pedalboard

    board = Pedalboard([
        HighpassFilter(cutoff_frequency_hz=80),
        LowShelfFilter(cutoff_frequency_hz=180, gain_db=1.5),  # a little warmth (low, confident)
        Compressor(threshold_db=-20, ratio=2.0, attack_ms=8, release_ms=120),
        HighShelfFilter(cutoff_frequency_hz=6500, gain_db=1.0),
    ])
    y = board(x.astype(np.float32)[None, :], sr)[0]
    return y / max(np.abs(y).max(), 1e-9) * 0.89


# The sign-off has to land inside the 1.2 s end card, so it is read a little faster.
LINE_SPEED = {"L7": 1.35, "B1": 1.36}


def synth(k, text, voice, speed=SPEED):
    a, sr = k.create(text, voice=voice, speed=speed, lang="en-us" if voice.startswith("a") else "en-gb")
    return np.asarray(a, np.float32), sr


def write(path, x, sr):
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(path), sr, (np.clip(x, -1, 1) * 32767).astype(np.int16))


def loudnorm(path):
    tmp = path.with_suffix(".n.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-af", "loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "1", str(tmp)], check=True)
    tmp.replace(path)


def longest_pauses(x, sr, n):
    """Sample indices at the centre of the n longest low-energy gaps."""
    w = int(0.02 * sr)
    env = np.convolve(np.abs(x), np.ones(w) / w, "same")
    q = (env < 0.02 * env.max()).astype(int)
    d = np.diff(np.concatenate([[0], q, [0]]))
    runs = [(b - a, (a + b) // 2) for a, b in zip(np.where(d == 1)[0], np.where(d == -1)[0])]
    return [c for _, c in sorted(runs, reverse=True)[:n]]


def audition():
    k = kokoro()
    for v in VOICES:
        total = 0
        for i, (spoken, _) in enumerate(LINES_A, 1):
            x, sr = synth(k, spoken, v)
            x = trim(x, sr)
            total += len(x) / sr
            write(ROOT / f"work/vo2/{v}/L{i}.wav", x, sr)
        print(f"{v}: total {total:.2f}s")


def final(voice):
    k = kokoro()
    out = ROOT / "reel/public/audio/vo2"
    meta = {"engine": "kokoro-onnx v1.0", "voice": voice, "speed": SPEED, "lines": []}
    jobs = [(f"L{i}", s, d) for i, (s, d) in enumerate(LINES_A, 1)] + [("B1", *LINE_B1)]
    for key, spoken, display in jobs:
        x, sr = synth(k, spoken, voice, LINE_SPEED.get(key, SPEED))
        x = polish(trim(x, sr), sr)
        parts = [(key, x, display)]
        if key == "L4":
            # split the three food phrases at the two longest pauses so each lands on its own shot
            cuts = sorted(longest_pauses(x, sr, 2))
            segs = np.split(x, cuts)
            names = ["Smoky shawarmas.", "Stacked burgers.", "Kebabs straight off the flame."]
            parts = [(f"L4{c}", trim(seg, sr, pad=0.02), n) for c, seg, n in zip("abc", segs, names)]
        for pk, px, pd in parts:
            p = out / f"{pk}.wav"
            write(p, px, sr)
            loudnorm(p)
            sr2, y = wavfile.read(str(p))
            meta["lines"].append({"key": pk, "file": f"audio/vo2/{pk}.wav", "text": pd, "duration": round(len(y) / sr2, 3)})
            print(f"{pk}: {len(y) / sr2:.2f}s  {pd}")
    (out / "vo2-lines.json").write_text(json.dumps(meta, indent=2))


if __name__ == "__main__":
    audition() if sys.argv[1] == "audition" else final(sys.argv[2])
