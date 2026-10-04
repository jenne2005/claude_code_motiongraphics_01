"""v1.7 hook: verify the kick clip and export it BRIGHT and natural (only +10% contrast, +8% saturation).

Usage: python3 scripts/hook_v17.py
Writes out/hook-analysis.json, reel/public/hook17/fNNN.png (timeline frames before the cut),
       reel/public/audio/v17/kick.wav (source 0.98-1.16 s, HP 120 Hz, +4 dB).
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hook_v16 as analysis  # noqa: E402  (shared measurement code: flow, energy, kick onset)

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / "reel/public/hook17"
AUDIO = ROOT / "reel/public/audio/v17"
START = analysis.START_SRC  # source frame 14 (0.467 s) = timeline 0


def pop(frame):
    """+10 % contrast, +8 % saturation. Nothing else: no tint, no darkening, no vignette."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.08, 0, 255)
    f = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    f = (f - 128) * 1.10 + 128
    return np.clip(f, 0, 255).astype(np.uint8)


def main():
    frames = analysis.read_frames()
    a, x, sr = analysis.analyse(frames)
    a["grade"] = "bright natural: +10% contrast, +8% saturation only"
    (ROOT / "out/hook-analysis.json").write_text(json.dumps(a, indent=1))
    FRAMES.mkdir(parents=True, exist_ok=True)
    cut = a["edit"]["cut_source_frame"]
    for tl, src in enumerate(range(START, cut)):
        cv2.imwrite(str(FRAMES / f"f{tl:03d}.png"), pop(frames[src]))
    i0, i1 = int(0.98 * sr), int(1.16 * sr)
    k = sosfilt(butter(2, 120, "highpass", fs=sr, output="sos"), x[i0:i1]) * 10 ** (4 / 20)
    f = int(0.003 * sr)
    k[:f] *= np.linspace(0, 1, f)
    k[-f * 4:] *= np.linspace(1, 0, f * 4)
    AUDIO.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(AUDIO / "kick.wav"), sr, (np.clip(k, -1, 1) * 32767).astype(np.int16))
    e = a["edit"]
    print(json.dumps({"kick": a["kick_audio"], "flow_peak": a["flow_peak"], "cut": e}, indent=1))


if __name__ == "__main__":
    main()
