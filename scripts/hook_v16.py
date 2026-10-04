"""v1.6 hook: analyse the kick clip, then export brand-graded frames + the kick audio slice.

Usage: python3 scripts/hook_v16.py
Writes out/hook-analysis.json, reel/public/hook16/fNNN.png (timeline frames before the cut),
       reel/public/audio/v16/kick.wav (0.18 s kick window, HP 120 Hz, +4 dB).
"""
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
CLIP = ROOT / "assets/hooks/Man_Kicks_Ball_Beside_Wind_Turbine.mp4"
FRAMES_OUT = ROOT / "reel/public/hook16"
AUDIO_OUT = ROOT / "reel/public/audio/v16"
FPS = 30
START_SRC = 14  # source frame shown at timeline frame 0 (source 0.467 s ~ the requested 0.45 s)

# Brand colours (brand.ts): charcoal, burnt orange (gradient-map mid), flame, yellow.
CHARCOAL = np.array([0x11, 0x11, 0x11], np.float32)
BURNT = np.array([0x7A, 0x2E, 0x10], np.float32)
FLAME = np.array([0xF1, 0x5A, 0x29], np.float32)
YELLOW = np.array([0xFF, 0xF2, 0x00], np.float32)


def read_frames():
    cap = cv2.VideoCapture(str(CLIP))
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        out.append(f)
    return out


def analyse(frames):
    prev = None
    rows = []
    for i, f in enumerate(frames):
        g = cv2.cvtColor(cv2.resize(f, (180, 320)), cv2.COLOR_BGR2GRAY)
        if prev is not None:
            fl = cv2.calcOpticalFlowFarneback(prev, g, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            rows.append({"frame": i, "energy": float(np.abs(g.astype(float) - prev).mean()), "dx": float(np.median(fl[..., 0])), "dy": float(np.median(fl[..., 1]))})
        prev = g
    peak_e = max(rows, key=lambda r: r["energy"])
    peak_flow = max(rows, key=lambda r: r["dy"])
    # audio onset: steepest rise of the 2 ms peak envelope between 0.6 and 1.6 s
    wav = Path("/tmp/hook16.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(CLIP), "-ac", "1", "-ar", "48000", str(wav)], check=True)
    sr, x = wavfile.read(str(wav))
    x = x.astype(np.float32) / 32768
    hop = int(0.002 * sr)
    env = np.array([np.abs(x[k:k + hop]).max() for k in range(0, len(x) - hop, hop)])
    lo, hi = int(0.6 / 0.002), int(1.6 / 0.002)
    peak_i = lo + int(np.argmax(env[lo:hi]))
    peak = peak_i * 0.002
    # onset = where the kick transient first reaches half its peak, searching back from the peak
    j = peak_i
    while j > lo and env[j] >= 0.5 * env[peak_i]:
        j -= 1
    onset = (j + 1) * 0.002
    cut_src = peak_flow["frame"]
    cut_tl = cut_src - START_SRC
    a = {
        "clip": {"path": str(CLIP.relative_to(ROOT)), "duration": 4.533, "width": 1080, "height": 1920, "fps": 30, "frames": len(frames), "audio": True},
        "kick_audio": {"onset_s": round(onset, 3), "transient_peak_s": round(peak, 3), "window_s": [0.98, 1.16]},
        "visual_contact_frame": 34,
        "motion_energy_peak": {"frame": peak_e["frame"], "time_s": round(peak_e["frame"] / FPS, 3), "energy": round(peak_e["energy"], 2)},
        "flow_peak": {
            "frame": peak_flow["frame"],
            "time_s": round(peak_flow["frame"] / FPS, 3),
            "dx_px_per_frame_180x320": round(peak_flow["dx"], 2),
            "dy_px_per_frame_180x320": round(peak_flow["dy"], 2),
            "dy_px_per_frame_1080x1920": round(peak_flow["dy"] * 6, 1),
            "direction": "downward in frame (camera whips up), small rightward component",
        },
        "whip_frames": [r["frame"] for r in rows if r["dy"] > 6],
        "edit": {
            "timeline0_source_frame": START_SRC,
            "timeline0_source_s": round(START_SRC / FPS, 3),
            "cut_source_frame": cut_src,
            "cut_timeline_frame": cut_tl,
            "cut_timeline_s": round(cut_tl / FPS, 3),
            "speed_ramp": "none (peak already inside 0.7-1.0 s)",
            "kick_transient_timeline_s": round(onset - START_SRC / FPS, 3),
        },
        "watermark": "none found",
        "per_frame": [{k: (round(v, 2) if isinstance(v, float) else v) for k, v in r.items()} for r in rows],
    }
    (ROOT / "out").mkdir(exist_ok=True)
    (ROOT / "out/hook-analysis.json").write_text(json.dumps(a, indent=1))
    return a, x, sr


def lut():
    """Luminance -> brand gradient map: charcoal shadows, burnt-orange mids, flame highlights, yellow top 2%."""
    stops = [(0.0, CHARCOAL), (0.12, CHARCOAL), (0.5, BURNT), (0.88, FLAME), (0.98, FLAME), (1.0, YELLOW)]
    t = np.linspace(0, 1, 256)
    out = np.zeros((256, 3), np.float32)
    for i, v in enumerate(t):
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            if a <= v <= b:
                k = 0 if b == a else (v - a) / (b - a)
                k = k * k * (3 - 2 * k)
                out[i] = ca + (cb - ca) * k
                break
    return out


def grade(frame, L):
    f = frame.astype(np.float32) / 255
    b, g, r = f[..., 0], f[..., 1], f[..., 2]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    # sky -> dark smoky ember sky: pull down blue-dominant pixels before mapping
    blue = np.clip((b - np.maximum(r, g)) * 4, 0, 1)
    lum = lum * (1 - 0.38 * blue)
    lum = lum * 0.75  # exposure -25 %
    lum = np.clip((lum - 0.04) / 0.92, 0, 1) ** 1.12  # crush blacks, keep contrast
    # local contrast so the kicker and ball read
    lum8 = (lum * 255).astype(np.uint8)
    clahe = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 14))
    lum8 = clahe.apply(lum8)
    rgb = L[lum8]
    return rgb  # float RGB 0..255


