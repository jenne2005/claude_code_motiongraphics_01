"""Food photo treatment: background removal -> edge cleanup -> warm grade -> 1080x1920 hero.

Usage:
  python3 scripts/food_treatment.py            # all items
  python3 scripts/food_treatment.py kebab      # one item

Inputs:  raw/assets/<photo>.jpg
Outputs: reel/public/food/<id>-cutout.png  (trimmed, graded RGBA cutout)
         reel/public/food/<id>-hero.png    (1080x1920 hero on matte charcoal)

The food itself is never redrawn: only the alpha matte, the edges and a global grade are touched.
Background removal uses rembg (BiRefNet; cached cutouts in work/cutouts are reused), with an
OpenCV GrabCut fallback if rembg is unavailable.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw/assets"
CACHE = ROOT / "work/cutouts"
OUT = ROOT / "reel/public/food"
W, H = 1080, 1920
CHARCOAL = np.array([0x11, 0x11, 0x11], np.float32) / 255
FLAME = np.array([0xF1, 0x5A, 0x29], np.float32) / 255
YELLOW = np.array([0xFF, 0xF2, 0x00], np.float32) / 255

# id -> photo, original background colour (for edge decontamination), layout.
# fit = max width/height of the food on the 1080x1920 frame; cy = vertical centre;
# upright items get an elliptical contact shadow, top-down shots a soft drop shadow.
ITEMS = {
    "shawarma": dict(photo="shawarma", bg="white", fit=(860, 900), cy=930, upright=True),
    # burger: the matte also grabs out-of-focus fries and lettuce at the right edge of the photo,
    # so it is limited to a hand-placed outline of the burger itself (source pixel coordinates).
    "burger": dict(photo="burger", bg="white", fit=(900, 1000), cy=930, upright=True, keep_poly=[
        (560, 690), (800, 650), (1050, 690), (1260, 790), (1345, 960), (1325, 1080), (1292, 1110),
        (1290, 1250), (1335, 1290), (1340, 1440), (1333, 1530), (1305, 1585), (1262, 1625),
        (1190, 1660), (1000, 1695), (600, 1705), (330, 1680), (290, 1580), (220, 1520), (225, 1420), (260, 1330),
        (265, 1180), (290, 1060), (340, 960), (380, 840), (440, 750)]),
    "sandwich": dict(photo="sandwich", bg="white", fit=(960, 960), cy=940, upright=True),
    # top-down shot cropped by the photo on every side: scaled past the frame width so it bleeds
    # off left/right, and only the top/bottom dissolve into the charcoal.
    "kebab": dict(photo="kebab", bg=None, fit=(1560, 1560), cy=940, upright=False, multi=True),
    "fries": dict(photo="fries", bg="white", fit=(900, 1000), cy=920, upright=True),
}


# ---------------------------------------------------------------- matte
def get_matte(name):
    """RGBA cutout from rembg (cached), falling back to OpenCV GrabCut."""
    cached = CACHE / f"{name}-birefnet-general.png"
    if cached.exists():
        return np.array(Image.open(cached).convert("RGBA"))
    src = Image.open(RAW / f"{name}.jpg").convert("RGB")
    try:
        from rembg import new_session, remove

        out = remove(src, session=new_session("birefnet-general"))
        CACHE.mkdir(parents=True, exist_ok=True)
        out.save(cached)
        return np.array(out.convert("RGBA"))
    except Exception as e:  # pragma: no cover - fallback path
        print(f"  rembg failed ({e}); using GrabCut")
        img = np.array(src)[:, :, ::-1].copy()
        mask = np.zeros(img.shape[:2], np.uint8)
        h, w = mask.shape
        rect = (int(w * 0.03), int(h * 0.03), int(w * 0.94), int(h * 0.94))
        bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(img, mask, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
        a = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
        return np.dstack([np.array(src), a])


def clean_alpha(rgba, multi=False):
    """Drop specks (and, for single-subject shots, every piece but the main one: stray fries,
    onion rings, props), close pinholes, pull the edge in ~1px and soften it slightly."""
    a = rgba[:, :, 3].astype(np.float32) / 255
    solid = (a > 0.5).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(solid, 8)
    if n > 1:
        keep_min = 0.004 * solid.sum()
        keep = np.zeros(n, bool)
        keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= keep_min
        if not multi:
            keep[1:] = False
            keep[1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))] = True
        island = (~keep[lab]) & (solid > 0)
        a[island] = 0
        # fade the soft fringe that belonged to removed specks
        a = np.where(cv2.dilate(island.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0, a * (solid & keep[lab]), a)
    # fill small holes inside the subject
    filled = cv2.morphologyEx((a > 0.5).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    a = np.maximum(a, filled.astype(np.float32) * (cv2.GaussianBlur(a, (0, 0), 2) > 0.35))
    # choke the matte by ~1px and re-feather: removes the light fringe from the original background
    a = cv2.erode(a, np.ones((3, 3), np.uint8), iterations=1)
    a = cv2.GaussianBlur(a, (0, 0), 0.7)
    return np.clip(a, 0, 1)


def decontaminate(rgb, a, bg):
    """Remove the original background colour bleeding into semi-transparent edge pixels."""
    if bg is None:
        return rgb
    B = np.array([1.0, 1.0, 1.0], np.float32) if bg == "white" else np.array(bg, np.float32)
    edge = (a > 0.02) & (a < 0.98)
    ae = np.clip(a[..., None], 0.15, 1)
    fixed = np.clip((rgb - (1 - ae) * B) / ae, 0, 1)
    # where the solve is unstable, borrow colour from a few pixels inside the subject
    inner = cv2.GaussianBlur(rgb * (a[..., None] > 0.9), (0, 0), 3)
    wgt = cv2.GaussianBlur((a > 0.9).astype(np.float32), (0, 0), 3)[..., None]
    inner = np.where(wgt > 1e-3, inner / np.maximum(wgt, 1e-3), fixed)
    k = np.clip((0.6 - a) / 0.6, 0, 1)[..., None]  # thinnest alpha -> trust inner colour most
    out = rgb.copy()
    out[edge] = (fixed * (1 - k) + inner * k)[edge]
    return out


def fade_cut_borders(a, frac=0.12):
    """If the subject is cropped by the photo frame, dissolve that side so it doesn't end on a hard line."""
    h, w = a.shape
    out = a.copy()
    sides = {
        "left": a[:, :3].mean(), "right": a[:, -3:].mean(),
        "top": a[:3, :].mean(), "bottom": a[-3:, :].mean(),
    }
    for side, cov in sides.items():
        if cov < 0.08:
            continue
        n = int((w if side in ("left", "right") else h) * frac)
        ramp = np.linspace(0, 1, n, dtype=np.float32) ** 1.6
        if side == "left":
            out[:, :n] *= ramp[None, :]
        elif side == "right":
            out[:, -n:] *= ramp[::-1][None, :]
        elif side == "top":
            out[:n, :] *= ramp[:, None]
        else:
            out[-n:, :] *= ramp[::-1][:, None]
    return out, [s for s, c in sides.items() if c >= 0.08]


