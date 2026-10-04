"""v1.9 voice: a completely new voice for every line (Kokoro am_michael, offline), one natural take per line.
"TCS" is plain text, so it is said the way people say it. Word timings come from prefix takes
(the duration of "Shawarma.", "Shawarma. From", ...) snapped to the nearest energy valley of the full take.

Usage: python3 scripts/voice_v19.py            # L1-L9 -> reel/public/audio/v19/vo/ (+ vo19.json)
       python3 scripts/voice_v19.py tests      # out/voice-test-1/2/3.mp3 (the three ADIBATLA readings)
       python3 scripts/voice_v19.py audition   # out/voice-audition-<voice>.mp3 (same L2+L9 in alternate voices)
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
OUT = ROOT / "reel/public/audio/v19/vo"
VOICE = "am_michael"
SPEED = 1.0
PAUSES = dict(sentence_pause=0.12, clause_pause=0.08)
NAMES = {1: "Aadi Batla", 2: "Aa-di Bat-la", 3: None}  # 3 = phonemes below (long first vowel, Telugu-style "but-laa")
NAME3_PH = "ˈɑːːdi bˈʌtlɑː"

# each line: list of (caption token, spoken text); tokens are what the reel reads by index
LINES = {
    "L1": [("Everything", "Everything"), ("we", "we"), ("make", "make,"), ("is", "is"), ("on", "on"), ("fire", "fire.")],
    "L2": [("NEAR", "Near"), ("TCS,", "TCS,"), ("ADIBATLA.", "{N}.")],
    "L3": [("Shawarma.", "Shawarma."), ("From", "From"), ("one", "one"), ("twenty-nine.", "twenty-nine.")],
    "L4": [("Burgers.", "Burgers."), ("From", "From"), ("one", "one"), ("nineteen.", "nineteen.")],
    "L5": [("Sandwiches.", "Sandwiches."), ("From", "From"), ("one", "one"), ("oh", "oh"), ("nine.", "nine.")],
    "L6": [("Kebabs.", "Kebabs."), ("Twelve", "Twelve"), ("ways", "ways"), ("to", "to"), ("crave.", "crave.")],
    "L7": [("Fries.", "Fries."), ("Seventy-nine.", "Seventy-nine.")],
    "L8": [("Finally", "Finally,"), ("a", "a"), ("cheat", "cheat"), ("meal", "meal"), ("that", "that"), ("isn't", "isn't"), ("cheating", "cheating.")],
    "L9": [("HUNGRILLZ.", "Hungrillz."), ("NEAR", "Near"), ("TCS,", "TCS,"), ("ADIBATLA.", "{N}."), ("CRAVE.", "Crave."), ("GRILL.", "Grill."), ("REPEAT.", "Repeat.")],
}
SR_OUT = 48000
_k = None


def variant():
    return int(re.search(r"NAME_VARIANT[^=]*=\s*(\d)", (ROOT / "reel/src/v19/voice.ts").read_text()).group(1))


def engine():
    global _k
    if _k is None:
        from kokoro_onnx import Kokoro

        _k = Kokoro(str(KOKORO / "kokoro-v1.0.onnx"), str(KOKORO / "voices-v1.0.bin"))
    return _k


def synth(text, nv, voice=VOICE):
    k = engine()
    if nv == 3 and "{N}" in text:  # phoneme path for the stretched name
        ph = k.tokenizer.phonemize(text.replace("{N}", "Aadi Batla"), "en-us").replace("ˈɑːdi bˈætlə", NAME3_PH)
        a, sr = k.create(ph, voice=voice, speed=SPEED, is_phonemes=True, **PAUSES)
    else:
        a, sr = k.create(text.replace("{N}", NAMES[nv] or ""), voice=voice, speed=SPEED, lang="en-us", **PAUSES)
    a = np.asarray(a, np.float32)
    idx = np.nonzero(np.abs(a) > 0.02 * np.abs(a).max())[0]
    a = a[idx[0]: idx[-1] + 1]
    e, hop = env(a, sr)  # cut the breathy release once it is 30 dB under the peak
    loud = np.nonzero(e > e.max() * 10 ** (-30 / 20))[0]
    return a[: min(len(a), int((loud[-1] + 2) * hop * sr))], sr


def env(x, sr, ms=10):
    h = int(sr * ms / 1000)
    return np.array([np.sqrt(np.mean(x[i:i + h] ** 2)) for i in range(0, len(x) - h, h)]), ms / 1000


def gaps(e, hop, db=-32, min_ms=35):
    """Silent stretches in the take as (start, end, length) in seconds."""
    quiet = e < e.max() * 10 ** (db / 20)
    out, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) * hop >= min_ms / 1000 and i > 0 and j < len(quiet):
                out.append((i * hop, j * hop, (j - i) * hop))
            i = j
        else:
            i += 1
    return out


def spans(e, hop, t0, t1):
    """Silences inside [t0, t1) of an envelope, as absolute (start, end, length)."""
    a, b = int(t0 / hop), int(t1 / hop)
    return [(g0 + a * hop, g1 + a * hop, n) for g0, g1, n in gaps(e[a:b], hop)] if b - a > 4 else []


BREATH = 0.10  # silence between sentences


def timings(parts, nv, voice=VOICE):
    """One line = its sentences read one by one and joined with a short breath, so every sentence
    edge is exact (and "Crave. Grill. Repeat." keeps a beat between words). Inside a sentence a
    comma takes its longest silence; the other words share the time by phoneme count, snapped to
    the nearest energy valley and never closer than 80 ms."""
    k = engine()
    sents, cur = [], []
    for i, (_, s) in enumerate(parts):
        cur.append(i)
        if s.endswith("."):
            sents.append(cur)
            cur = []
    if cur:
        sents.append(cur)
    ph = [max(1, len(re.sub(r"[ˈˌ.,! ]", "", k.tokenizer.phonemize(s.replace("{N}", NAMES[nv] or "Aadi Batla"), "en-us")))) for _, s in parts]
    audio, words, t = [], [None] * len(parts), 0.0
    for si, idx in enumerate(sents):
        x, sr = synth(" ".join(parts[i][1] for i in idx), nv, voice)
        e, hop = env(x, sr)
        dur = len(x) / sr
        starts, ends = {0: 0.0}, {len(idx) - 1: dur}
        commas = [n for n, i in enumerate(idx[:-1]) if parts[i][1].endswith(",")]
        if commas:
            g = sorted(gaps(e, hop), key=lambda q: -q[2])[:len(commas)]
            for n, (g0, g1, _) in zip(commas, sorted(g)):
                ends[n], starts[n + 1] = g0, g1
        n = 0
        while n < len(idx):
            m = n
            while m not in ends:
                m += 1
            t0, t1 = starts[n], ends[m]
            w = np.array(ph[idx[n]:idx[m] + 1], float)
            prev = t0
            for j, b in zip(range(n + 1, m + 1), t0 + np.cumsum(w)[:-1] / w.sum() * (t1 - t0)):
                lo = max(int((b - 0.07) / hop), int((prev + 0.08) / hop))
                hi = min(len(e) - 1, int((b + 0.07) / hop), int((t1 - 0.08) / hop))
                v = (lo + int(np.argmin(e[lo:hi + 1]))) * hop + hop / 2 if hi > lo else b
                starts[j], ends[j - 1] = v, v
                prev = v
            n = m + 1
        for n, i in enumerate(idx):
            words[i] = {"word": parts[i][0], "start": round(float(t + starts[n]), 3), "end": round(float(t + ends[n]), 3)}
        audio.append(x)
        t += dur
        if si < len(sents) - 1:
            audio.append(np.zeros(int(BREATH * sr), np.float32))
            t += BREATH
    return np.concatenate(audio), sr, words


def finish(x, sr, dst):
    """Trimmed take -> 48 kHz mono, -16 LUFS, 80 ms of silence at each end (the reel's voice bus does the rest)."""
    pad = np.zeros(int(0.08 * sr), np.float32)
    f = int(0.008 * sr)
    x = x.copy()
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    tmp = dst.with_suffix(".raw.wav")
    wavfile.write(str(tmp), sr, (np.clip(np.concatenate([pad, x, pad]), -1, 1) * 32767).astype(np.int16))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-af", "highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=7:linear=true",
                    "-ar", str(SR_OUT), "-ac", "1", str(dst)], check=True)
    tmp.unlink()
    r, y = wavfile.read(str(dst))
    return len(y) / r


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    nv = variant()
    meta = {"voice": f"kokoro-onnx v1.0 {VOICE}", "speed": SPEED, "nameVariant": nv, "lines": {}}
    for key, parts in LINES.items():
        x, sr, words = timings(parts, nv)
        d = finish(x, sr, OUT / f"{key}.wav")
        words = [{**w, "start": round(w["start"] + 0.08, 3), "end": round(w["end"] + 0.08, 3)} for w in words]
        meta["lines"][key] = {"file": f"audio/v19/vo/{key}.wav", "duration": round(d, 3), "words": words}
        print(key, round(d, 2), [(w["word"], w["start"]) for w in words])
    (OUT / "vo19.json").write_text(json.dumps(meta, indent=1))


def mp3(x, sr, name):
    wav = ROOT / "out/_tmp.wav"
    finish(x, sr, wav)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "192k", str(ROOT / "out" / name)], check=True)
    wav.unlink()
    print("out/" + name)


def tests():
    for nv in (1, 2, 3):
        x, sr = synth("Near TCS, {N}.", nv)
        mp3(x, sr, f"voice-test-{nv}.mp3")


def audition():
    gap = np.zeros(int(0.5 * 24000), np.float32)
    for v in ("am_michael", "am_onyx", "am_fenrir", "bm_george"):
        a, sr = synth("Shawarma. From one twenty-nine.", 1, v)
        b, _ = synth("Hungrillz. Near TCS, {N}. Crave. Grill. Repeat.", 1, v)
        mp3(np.concatenate([a, gap, b]), sr, f"voice-audition-{v}.mp3")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    tests() if arg == "tests" else audition() if arg == "audition" else main()
