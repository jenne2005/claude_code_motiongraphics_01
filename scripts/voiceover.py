"""Voiceover: edge-tts (en-US-GuyNeural, rate -5%) -> one WAV per line + word timings.

Usage: python3 scripts/voiceover.py
Outputs: reel/public/audio/vo/vo-0N.wav (48 kHz mono, loudness-normalised)
         reel/public/audio/vo/vo-timings.json  (per line: duration + word start/end in seconds)
Fallbacks if edge-tts is unreachable: piper (en-us-ryan-high in ~/.piper), then macOS `say`.
"""
import asyncio
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "reel/public/audio/vo"
VOICE, RATE, PITCH = "en-US-GuyNeural", "-5%", "-4Hz"  # slight pitch drop for a deeper, calmer read

LINES = [
    "Everything we make... is on fire.",
    "Shawarma. From one twenty-nine.",
    "Burgers. From one nineteen.",
    "Sandwiches. From one oh nine.",
    "Kebabs. Twelve ways to crave.",
    "Fries. Seventy-nine.",
    "Finally... a cheat meal that isn't cheating.",
    "Hungrillz. Crave. Grill. Repeat.",
]


async def edge_line(text, mp3):
    import edge_tts

    import os

    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    com = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary", proxy=proxy)
    words = []
    with open(mp3, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                s = chunk["offset"] / 1e7
                words.append({"word": chunk["text"], "start": round(s, 3), "end": round(s + chunk["duration"] / 1e7, 3)})
    return words


PIPER_MODEL = Path.home() / ".piper/en-us-ryan-high.onnx"
PAUSE = {"...": 0.48, ".": 0.30, ",": 0.16}  # designed pauses: calm, deliberate read


def _pieces(text):
    """Split a line at '...', '.' and ',' so pauses are placed exactly, keeping each piece's punctuation."""
    import re

    parts = re.findall(r"[^.,]+(?:\.\.\.|\.|,)?", text)
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        punct = "..." if p.endswith("...") else (p[-1] if p[-1] in ".," else "")
        out.append((p, punct))
    return out


def piper_line(text, wav):
    """Piper TTS (en-US ryan, high). Word timings come from cumulative-prefix synthesis of each piece."""
    import numpy as np
    from piper import PiperVoice, SynthesisConfig
    from scipy.io import wavfile

    voice = PiperVoice.load(str(PIPER_MODEL))
    sr = voice.config.sample_rate
    cfg = SynthesisConfig(length_scale=1.05, noise_scale=0.55, noise_w_scale=0.35)  # rate -5%, steady

    def synth(t):
        a = np.concatenate([c.audio_float_array for c in voice.synthesize(t, cfg)])
        nz = np.nonzero(np.abs(a) > 0.01)[0]  # trim edge silence
        return a[nz[0]: nz[-1] + 1] if len(nz) else a

    audio, words, t0 = [], [], 0.0
    for piece, punct in _pieces(text):
        a = synth(piece)
        dur = len(a) / sr
        toks = piece.rstrip(".,").replace("...", "").split()
        # Word boundaries: split the piece by phoneme weight (vowels count more), then snap each
        # boundary to the quietest 10 ms frame within +-70 ms (the natural dip between words).
        def weight(w):
            ph = [x for x in sum(voice.phonemize(w), []) if x not in "ˈˌ.,! "]
            return sum(1.7 if x in "aeiouæɑɐɒɔəɚɛɜɪʊʌyɨøœ" else 1.0 for x in ph) or 1.0
        wts = [weight(w) for w in toks]
        hop = int(sr * 0.01)
        env = np.array([np.sqrt(np.mean(a[i:i + hop] ** 2)) for i in range(0, max(len(a) - hop, 1), hop)])
        bounds, acc = [], 0.0
        for wt in wts[:-1]:
            acc += wt
            est = dur * acc / sum(wts)
            c = int(est / 0.01)
            lo, hi = max(1, c - 7), min(len(env) - 1, c + 7)
            bounds.append((lo + int(np.argmin(env[lo:hi + 1]))) * 0.01 if hi > lo else est)
        edges = [0.0] + bounds + [dur]
        for w, s0, e0 in zip(toks, edges[:-1], edges[1:]):
            words.append({"word": w.strip(".,"), "start": round(t0 + s0, 3), "end": round(t0 + e0, 3)})
        audio.append(a)
        gap = PAUSE.get(punct, 0.0)
        audio.append(np.zeros(int(gap * sr), np.float32))
        t0 += dur + gap
    full = np.concatenate(audio[:-1]) if len(audio) > 1 else audio[0]
    wavfile.write(str(wav), sr, (np.clip(full, -1, 1) * 32767).astype(np.int16))
    return words


def say_line(text, wav):
    aiff = wav.with_suffix(".aiff")
    subprocess.run(["say", "-v", "Daniel", "-o", str(aiff), text], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(aiff), str(wav)], check=True)
    aiff.unlink()
    return []


