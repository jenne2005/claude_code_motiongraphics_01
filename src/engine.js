// Hungrillz motion engine: a deterministic, time-driven canvas renderer.
// Every frame is a pure function of time t (seconds), so preview and export match exactly.
(function () {
  const W = 1080, H = 1920;

  // Brand palette, sampled from the official logo file (Hungrillz Logo - Final.pdf, page 1).
  const C = {
    orange: "#F15A29",
    orangeDeep: "#C9401A",
    orangeHot: "#FF7A3D",
    yellow: "#FFF200",
    gold: "#FFCB05",
    white: "#FFFFFF",
    black: "#070707",
    char: "#121212",
    ash: "#1C1C1C",
    veg: "#1FA34A", // FSSAI veg mark, shown exactly as on the printed menu
  };
  const FILL = { white: C.white, yellow: C.yellow, black: C.black, orange: C.orange };

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, t0, dur) => clamp((t - t0) / dur);
  const mix = (a, b, k) => a + (b - a) * clamp(k);

  const E = {
    linear: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    inQuart: (x) => x * x * x * x,
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    inOutExpo: (x) =>
      x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
    outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
    inBack: (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x,
    outElastic: (x) =>
      x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  };

  // Damped spring 0 -> 1 (k: stiffness-ish frequency, z: damping). Used for organic overshoot.
  const spring = (x, f = 3.2, z = 4.5) => (x <= 0 ? 0 : 1 - Math.exp(-z * x) * Math.cos(f * Math.PI * x));

  // ---------- deterministic randomness ----------
  function hash(n) {
    n = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }
  const rnd = (i, salt = 0) => hash(i * 17.13 + salt * 101.7);
  // Smooth 1D value noise in [-1, 1].
  function noise(x) {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    return lerp(hash(i), hash(i + 1), u) * 2 - 1;
  }
  const fbm = (x) => noise(x) * 0.6 + noise(x * 2.13 + 7.1) * 0.28 + noise(x * 4.7 + 3.3) * 0.12;

  // ---------- canvas helpers ----------
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function withT(ctx, fn) {
    ctx.save();
    fn();
    ctx.restore();
  }

  // Transform around a pivot: translate, rotate (rad), scale (sx, sy).
  function xform(ctx, x, y, rot = 0, sx = 1, sy = sx) {
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  }

  // ---------- typography ----------
  const FONT_BRAND = "'One Slice'";
  const FONT_COND = "'Oswald'";
  const FONT_HEAVY = "'Anton'";

  function font(px, fam = FONT_BRAND, weight = "") {
    return `${weight} ${px}px ${fam}`.trim();
  }

  // Wordmark-style text: white face, black keyline, orange offset shadow, like the logo letters.
  function brandText(ctx, str, x, y, px, opts = {}) {
    const {
      face = C.white,
      shadow = C.orange,
      keyline = C.black,
      depth = px * 0.07,
      align = "center",
      fam = FONT_BRAND,
      weight = "",
      shadowK = 1, // 0..1: how far the shadow has slid out
      tracking = 0,
    } = opts;
    ctx.font = font(px, fam, weight);
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    if (tracking) ctx.letterSpacing = `${tracking}px`;
    const d = depth * shadowK;
    ctx.lineJoin = "round";
    if (shadow && d > 0.2) {
      ctx.fillStyle = shadow;
      ctx.fillText(str, x + d, y + d);
      ctx.strokeStyle = keyline;
      ctx.lineWidth = px * 0.05;
      ctx.strokeText(str, x + d, y + d);
    }
    ctx.strokeStyle = keyline;
    ctx.lineWidth = px * 0.09;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = face;
    ctx.fillText(str, x, y);
    if (tracking) ctx.letterSpacing = "0px";
  }

  function measure(ctx, str, px, fam = FONT_BRAND, weight = "", tracking = 0) {
    ctx.font = font(px, fam, weight);
    ctx.letterSpacing = `${tracking}px`;
    const w = ctx.measureText(str).width;
    ctx.letterSpacing = "0px";
    return w;
  }

  // ---------- logo ----------
  const LOGO = window.LOGO;
  const L = {};
  LOGO.layers.forEach((l) => (L[l.name] = { ...l, path: new Path2D(l.d) }));
  const GLYPH = {};
  Object.entries(LOGO.glyphs).forEach(([k, d]) => (GLYPH[k] = new Path2D(d)));
  const LOGO_CX = 143.85, LOGO_CY = 104; // visual centre of the badge in logo units

  const center = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];

  function fillLayer(ctx, name, color) {
    const l = L[name];
    ctx.fillStyle = color || FILL[l.fill];
    ctx.fill(l.path);
  }

  // Draw a layer transformed around its own centre (or a given pivot).
  function layerAt(ctx, name, { dx = 0, dy = 0, rot = 0, sx = 1, sy = sx, alpha = 1, pivot, color } = {}) {
    if (alpha <= 0.001 || sx === 0 || sy === 0) return;
    const l = L[name];
    const [px, py] = pivot || center(l.bbox);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(px + dx, py + dy);
    if (rot) ctx.rotate(rot);
    ctx.scale(sx, sy);
    ctx.translate(-px, -py);
    fillLayer(ctx, name, color);
    ctx.restore();
  }

  function glyphRun(ctx, list, color, eachFn) {
    ctx.fillStyle = color;
    list.forEach((u, i) => {
      ctx.save();
      ctx.translate(u.x, u.y);
      if (eachFn && eachFn(ctx, u, i) === false) {
        ctx.restore();
        return;
      }
      ctx.fill(GLYPH[u.g]);
      ctx.restore();
    });
  }

  // ---------- flames ----------
  // A single stylised flame tongue (flat, like the logo flame).
  // Rounded belly, S-curved tip that bends with the sway: reads as cartoon fire, not spikes.
  function tongue(ctx, x, baseY, w, h, sway, curl = 0) {
    const tipX = x + sway, tipY = baseY - h;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, baseY);
    ctx.bezierCurveTo(x - w * 1.05, baseY - h * 0.42, tipX - sway * 1.1 - w * 0.2 + curl, tipY + h * 0.4, tipX, tipY);
    ctx.bezierCurveTo(tipX - sway * 0.35 + w * 0.05, tipY + h * 0.3, x + w * 1.0, baseY - h * 0.45, x + w / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // A wall of fire rising from baseY. level 0..1 drives height. Layers orange -> gold -> yellow.
  function fireWall(ctx, t, { baseY = H, level = 1, width = W, x0 = 0, count = 14, hMax = 900, seed = 1, palette } = {}) {
    if (level <= 0.001) return;
    const cols = palette || [C.orangeDeep, C.orange, C.gold, C.yellow];
    cols.forEach((col, layer) => {
      ctx.fillStyle = col;
      const k = 1 - layer * 0.2;
      for (let i = 0; i < count; i++) {
        const s = seed * 31 + i * 7 + layer * 3;
        const fx = x0 + ((i + 0.5 + (rnd(s) - 0.5) * 0.6) / count) * width;
        const flick = 0.72 + 0.28 * fbm(t * 3.1 + s * 1.7);
        const hh = hMax * level * k * flick * (0.55 + 0.45 * rnd(s, 2));
        const ww = (width / count) * (1.6 - layer * 0.25);
        const sway = (fbm(t * 2.2 + s) * 0.8 + (rnd(s, 5) - 0.5) * 0.6) * ww;
        tongue(ctx, fx, baseY + 40, ww, hh, sway, fbm(t * 1.7 + s * 3) * ww * 0.3);
      }
      ctx.fillRect(x0, baseY - 2, width, 60);
    });
  }

  // ---------- embers ----------
  // Stateless particles: each ember's position is computed from time alone.
  function embers(ctx, t, { x0 = 0, x1 = W, y0 = H + 40, rise = 1300, count = 70, rate = 1, life = 2.6, size = 7, seed = 3, alpha = 1, spread = 160 } = {}) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < count; i++) {
      const s = seed * 1000 + i;
      const period = life * (0.7 + rnd(s, 1) * 0.6);
      const phase = rnd(s, 2) * period;
      const tt = (t * rate + phase);
      const cycle = Math.floor(tt / period);
      const age = (tt % period) / period; // 0..1
      const ss = s + cycle * 0.77;
      const bx = lerp(x0, x1, rnd(ss, 3));
      const x = bx + Math.sin(age * 6 + rnd(ss, 4) * 9) * spread * 0.25 * age + fbm(tt * 0.8 + ss) * spread * 0.4;
      const y = y0 - rise * age * (0.6 + rnd(ss, 5) * 0.6);
      const a = Math.sin(age * Math.PI) * alpha * (0.5 + 0.5 * rnd(ss, 6));
      const r = size * (0.4 + rnd(ss, 7)) * (1 - age * 0.6);
      const flick = 0.6 + 0.4 * Math.sin(tt * 25 + ss);
      ctx.globalAlpha = clamp(a * flick);
      ctx.fillStyle = rnd(ss, 8) > 0.45 ? C.orangeHot : C.yellow;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.7, r * 1.5, Math.sin(tt + ss) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- backgrounds & texture ----------
  function radialGlow(ctx, x, y, r, color, alpha) {
    if (alpha <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  // Grill-grate stripes, the same motif as the logo's inner bars.
  function grillLines(ctx, t, { angle = -0.18, gap = 64, thick = 6, color = C.orange, alpha = 0.12, speed = 40 } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    const off = (t * speed) % gap;
    for (let y = -H; y < H; y += gap) {
      ctx.fillRect(-W * 1.2, y + off, W * 2.4, thick);
    }
    ctx.restore();
  }

  let grainTiles = null;
  function grain(ctx, frame, alpha = 0.07) {
    if (!grainTiles) {
      grainTiles = [];
      for (let k = 0; k < 6; k++) {
        const c = makeCanvas(256, 256), g = c.getContext("2d");
        const img = g.createImageData(256, 256);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.floor(hash(i * 0.37 + k * 999.1) * 255);
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        grainTiles.push(c);
      }
    }
    const tile = grainTiles[frame % grainTiles.length];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "overlay";
    const ox = -Math.floor(rnd(frame, 1) * 256), oy = -Math.floor(rnd(frame, 2) * 256);
    for (let y = oy; y < H; y += 256) for (let x = ox; x < W; x += 256) ctx.drawImage(tile, x, y);
    ctx.restore();
  }

  function vignette(ctx, strength = 0.65) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Bloom: blur a downscaled copy and screen it back on top.
  const bloomSmall = makeCanvas(W / 4, H / 4);
  const bloomBlur = makeCanvas(W / 4, H / 4);
  function bloom(ctx, src, amount = 0.55, radius = 10) {
    if (amount <= 0) return;
    const s = bloomSmall.getContext("2d");
    s.clearRect(0, 0, W / 4, H / 4);
    s.drawImage(src, 0, 0, W / 4, H / 4);
    const b = bloomBlur.getContext("2d");
    b.clearRect(0, 0, W / 4, H / 4);
    b.filter = `blur(${radius}px)`;
    b.drawImage(bloomSmall, 0, 0);
    b.filter = "none";
    ctx.save();
    ctx.globalAlpha = amount;
    ctx.globalCompositeOperation = "screen";
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bloomBlur, 0, 0, W, H);
    ctx.restore();
  }

  // Chromatic split for impact frames: offset copies in brand warm tones.
  function rgbSplit(ctx, src, px) {
    if (px < 0.5) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35;
    ctx.drawImage(src, -px, 0);
    ctx.drawImage(src, px, 0);
    ctx.restore();
  }

  // Sum of decaying impulses -> camera shake offset.
  function shake(t, hits, amp = 26) {
    let x = 0, y = 0, r = 0;
    for (const h of hits) {
      const dt = t - h.t;
      if (dt < 0 || dt > 0.6) continue;
      const k = Math.exp(-dt * 9) * (h.k || 1) * amp;
      x += Math.sin(dt * 71 + h.t * 13) * k;
      y += Math.cos(dt * 63 + h.t * 7) * k;
      r += Math.sin(dt * 41 + h.t) * k * 0.0009;
    }
    return { x, y, r };
  }

  // Hexagon badge outline (the logo's frame shape), flat-top elongated like the logo.
  function hexPath(ctx, cx, cy, w, h, r = 0.18) {
    const pts = [
      [cx - w / 2, cy - h * 0.18],
      [cx, cy - h / 2],
      [cx + w / 2, cy - h * 0.18],
      [cx + w / 2, cy + h * 0.18],
      [cx, cy + h / 2],
      [cx - w / 2, cy + h * 0.18],
    ];
    ctx.beginPath();
    const rr = Math.min(w, h) * r;
    for (let i = 0; i < 6; i++) {
      const p0 = pts[(i + 5) % 6], p1 = pts[i], p2 = pts[(i + 1) % 6];
      const a = [p1[0] + (p0[0] - p1[0]) * 0.001, p1[1] + (p0[1] - p1[1]) * 0.001];
      if (i === 0) ctx.moveTo(a[0], a[1]);
      ctx.arcTo(p1[0], p1[1], p2[0], p2[1], rr);
    }
    ctx.closePath();
  }

  window.HG = {
    W, H, C, FILL, E, clamp, lerp, prog, mix, spring, hash, rnd, noise, fbm,
    makeCanvas, withT, xform, font, brandText, measure, FONT_BRAND, FONT_COND, FONT_HEAVY,
    L, LOGO, GLYPH, LOGO_CX, LOGO_CY, center, fillLayer, layerAt, glyphRun,
    tongue, fireWall, embers, radialGlow, grillLines, grain, vignette, bloom, rgbSplit, shake, hexPath,
  };
})();
