"""v1.6 voice: generate only the new lines (2 and 9) with the v1 Piper Ryan voice and chain.

Usage: python3 scripts/voice_v16.py          # lines 2 + 9 for NAME_VARIANT (reel/src/v16/voice.ts)
       python3 scripts/voice_v16.py tests    # out/voice-test-1/2/3.mp3
Unchanged lines reuse reel/public/audio/vo/vo-0N.wav from v1.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile

import types

# Load the v1 Piper engine, pacing and chain WITHOUT running the v1 script (its last line renders all v1 lines).
_src = (Path(__file__).resolve().parent / "voiceover.py").read_text()
_src = _src.replace("asyncio.run(main())", "")
v1 = types.ModuleType("voiceover_v1")
v1.__file__ = str(Path(__file__).resolve().parent / "voiceover.py")
exec(compile(_src, v1.__file__, "exec"), v1.__dict__)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "reel/public/audio/v16/vo"
NAMES = {1: "Aadi Batla", 2: "Aa-di Bat-la", 3: "Aadi Batla"}  # 3 = variant 1 spelling with the first vowel stretched
DEEPEN = "asetrate=22050*0.93,aresample=48000,atempo=1/0.93,"  # exactly the v1 pitch drop


def variant():
    return int(re.search(r"NAME_VARIANT[^=]*=\s*(\d)", (ROOT / "reel/src/v16/voice.ts").read_text()).group(1))


def stretch_first_vowel(on):
    """Variant 3: lengthen the first vowel of 'Aadi' (ˈɑː -> ˈɑːːː) at the phoneme level."""
    from piper import PiperVoice

    if not hasattr(PiperVoice, "_orig_phonemize"):
        PiperVoice._orig_phonemize = PiperVoice.phonemize

    def patched(self, text):
        out = PiperVoice._orig_phonemize(self, text)
        res = []
        for sent in out:
            s2, i = [], 0
            while i < len(sent):
                if sent[i:i + 4] == ["ˈ", "ɑ", "ː", "d"]:
                    s2 += ["ˈ", "ɑ", "ː", "ː", "ː", "ː", "ː", "d"]
                    i += 4
                else:
                    s2.append(sent[i])
                    i += 1
            res.append(s2)
        return res

    PiperVoice.phonemize = patched if on else PiperVoice._orig_phonemize


def render(text, dst, stretch=False):
    """v1 engine + v1 chain, then trimmed to 80 ms of silence at each end."""
    raw = dst.with_suffix(".raw.wav")
    stretch_first_vowel(stretch)
    # Same voice, same speed; only the gaps between sentences are tighter than v1's so the sign-off fits.
    v1.PAUSE = {"...": 0.40, ".": 0.17, ",": 0.12}
    words = v1.piper_line(text, raw)
    v1.DEEPEN = DEEPEN
    v1.to_wav(raw, dst)
    raw.unlink()
    sr, x = wavfile.read(str(dst))
    x = x.astype(np.float32) / 32768
    env = np.abs(x)
    idx = np.nonzero(env > 0.01 * env.max())[0]
    pad = int(0.08 * sr)
    lead = idx[0]
    y = np.concatenate([np.zeros(pad, np.float32), x[idx[0]: idx[-1] + 1], np.zeros(pad, np.float32)])
    wavfile.write(str(dst), sr, (y * 32767).astype(np.int16))
    shift = lead / sr - 0.08
    return [{**w, "start": round(max(0, w["start"] - shift), 3), "end": round(max(0, w["end"] - shift), 3)} for w in words], round(len(y) / sr, 3)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    n = NAMES[variant()]
    lines = {
        "L2": f"Near T C S, {n}.",
        "L9": f"Hungrillz. Near T C S, {n}. Crave. Grill. Repeat.",
    }
    meta = {"voice": "piper en-us-ryan-high, v1 chain (pitch -1.3 st)", "nameVariant": variant(), "lines": {}}
    for k, t in lines.items():
        words, d = render(t, OUT / f"{k}.wav", stretch=variant() == 3)
        meta["lines"][k] = {"file": f"audio/v16/vo/{k}.wav", "text": t, "duration": d, "words": words}
        print(f"{k}: {d:.2f}s  {t}")
    (OUT / "vo16.json").write_text(json.dumps(meta, indent=1))


def tests():
    for i, n in NAMES.items():
        wav = ROOT / f"out/_vt{i}.wav"
        render(f"Near T C S, {n}.", wav, stretch=i == 3)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "192k", str(ROOT / f"out/voice-test-{i}.mp3")], check=True)
        wav.unlink()
        print(f"out/voice-test-{i}.mp3  ({n})")


if __name__ == "__main__":
    tests() if len(sys.argv) > 1 and sys.argv[1] == "tests" else main()