DEEPEN = ""  # set per engine in main(); piper gets a small pitch drop for a deeper read


def to_wav(src, wav):
    # trim edge silence, gentle warmth (low-shelf), loudness-normalise to -16 LUFS, 48 kHz mono
    af = (
        "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,"
        "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,"
        f"{DEEPEN}equalizer=f=140:t=q:w=1:g=2.5,loudnorm=I=-16:TP=-1.5:LRA=7"
    )
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", af, "-ar", "48000", "-ac", "1", str(wav)], check=True)


def duration(wav):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)], capture_output=True, text=True)
    return round(float(r.stdout.strip()), 3)


def leading_trim(src):
    """Seconds of leading silence removed by to_wav, so word timings can be shifted to match."""
    r = subprocess.run(
        ["ffmpeg", "-i", str(src), "-af", "silencedetect=n=-50dB:d=0.02", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    for line in r.stderr.splitlines():
        if "silence_end" in line:
            t = float(line.split("silence_end:")[1].split("|")[0])
            first_start = r.stderr.split("silence_start:")[1].split()[0] if "silence_start:" in r.stderr else "1"
            return t if float(first_start) < 0.01 else 0.0
    return 0.0


EDGE_BLOCKED = False


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    timings = {"voice": VOICE, "rate": RATE, "pitch": PITCH, "wordTimingMethod": "edge-tts WordBoundary", "lines": []}
    for i, text in enumerate(LINES, 1):
        wav = OUT / f"vo-{i:02d}.wav"
        mp3 = OUT / f"_vo-{i:02d}.mp3"
        engine, words = "edge-tts", None
        if not EDGE_BLOCKED:
            for attempt in range(3):
                try:
                    words = await edge_line(text, mp3)
                    break
                except Exception as e:
                    print(f"  edge-tts attempt {attempt + 1} failed: {e}")
            if words is None:
                globals()["EDGE_BLOCKED"] = True
        global DEEPEN
        DEEPEN = ""
        if words is None:
            mp3 = mp3.with_suffix(".wav")
            if PIPER_MODEL.exists():
                engine, words = "piper", piper_line(text, mp3)
                DEEPEN = "asetrate=22050*0.93,aresample=48000,atempo=1/0.93,"
            elif shutil.which("say"):
                engine, words = "say", say_line(text, mp3)
            else:
                raise RuntimeError("no TTS engine available (edge-tts, piper, say)")
        shift = leading_trim(mp3)
        to_wav(mp3, wav)
        mp3.unlink()
        for w in words:
            w["start"] = round(max(0.0, w["start"] - shift), 3)
            w["end"] = round(max(0.0, w["end"] - shift), 3)
        d = duration(wav)
        timings["lines"].append({"id": i, "file": f"audio/vo/{wav.name}", "text": text, "engine": engine, "duration": d, "words": words})
        print(f"{wav.name}  {d:.2f}s  {engine}  {' '.join(w['word'] for w in words)}")
    if EDGE_BLOCKED:
        timings["voice"] = "piper en-us-ryan-high (edge-tts unreachable)"
        timings["rate"], timings["pitch"] = "-5% (length_scale 1.05)", "-1.3 semitones"
        timings["wordTimingMethod"] = "estimated: phoneme-weighted split snapped to energy dips; expect +-60 ms"
    (OUT / "vo-timings.json").write_text(json.dumps(timings, indent=2))


asyncio.run(main())