# ---------------------------------------------------------------- grade
def warm_grade(rgb):
    """Warm, punchy grade that keeps the real texture: gentle S-curve, warm balance, a little saturation."""
    x = rgb.astype(np.float32)
    # contrast S-curve around mid grey
    x = np.clip(x, 0, 1)
    x = x + 0.18 * (x - 0.5) * (1 - np.abs(2 * x - 1))
    # warm balance
    x = x * np.array([1.04, 1.0, 0.92], np.float32)
    # saturation +12%
    lum = (x * np.array([0.2126, 0.7152, 0.0722], np.float32)).sum(-1, keepdims=True)
    x = lum + (x - lum) * 1.12
    # lift deep shadows toward warm brown instead of grey
    x = x + (1 - x) * 0.0 + np.clip(0.08 - lum, 0, 0.08) * np.array([0.25, 0.08, 0.0], np.float32)
    return np.clip(x, 0, 1)


def sharpen(rgb, amount=0.35, radius=1.2):
    blur = cv2.GaussianBlur(rgb, (0, 0), radius)
    return np.clip(rgb + (rgb - blur) * amount, 0, 1)


# ---------------------------------------------------------------- hero
def radial(cx, cy, rx, ry):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    return np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)


def build_hero(rgb, a, cfg):
    h, w = a.shape
    s = min(cfg["fit"][0] / w, cfg["fit"][1] / h)
    nw, nh = int(round(w * s)), int(round(h * s))
    interp = cv2.INTER_LANCZOS4 if s > 1 else cv2.INTER_AREA
    rgb_s = np.clip(cv2.resize(rgb, (nw, nh), interpolation=interp), 0, 1)
    a_s = np.clip(cv2.resize(a, (nw, nh), interpolation=interp), 0, 1)
    if s > 1.2:
        rgb_s = sharpen(rgb_s, 0.45, 1.4)  # upscaled sources: restore some crispness

    x0 = (W - nw) // 2
    y0 = int(cfg["cy"] - nh / 2)
    layer_rgb = np.zeros((H, W, 3), np.float32)
    layer_a = np.zeros((H, W), np.float32)
    # paste with clipping
    sx0, sy0 = max(0, -x0), max(0, -y0)
    dx0, dy0 = max(0, x0), max(0, y0)
    cw, ch = min(nw - sx0, W - dx0), min(nh - sy0, H - dy0)
    layer_rgb[dy0:dy0 + ch, dx0:dx0 + cw] = rgb_s[sy0:sy0 + ch, sx0:sx0 + cw]
    layer_a[dy0:dy0 + ch, dx0:dx0 + cw] = a_s[sy0:sy0 + ch, sx0:sx0 + cw]

    ys, xs = np.nonzero(layer_a > 0.5)
    fcx, fcy = xs.mean(), ys.mean()
    bottom = np.percentile(ys, 99.2)

    # 1. matte charcoal with a faint warm floor gradient
    img = np.ones((H, W, 3), np.float32) * CHARCOAL
    floor = np.clip(1 - radial(W / 2, bottom + 40, W * 0.9, 380), 0, 1) ** 2
    img += floor[..., None] * (FLAME * 0.10)

    # 2. warm orange backlight behind the food (large soft glow + tight hot core)
    glow = np.clip(1 - radial(fcx, fcy - nh * 0.08, nw * 0.75, nh * 0.75), 0, 1) ** 2.2
    core = np.clip(1 - radial(fcx, fcy - nh * 0.05, nw * 0.45, nh * 0.42), 0, 1) ** 2.5
    img = img + glow[..., None] * FLAME * 0.55 + core[..., None] * (FLAME * 0.5 + YELLOW * 0.15)

    # 3. rim light: blurred silhouette, slightly enlarged, in flame orange, peeking out around the edge
    # (shifted up a little and weighted to the top so it reads as a backlight, not an outer glow)
    sil = cv2.GaussianBlur(cv2.dilate(layer_a, np.ones((7, 7), np.uint8)), (0, 0), 14)
    sil = np.roll(sil, -10, axis=0)
    yy = np.mgrid[0:H, 0:W][0].astype(np.float32)
    top_bias = np.clip(1.15 - (yy - (fcy - nh * 0.5)) / nh, 0.25, 1.0)
    rim = sil * top_bias
    img = img + rim[..., None] * (FLAME * 0.42 + YELLOW * 0.06)

    # 4. contact shadow (upright) or drop shadow (top-down)
    if cfg["upright"]:
        sh = np.clip(1 - radial(fcx, bottom - 6, nw * 0.46, 26), 0, 1) ** 1.4
        sh = cv2.GaussianBlur(sh, (0, 0), 9)
        tight = np.clip(1 - radial(fcx, bottom - 4, nw * 0.36, 11), 0, 1)
        sh = np.clip(sh * 0.85 + cv2.GaussianBlur(tight, (0, 0), 3) * 0.6, 0, 1)
    else:
        sh = np.roll(cv2.GaussianBlur(layer_a, (0, 0), 22), 34, axis=0) * 0.8
    img = img * (1 - sh[..., None] * 0.85)

    # 5. food on top
    img = img * (1 - layer_a[..., None]) + layer_rgb * layer_a[..., None]

    # 6. warm edge kiss on the food itself, from the backlight (subtle, edge pixels only)
    inner_edge = np.clip(layer_a - cv2.erode(layer_a, np.ones((7, 7), np.uint8)), 0, 1)
    inner_edge = cv2.GaussianBlur(inner_edge, (0, 0), 2.5) * layer_a
    up = np.clip((fcy + nh * 0.1 - np.mgrid[0:H, 0:W][0]) / (nh * 0.6), 0, 1)  # stronger on top edges
    img = img + (inner_edge * (0.25 + 0.35 * up))[..., None] * FLAME

    # 7. vignette
    v = radial(W / 2, H * 0.47, W * 0.78, H * 0.62)
    img = img * (1 - np.clip(v - 0.55, 0, 1)[..., None] * 0.85)

    # 8. very light grain to avoid banding in the gradients
    rng = np.random.default_rng(7)
    img = img + (rng.standard_normal((H, W, 1)).astype(np.float32) * 0.006)
    return np.clip(img, 0, 1)


