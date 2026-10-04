"""v1.8 voice: lines 2 and 9 with "TCS" said simply and naturally (one quick run, the way people say it),
assembled from Piper Ryan clips, then the v1 chain over the joined line.
Also makes tightened copies of v1 lines 1 and 8 (only the long ellipsis pause is shortened).

Usage: python3 scripts/voice_v17.py          # L1, L2, L8, L9 -> reel/public/audio/v17/vo/
       python3 scripts/voice_v17.py tests    # out/voice-test-1/2/3.mp3
"""
import json
import re
import subprocess
import sys
import types
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "reel/public/audio/v18/vo"
_src = (Path(__file__).resolve().parent / "voiceover.py").read_text().replace("asyncio.run(main())", "")
v1 = types.ModuleType("voiceover_v1")
v1.__file__ = str(Path(__file__).resolve().parent / "voiceover.py")
exec(compile(_src, str(Path(__file__).resolve().parent / "voiceover.py"), "exec"), v1.__dict__)
DEEPEN = "asetrate=22050*0.93,aresample=48000,atempo=1/0.93,"  # the v1 pitch drop
NAMES = {1: "Aadi Batla", 2: "Aa-di Bat-la", 3: "Aadi Batla"}
SR = 22050


def variant():
    return int(re.search(r"NAME_VARIANT[^=]*=\s*(\d)", (ROOT / "reel/src/v18/voice.ts").read_text()).group(1))


_voice = None


def clip(text, stretch=False):
    """One Piper Ryan take (v1 synthesis settings), trimmed tight."""
    global _voice
    from piper import PiperVoice, SynthesisConfig

    if _voice is None:
        _voice = PiperVoice.load(str(v1.PIPER_MODEL))
    cfg = SynthesisConfig(length_scale=1.05, noise_scale=0.55, noise_w_scale=0.35)
    if stretch:  # variant 3: lengthen the first vowel at the phoneme level
        ph = _voice.phonemize(text)
        out = []
        for sent in ph:
            s2, i = [], 0
            while i < len(sent):
                if sent[i:i + 3] == ["ˈ", "ɑ", "ː"]:
                    s2 += ["ˈ", "ɑ", "ː", "ː", "ː", "ː"]
                    i += 3
                else:
                    s2.append(sent[i])
                    i += 1
            out.append(s2)
        ids = [_voice.phonemes_to_ids(s) for s in out]
        a = np.concatenate([_voice.phoneme_ids_to_audio(i, cfg) for i in ids]).astype(np.float32)
    else:
        a = np.concatenate([c.audio_float_array for c in _voice.synthesize(text, cfg)])
    nz = np.nonzero(np.abs(a) > 0.012)[0]
    return a[nz[0]: nz[-1] + 1] if len(nz) else a


def fade(x, ms=10):
    n = int(SR * ms / 1000)
    x = x.copy()
    x[:n] *= np.linspace(0, 1, n)
    x[-n:] *= np.linspace(1, 0, n)
    return x


def gap(ms):
    return np.zeros(int(SR * ms / 1000), np.float32)


def rise(x, semitones=0.8):
    """Slight rising pitch on the last letter (varispeed)."""
    k = 2 ** (semitones / 12)
    return resample_poly(x, 1000, int(round(1000 * k))).astype(np.float32)


def tcs():
    """T-C-S as three separate letter clips, 55 ms apart, rising a touch on S."""
    t, c, s = clip("tee."), clip("see."), clip("ess.")
    return np.concatenate([fade(t), gap(55), fade(c), gap(55), fade(rise(s))])


def join(parts):
    """90 ms gaps with light crossfades at each edge, plus a word-timing table."""
    out, words, t = [], [], 0.0
    for i, (word, a) in enumerate(parts):
        a = fade(a, 15)
        words.append({"word": word, "start": round(t, 3), "end": round(t + len(a) / SR, 3)})
        out.append(a)
        t += len(a) / SR
        if i < len(parts) - 1:
            out.append(gap(90))
            t += 0.09
    return np.concatenate(out), words


