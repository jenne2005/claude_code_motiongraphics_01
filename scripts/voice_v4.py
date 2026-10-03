"""ReelV4 voiceover: Kokoro blend af_nicole 0.65 + af_heart 0.35, speed 0.93, one WAV per line.

Usage:
  python3 scripts/voice_v4.py            # all lines, using NAME_VARIANT from reel/src/v4/voice.ts
  python3 scripts/voice_v4.py tests      # out/voice-test-1/2/3.mp3 (the three name pronunciations)
Chain: high-pass 90 Hz, low-shelf +2 dB @180 Hz, de-ess -4 dB @6.5 kHz, 2:1 compression,
light saturation, plate-style reverb 10% wet, limiter, 80 ms head/tail gaps.
Fallback engine: Piper en_US-amy-medium (if Kokoro is unavailable). Never the old male voice.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
KOKORO = Path.home() / ".kokoro"
OUT = ROOT / "reel/public/audio/v4/vo"
SPEED = 0.93
BLEND = {"af_nicole": 0.65, "af_heart": 0.35}
NAMES = {1: "Aadi Batla", 2: "Aa-di Bat-la", 3: "Aaadi Batla"}

LINES = {
    "L1A": "{N}. Ten P.M. Still at your desk?",
    "L1B": "{N}, we need to talk.",
    "L1C": "One nineteen. Not a typo. {N}, we need to talk.",
    "L2": "Your stomach just filed a complaint.",
    "L3": "Near T.C.S., {N}... a grill is awake.",
    # L4 is generated as five takes so each lands on its own shot
    "L4a": "Smoky shawarmas.",
    "L4b": "Stacked burgers.",
    "L4c": "Golden grilled sandwiches.",
    "L4d": "Kebabs, straight off the flame.",
    "L4e": "And fries... crisp, hot, dangerous.",
    "L5": "Meals from one seventy-nine... fries and a drink, included.",
    "L6": "Finally... a cheat meal that isn't cheating.",
    "L7": "Hungrillz. Crave. Grill. Repeat.",
}
# Each line has a window (seconds) in the 28 s timeline. A line that runs long is re-read a
# little faster to fit, never more than MAX_FIT x the base speed, so it stays unhurried.
WINDOW = {"L1A": 2.5, "L1B": 2.5, "L1C": 2.9, "L2": 1.8, "L3": 2.95, "L4a": 2.0, "L4b": 2.0, "L4c": 1.85,
          "L4d": 2.3, "L4e": 2.0, "L5": 3.8, "L6": 2.9, "L7": 2.15}
MAX_FIT = 1.36
PAUSES = dict(sentence_pause=0.09, clause_pause=0.04)


def name_variant():
    src = (ROOT / "reel/src/v4/voice.ts").read_text()
    return int(re.search(r"NAME_VARIANT[^=]*=\s*(\d)", src).group(1))


def engine():
    from kokoro_onnx import Kokoro

    k = Kokoro(str(KOKORO / "kokoro-v1.0.onnx"), str(KOKORO / "voices-v1.0.bin"))
    style = sum(k.get_voice_style(v) * w for v, w in BLEND.items())
    return k, style


def synth(k, style, text, speed):
    a, sr = k.create(text, voice=style, speed=speed, lang="en-us", **PAUSES)
    return np.asarray(a, np.float32), sr


def trim(x, sr, db=-45):
    env = np.abs(x)
    idx = np.nonzero(env > 10 ** (db / 20) * env.max())[0]
    return x[idx[0]: idx[-1] + 1] if len(idx) else x


def chain(x, sr):
    from pedalboard import (Compressor, Distortion, HighpassFilter, Limiter, LowShelfFilter, Pedalboard, PeakFilter, Reverb)

    board = Pedalboard([
        HighpassFilter(90),
        LowShelfFilter(cutoff_frequency_hz=180, gain_db=2.0),
        PeakFilter(cutoff_frequency_hz=6500, gain_db=-4.0, q=2.0),  # de-ess
        Compressor(threshold_db=-20, ratio=2.0, attack_ms=6, release_ms=120),
        Distortion(drive_db=2.5),  # light saturation
        Reverb(room_size=0.32, damping=0.35, wet_level=0.10, dry_level=0.95, width=0.6),  # short bright plate-ish
        Limiter(threshold_db=-1.5, release_ms=60),
    ])
    gap = np.zeros(int(0.08 * sr), np.float32)
    x = np.concatenate([gap, trim(x, sr), gap, gap])
    y = board(x[None, :], sr)[0]
    # keep the 80 ms gaps but cut the reverb tail once it is 40 dB down
    env = np.abs(y)
    idx = np.nonzero(env > 0.01 * env.max())[0]
    end = min(len(y), idx[-1] + int(0.08 * sr))
    y = y[:end]
    y[-int(0.03 * sr):] *= np.linspace(1, 0, int(0.03 * sr))
    return y


def write(path, x, sr):
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(path), sr, (np.clip(x, -1, 1) * 32767).astype(np.int16))


def loudnorm(path, out=None):
    out = out or path
    tmp = path.with_suffix(".n.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-af", "loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "1", str(tmp)], check=True)
    tmp.replace(out)


def main():
    k, style = engine()
    nv = name_variant()
    meta = {"engine": "kokoro-onnx v1.0", "blend": BLEND, "speed": SPEED, "nameVariant": nv, "lines": {}}
    for key, text in LINES.items():
        t = text.replace("{N}", NAMES[nv])
        spoken = t.replace("...", ",")  # Kokoro's ellipsis pause is too long for this cut; a comma breath reads better
        speed = SPEED
        x, sr = synth(k, style, spoken, speed)
        d = len(trim(x, sr)) / sr + 0.16
        if d > WINDOW[key]:
            speed = SPEED * min(MAX_FIT, d / WINDOW[key] * 1.02)
            x, sr = synth(k, style, spoken, speed)
        p = OUT / f"{key}.wav"
        write(p, chain(x, sr), sr)
        loudnorm(p)
        r, y = wavfile.read(str(p))
        meta["lines"][key] = {"file": f"audio/v4/vo/{key}.wav", "text": t, "duration": round(len(y) / r, 3), "speed": round(speed, 3)}
        print(f"{key}: {len(y) / r:.2f}s (window {WINDOW[key]}s, speed {speed:.2f})  {t}")
    (OUT / "vo.json").write_text(json.dumps(meta, indent=2))


def tests():
    k, style = engine()
    for i, n in NAMES.items():
        x, sr = synth(k, style, f"Near T.C.S., {n}.", SPEED)
        wav = ROOT / f"out/_vt{i}.wav"
        write(wav, chain(x, sr), sr)
        loudnorm(wav)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "192k", str(ROOT / f"out/voice-test-{i}.mp3")], check=True)
        wav.unlink()
        print(f"out/voice-test-{i}.mp3  ({n})")


if __name__ == "__main__":
    tests() if len(sys.argv) > 1 and sys.argv[1] == "tests" else main()