def process(item):
    cfg = ITEMS[item]
    print(f"[{item}]")
    rgba = get_matte(cfg["photo"])
    rgb = rgba[:, :, :3].astype(np.float32) / 255
    a = clean_alpha(rgba, cfg.get("multi", False))
    if cfg.get("keep_poly"):
        poly = np.zeros(a.shape, np.uint8)
        cv2.fillPoly(poly, [np.array(cfg["keep_poly"], np.int32)], 1)
        # round the polygon's corners (blur + re-threshold), then feather the edge
        rounded = (cv2.GaussianBlur(poly.astype(np.float32), (0, 0), 22) > 0.5).astype(np.float32)
        a = a * cv2.GaussianBlur(rounded, (0, 0), 1.5)
    rgb = decontaminate(rgb, a, cfg["bg"])
    a, cut = fade_cut_borders(a)
    if cut:
        print(f"  subject cropped by photo frame on: {', '.join(cut)} (edges dissolved)")
    rgb = warm_grade(rgb)

    # trimmed cutout
    ys, xs = np.nonzero(a > 0.01)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    cut_rgba = np.dstack([rgb[y0:y1, x0:x1], a[y0:y1, x0:x1]])
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray((cut_rgba * 255 + 0.5).astype(np.uint8), "RGBA").save(OUT / f"{item}-cutout.png", optimize=True)

    hero = build_hero(rgb[y0:y1, x0:x1], a[y0:y1, x0:x1], cfg)
    Image.fromarray((hero * 255 + 0.5).astype(np.uint8), "RGB").save(OUT / f"{item}-hero.png", optimize=True)
    print(f"  cutout {x1 - x0}x{y1 - y0}, hero {W}x{H}")


if __name__ == "__main__":
    for it in sys.argv[1:] or ITEMS:
        process(it)