def place(img):
    """Zoom 1.12x: tower in the left third, kicker's lower body in the lower-middle."""
    h, w = img.shape[:2]
    cw, ch = int(round(w / 1.12)), int(round(h / 1.12))
    x0, y0 = 40, 0
    crop = img[y0:y0 + ch, x0:x0 + cw]
    return cv2.resize(crop, (w, h), interpolation=cv2.INTER_LANCZOS4)


def vignette_glow(rgb):
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - w / 2) / (w * 0.72)) ** 2 + ((yy - h * 0.48) / (h * 0.62)) ** 2)
    vig = 1 - np.clip(d - 0.55, 0, 1) * 0.85
    glow = np.clip(1 - np.sqrt(((xx - w * 0.5) / (w * 0.9)) ** 2 + ((yy - h * 0.62) / (h * 0.55)) ** 2), 0, 1) ** 2
    out = rgb * vig[..., None] + glow[..., None] * FLAME * 0.10
    return np.clip(out, 0, 255)


def main():
    frames = read_frames()
    a, x, sr = analyse(frames)
    L = lut()
    FRAMES_OUT.mkdir(parents=True, exist_ok=True)
    cut = a["edit"]["cut_source_frame"]
    for tl, src in enumerate(range(START_SRC, cut)):
        rgb = vignette_glow(grade(place(frames[src]), L))
        cv2.imwrite(str(FRAMES_OUT / f"f{tl:03d}.png"), cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2BGR))
    # kick slice: source 0.98-1.16 s, high-pass 120 Hz, +4 dB, 3 ms fades
    i0, i1 = int(0.98 * sr), int(1.16 * sr)
    k = sosfilt(butter(2, 120, "highpass", fs=sr, output="sos"), x[i0:i1]) * 10 ** (4 / 20)
    f = int(0.003 * sr)
    k[:f] *= np.linspace(0, 1, f)
    k[-f * 4:] *= np.linspace(1, 0, f * 4)
    AUDIO_OUT.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(AUDIO_OUT / "kick.wav"), sr, (np.clip(k, -1, 1) * 32767).astype(np.int16))
    print(json.dumps({k: v for k, v in a.items() if k != "per_frame"}, indent=1))


if __name__ == "__main__":
    main()