def chain(raw, dst):
    """The v1 chain (pitch drop, warmth EQ, loudnorm), then 80 ms of silence at each end."""
    tmp = dst.with_suffix(".raw.wav")
    wavfile.write(str(tmp), SR, (np.clip(raw, -1, 1) * 32767).astype(np.int16))
    v1.DEEPEN = DEEPEN
    v1.to_wav(tmp, dst)
    tmp.unlink()
    sr, y = wavfile.read(str(dst))
    y = y.astype(np.float32) / 32768
    idx = np.nonzero(np.abs(y) > 0.01 * np.abs(y).max())[0]
    lead = idx[0] / sr
    pad = np.zeros(int(0.08 * sr), np.float32)
    y = np.concatenate([pad, y[idx[0]: idx[-1] + 1], pad])
    wavfile.write(str(dst), sr, (y * 32767).astype(np.int16))
    return lead - 0.08, len(y) / sr


def near_tcs():
    """'Near TCS,' in one natural take; TCS start estimated from the 'Near' take alone."""
    whole = clip("Near TCS,")
    near = clip("Near")
    return whole, min(len(near) / SR + 0.02, len(whole) / SR * 0.45)


def build(kind, nv, dst):
    name = clip(NAMES[nv], stretch=nv == 3)
    nt, tcs_at = near_tcs()
    if kind == "L2":
        parts = [("NEAR", nt), ("ADIBATLA.", name)]
    else:
        parts = [("HUNGRILLZ.", clip("Hungrillz.")), ("NEAR", nt), ("ADIBATLA.", name),
                 ("CRAVE.", clip("Crave.")), ("GRILL.", clip("Grill.")), ("REPEAT.", clip("Repeat."))]
    raw, words = join(parts)
    # split the "Near TCS," take into its two caption words
    i = next(k for k, w in enumerate(words) if w["word"] == "NEAR")
    w = words[i]
    words[i:i + 1] = [{"word": "NEAR", "start": w["start"], "end": round(w["start"] + tcs_at, 3)},
                      {"word": "TCS,", "start": round(w["start"] + tcs_at, 3), "end": w["end"]}]
    shift, dur = chain(raw, dst)
    return [{**w, "start": round(max(0, w["start"] - shift), 3), "end": round(max(0, w["end"] - shift), 3)} for w in words], round(dur, 3)


def tighten(src, dst, cut_from, cut_to, keep=0.22):
    """Shorten one long pause in a v1 line (no change to speed or delivery)."""
    sr, x = wavfile.read(str(src))
    a, b = int(cut_from * sr), int(cut_to * sr)
    keep_n = int(keep * sr)
    y = np.concatenate([x[:a + keep_n // 2], x[b - keep_n // 2:]])
    wavfile.write(str(dst), sr, y)
    return len(y) / sr, (b - a - keep_n) / sr


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    nv = variant()
    v1t = {l["id"]: l for l in json.loads((ROOT / "reel/public/audio/vo/vo-timings.json").read_text())["lines"]}
    meta = {"voice": "piper en-us-ryan-high + v1 chain", "nameVariant": nv, "lines": {}}
    for key, vid in (("L1", 1), ("L8", 7)):
        w = v1t[vid]["words"]
        # longest inter-word gap = the "..." pause
        gaps = [(w[i + 1]["start"] - w[i]["end"], i) for i in range(len(w) - 1)]
        g, i = max(gaps)
        d, removed = tighten(ROOT / "reel/public" / v1t[vid]["file"], OUT / f"{key}.wav", w[i]["end"], w[i + 1]["start"])
        words = [{**x, "start": round(x["start"] - (removed if j > i else 0), 3), "end": round(x["end"] - (removed if j > i else 0), 3)} for j, x in enumerate(w)]
        meta["lines"][key] = {"file": f"audio/v17/vo/{key}.wav", "duration": round(d, 3), "words": words}
    for key in ("L2", "L9"):
        words, d = build(key, nv, OUT / f"{key}.wav")
        meta["lines"][key] = {"file": f"audio/v17/vo/{key}.wav", "duration": d, "words": words}
    for k, v in meta["lines"].items():
        print(k, v["duration"], [(w["word"], w["start"]) for w in v["words"]])
    (OUT / "vo17.json").write_text(json.dumps(meta, indent=1))


def tests():
    for nv in (1, 2, 3):
        wav = ROOT / f"out/_vt{nv}.wav"
        build("L2", nv, wav)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "192k", str(ROOT / f"out/voice-test-{nv}.mp3")], check=True)
        wav.unlink()
        print(f"out/voice-test-{nv}.mp3")


if __name__ == "__main__":
    tests() if len(sys.argv) > 1 and sys.argv[1] == "tests" else main()
