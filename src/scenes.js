// Hungrillz brand film: timeline, scenes, sound cues and the master frame renderer.
// 1080x1920 vertical, cut to a 120 BPM grid (one beat = 0.5 s).
(function () {
  const {
    W, H, C, E, clamp, lerp, prog, spring, rnd, fbm, noise, L, LOGO, GLYPH, LOGO_CX, LOGO_CY,
    brandText, measure, font, FONT_BRAND, FONT_COND, FONT_HEAVY, layerAt, center, glyphRun,
    fireWall, embers, radialGlow, grillLines, grain, vignette, bloom, rgbSplit, shake, hexPath, makeCanvas, tongue,
  } = HG;
  const { sticker, flameEmblem, rrect, shape, pop } = FOOD;

  const FPS = 30;
  const DURATION = 44;

  // ---------------- menu data (from the printed Hungrillz menu) ----------------
  const MENU = [
    {
      key: "fries", title: "FRIES", from: 79, art: FOOD.fries, start: 12, end: 15,
      items: [["Classic", 79], ["Peri Peri", 89]],
      extra: { label: "SPECIAL MAYONNAISE", price: 25, prefix: "+" },
    },
    {
      key: "shawarma", title: "SHAWARMA", from: 129, art: FOOD.shawarma, start: 15, end: 19,
      items: [["Classic Paneer", 129, 1], ["Smoky Paneer", 139, 1], ["Original", 129], ["Peri Peri", 139],
        ["Tandoori", 139], ["Chilli Garlic", 139], ["Butter Chicken", 139]],
      extra: { label: "MEAL WITH FRIES & SOFT DRINK", price: 199 }, note: "EXTRA CHICKEN +₹10",
    },
    {
      key: "burgers", title: "BURGERS", from: 119, art: FOOD.burger, start: 19, end: 22.5,
      items: [["Classic Paneer", 119, 1], ["Smoky Paneer", 129, 1], ["Original", 119], ["Peri Peri", 129],
        ["Tandoori", 129], ["Chilli Garlic", 129], ["Butter Chicken", 129]],
      extra: { label: "MEAL WITH FRIES & SOFT DRINK", price: 189 },
    },
    {
      key: "sandwiches", title: "SANDWICHES", from: 109, art: FOOD.sandwich, start: 22.5, end: 26,
      items: [["Classic Paneer", 109, 1], ["Smoky Paneer", 119, 1], ["Original", 109], ["Peri Peri", 119],
        ["Tandoori", 119], ["Chilli Garlic", 119], ["Butter Chicken", 119]],
      extra: { label: "MEAL WITH FRIES & SOFT DRINK", price: 179 },
    },
    {
      key: "kebabs", title: "KEBABS", from: 110, art: FOOD.kebab, start: 26, end: 30.5,
      items: [["Hara Bara", 110, 1], ["Paneer Tikka", 120, 1], ["Hariyali Paneer", 130, 1], ["Tikka", 120],
        ["Reshmi", 120], ["Pahadi", 125], ["Hariyali", 130], ["Wings", 135], ["Garlic", 140],
        ["Tangdi (2 pcs)", 150], ["Tandoori Joint", 150], ["Alfaham Joint", 160]],
      extra: { label: "RUMALI ROTI", price: 15, prefix: "+" }, twoCol: true,
    },
  ];

  const T = {
    ignite: 0, logo: 4, hook: 9.5, menu: 12, meals: 30.5, cheat: 34.5, end: 37.5,
  };

  // ---------------- sound + impact cues (shared with the audio synth) ----------------
  const CUES = [];
  const cue = (t, type, extra = {}) => CUES.push({ t: +t.toFixed(3), type, ...extra });
  const HITS = []; // camera shake impulses
  const hit = (t, k = 1) => HITS.push({ t, k });
  const FLASHES = []; // {t, color, k}
  const flash = (t, color = C.white, k = 0.8, d = 0.22) => FLASHES.push({ t, color, k, d });

  // Intro
  cue(0.0, "fireBed", { dur: 4.2, gain: 0.5 });
  cue(0.15, "spark"); cue(0.45, "spark"); cue(0.7, "match");
  cue(0.85, "ignite");
  cue(1.0, "whoosh", { dur: 0.35 }); cue(1.5, "boom"); hit(1.5, 1.1);
  cue(2.25, "whoosh", { dur: 0.3 }); cue(2.75, "boom"); hit(2.75, 1.2);
  cue(2.9, "riser", { dur: 1.1 }); cue(3.45, "fireRoar", { dur: 0.6 });
  cue(4.0, "impact"); flash(4.0, C.yellow, 1, 0.35);
  // Logo build (local times offset by T.logo)
  const LG = T.logo;
  cue(LG + 0.1, "whoosh", { dur: 0.3 }); cue(LG + 0.42, "hit"); hit(LG + 0.42, 0.7);
  cue(LG + 0.55, "zip", { dur: 0.35 });
  for (let i = 0; i < 9; i++) cue(LG + 0.8 + i * 0.07 + 0.12, "tick", { pitch: i });
  cue(LG + 1.6, "boom"); cue(LG + 1.6, "fireRoar", { dur: 1.4 }); hit(LG + 1.6, 1.3); flash(LG + 1.6, C.orange, 0.45, 0.3);
  cue(LG + 2.3, "hit", { soft: 1 }); cue(LG + 2.75, "hit", { soft: 1 }); cue(LG + 3.2, "hit", { soft: 1 });
  cue(LG + 3.6, "chime");
  cue(LG + 4.6, "riser", { dur: 0.9 });
  cue(T.hook, "impact"); hit(T.hook, 1);
  // Music bed: drums start at the hook drop
  cue(T.hook, "beat", { until: T.end + 0.01 });
  // Hook words
  [9.6, 9.95, 10.35, 10.75, 11.1].forEach((t, i) => { cue(t, i === 4 ? "boom" : "hit"); hit(t, i === 4 ? 1 : 0.45); });
  // Menu scenes
  MENU.forEach((m, mi) => {
    cue(m.start - 0.25, "whoosh", { dur: 0.4 });
    cue(m.start + 0.1, "boom"); hit(m.start + 0.1, 0.9);
    cue(m.start + 0.6, "stamp");
    m.items.forEach((_, i) => cue(m.start + 0.75 + i * (m.twoCol ? 0.07 : 0.1), "tick", { pitch: i % 6 }));
    cue(m.start + 1.7, "pop");
    cue(m.start, "sizzle", { dur: m.end - m.start });
  });
  // Meals
  cue(T.meals - 0.25, "whoosh", { dur: 0.4 });
  cue(T.meals + 0.1, "boom"); hit(T.meals + 0.1, 0.9);
  [0.6, 1.1, 1.6].forEach((d) => { cue(T.meals + d, "hit"); hit(T.meals + d, 0.6); cue(T.meals + d - 0.15, "whoosh", { dur: 0.2 }); });
  cue(T.meals + 2.2, "stamp"); hit(T.meals + 2.2, 0.5);
  // Cheat meal
  cue(T.cheat - 0.25, "whoosh", { dur: 0.4 });
  [0.1, 0.5, 1.0, 1.5].forEach((d, i) => { cue(T.cheat + d, i === 3 ? "boom" : "hit"); hit(T.cheat + d, i === 3 ? 1.2 : 0.5); });
  cue(T.cheat + 2.0, "glitch");
  cue(T.cheat + 2.4, "riser", { dur: 0.6 });
  // End card
  cue(T.end, "impact"); flash(T.end, C.white, 0.9, 0.3); hit(T.end, 1);
  cue(T.end + 0.1, "fireBed", { dur: 6.4, gain: 0.7 });
  cue(T.end + 0.3, "whoosh", { dur: 0.3 });
  for (let i = 0; i < 9; i++) cue(T.end + 0.35 + i * 0.04 + 0.1, "tick", { pitch: i });
  cue(T.end + 0.9, "boom"); cue(T.end + 0.9, "fireRoar", { dur: 1.6 }); hit(T.end + 0.9, 1.3); flash(T.end + 0.9, C.orange, 0.4, 0.3);
  cue(T.end + 1.6, "hit", { soft: 1 }); cue(T.end + 1.85, "hit", { soft: 1 }); cue(T.end + 2.1, "hit", { soft: 1 });
  cue(T.end + 2.4, "chime");
  cue(T.end + 3.2, "boom", { tail: 1 });
  CUES.sort((a, b) => a.t - b.t);

  // ---------------- shared bits ----------------
  function fitPx(ctx, str, maxW, px, fam = FONT_BRAND, weight = "", tracking = 0) {
    const w = measure(ctx, str, px, fam, weight, tracking);
    return w > maxW ? (px * maxW) / w : px;
  }

  // Slam: scale down from big, extrusion slides out after landing.
  function slam(ctx, str, x, y, px, t, t0, opts = {}) {
    if (t < t0) return;
    const k = prog(t, t0, opts.dur || 0.2);
    const s = lerp(opts.from || 2.4, 1, E.outExpo(k));
    const alpha = clamp(k * 5) * (opts.alpha ?? 1);
    const sk = E.outBack(prog(t, t0 + 0.12, 0.28));
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.rotate(lerp(opts.rot || 0, 0, E.outCubic(k)) + (opts.wobble ? Math.sin(t * 3 + x) * 0.01 : 0));
    ctx.scale(s, s);
    brandText(ctx, str, 0, px * 0.36, px, { ...opts, shadowK: sk });
    ctx.restore();
  }

  function vegMark(ctx, x, y, s) {
    ctx.save();
    ctx.strokeStyle = C.veg;
    ctx.lineWidth = s * 0.12;
    ctx.strokeRect(x - s / 2, y - s / 2, s, s);
    ctx.fillStyle = C.veg;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function rupee(n) {
    return "₹" + n;
  }

  // God-ray wedges behind the logo.
  function rays(ctx, x, y, t, alpha, n = 16, len = 1500) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.12);
    const g = ctx.createRadialGradient(0, 0, 60, 0, 0, len);
    g.addColorStop(0, "rgba(241,90,41,0.9)");
    g.addColorStop(0.5, "rgba(241,90,41,0.25)");
    g.addColorStop(1, "rgba(241,90,41,0)");
    ctx.fillStyle = g;
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = 0.07 + 0.03 * Math.sin(i * 3.1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, len, a - w, a + w);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------- logo animation ----------------
  // a = seconds since the build started. speed compresses the build (end card uses a faster one).
  const FLAME_BASE = [145, 98];
  function drawLogo(ctx, t, a, { cx = W / 2, cy = 880, s = 5.4, speed = 1, alive = 1 } = {}) {
    const A = a * speed;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-LOGO_CX, -LOGO_CY);

    // frame pieces fly in
    const fb = spring(prog(A, 0.1, 0.55), 2.4, 5.5);
    const fl = spring(prog(A, 0.22, 0.55), 2.4, 5.5);
    const fr = spring(prog(A, 0.3, 0.55), 2.4, 5.5);
    layerAt(ctx, "frameBottom", { dy: (1 - fb) * 140, alpha: clamp(prog(A, 0.1, 0.1)), sx: lerp(0.6, 1, fb) });
    layerAt(ctx, "frameTopLeft", { dx: (1 - fl) * -120, dy: (1 - fl) * -90, rot: (1 - fl) * -0.8, alpha: clamp(prog(A, 0.22, 0.1)) });
    layerAt(ctx, "frameTopRight", { dx: (1 - fr) * 120, dy: (1 - fr) * -90, rot: (1 - fr) * 0.8, alpha: clamp(prog(A, 0.3, 0.1)) });

    // stripes reveal from the centre outwards (grill bars heating up)
    [["stripesBottom", 0.5], ["stripesTopLeft", 0.62], ["stripesTopRight", 0.62]].forEach(([n, t0]) => {
      const p = E.outCubic(prog(A, t0, 0.4));
      if (p <= 0) return;
      const b = L[n].bbox, [mx] = center(b);
      ctx.save();
      ctx.beginPath();
      const hw = ((b[2] - b[0]) / 2 + 2) * p;
      ctx.rect(mx - hw, b[1] - 2, hw * 2, b[3] - b[1] + 4);
      ctx.clip();
      const heat = 1 - clamp(prog(A, t0 + 0.2, 0.5));
      layerAt(ctx, n, { color: heat > 0.02 ? lerpColor(C.orange, C.yellow, heat) : undefined });
      ctx.restore();
    });

    // wordmark letters drop in (shadow -> outline -> face, as in the source art)
    const letterK = [];
    for (let i = 0; i < 9; i++) {
      const t0 = 0.8 + i * 0.07;
      const p = prog(A, t0, 0.6);
      letterK.push({
        on: A >= t0,
        y: (1 - spring(p, 2.3, 5.2)) * -70,
        rot: (1 - spring(p, 2.0, 5)) * (rnd(i, 4) - 0.5) * 1.2,
        sc: lerp(1.9, 1, E.outExpo(clamp(p * 1.6))),
        ext: E.outBack(prog(A, t0 + 0.18, 0.3)),
        alpha: clamp(p * 6),
        pivot: center(L["letterFace" + i].bbox),
        jit: alive * Math.sin(t * 2.4 + i * 0.7) * 0.25,
      });
    }
    ["letterShadow", "letterOutline", "letterFace"].forEach((kind) => {
      for (let i = 0; i < 9; i++) {
        const k = letterK[i];
        if (!k.on) continue;
        const off = kind === "letterShadow" ? 1.0 : kind === "letterOutline" ? 0.55 : 0;
        layerAt(ctx, kind + i, {
          pivot: k.pivot,
          dx: -(1 - k.ext) * off * 1.4,
          dy: k.y + k.jit - (1 - k.ext) * off * 1.0,
          rot: k.rot,
          sx: k.sc,
          alpha: k.alpha,
        });
      }
    });

    // flame erupts from behind the badge and keeps burning
    const fp = prog(A, 1.6, 0.7);
    if (fp > 0) {
      const g = spring(fp, 2.6, 4.6);
      const [bx, by] = FLAME_BASE;
      const flick = alive * fbm(t * 3.3) * 0.035;
      const sway = alive * fbm(t * 1.9 + 5) * 0.06;
      ctx.save();
      ctx.translate(bx, by);
      ctx.transform(1, 0, sway, 1, 0, 0);
      ctx.scale(lerp(0.4, 1, g), g * (1 + flick));
      ctx.translate(-bx, -by);
      ctx.fillStyle = C.orange;
      ctx.fill(L.flameBody.path);
      for (let i = 0; i < 4; i++) {
        const lp = spring(prog(A, 1.72 + i * 0.07, 0.45), 2.8, 5);
        if (lp <= 0) continue;
        const b = L["flameLick" + i].bbox;
        layerAt(ctx, "flameLick" + i, {
          pivot: [(b[0] + b[2]) / 2, b[3]],
          sx: lp,
          sy: lp * (1 + alive * fbm(t * 4.1 + i * 3) * 0.05),
        });
      }
      ctx.restore();
    }

    // ESTD / 2026
    const ep = E.outCubic(prog(A, 2.1, 0.45));
    if (ep > 0) {
      ctx.save();
      ctx.globalAlpha *= ep;
      ctx.translate(-(1 - ep) * 14, 0);
      glyphRun(ctx, LOGO.texts.estd, C.white);
      ctx.translate((1 - ep) * 28, 0);
      glyphRun(ctx, LOGO.texts.year, C.white);
      ctx.restore();
    }

    // tagline: CRAVE. / GRILL. / REPEAT on the beat
    const wordT = [2.3, 2.75, 3.2];
    const wordOf = (u) => (u.x < 134.6 ? 0 : u.x < 154 ? 1 : 2);
    glyphRun(ctx, LOGO.texts.tagline, C.white, (c, u, i) => {
      const w = wordOf(u);
      const p = prog(A, wordT[w] + (i % 7) * 0.018, 0.35);
      if (p <= 0) return false;
      const sc = spring(p, 2.5, 5);
      c.translate(1.6, -2.4);
      c.scale(sc, sc);
      c.translate(-1.6, 2.4);
    });
    // flash bar under the current tagline word
    wordT.forEach((wt, w) => {
      const p = prog(A, wt, 0.3);
      if (p <= 0 || p >= 1) return;
      const xs = LOGO.texts.tagline.filter((u) => wordOf(u) === w).map((u) => u.x);
      const x0 = Math.min(...xs), x1 = Math.max(...xs) + 3.5;
      ctx.fillStyle = C.yellow;
      ctx.globalAlpha = 1 - p;
      ctx.fillRect(x0, 144.6, (x1 - x0) * E.outCubic(p), 0.9);
      ctx.globalAlpha = 1;
    });

    // star
    const sp = prog(A, 3.6, 0.6);
    if (sp > 0) {
      const g = spring(sp, 2.6, 5);
      layerAt(ctx, "star", { sx: g, rot: (1 - g) * Math.PI * 1.5 });
      const [sx, sy] = center(L.star.bbox);
      const tw = Math.sin(clamp(sp * 1.4) * Math.PI);
      if (tw > 0.01) twinkle(ctx, sx, sy, 16 * tw, C.yellow);
    }
    // twinkle on the star every so often while the logo holds
    if (A > 4.4 && alive) {
      const ph = ((A - 4.4) % 1.6) / 1.6;
      const tw = Math.sin(clamp(ph * 3) * Math.PI);
      if (tw > 0.01) twinkle(ctx, ...center(L.star.bbox), 9 * tw, C.yellow);
    }
    ctx.restore();
  }

  function twinkle(ctx, x, y, r, color) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.12 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function lerpColor(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (p, s) => (p >> s) & 255;
    const m = (s) => Math.round(lerp(ch(pa, s), ch(pb, s), k));
    return `rgb(${m(16)},${m(8)},${m(0)})`;
  }

  // Find a point inside the orange flame body (not a yellow lick, not the gap): the zoom-through target.
  const ZOOM_PT = (() => {
    const c = makeCanvas(4, 4).getContext("2d");
    let best = [145, 70], bd = 1e9;
    for (let y = 40; y < 96; y += 1) for (let x = 115; x < 176; x += 1) {
      if (!c.isPointInPath(L.flameBody.path, x, y)) continue;
      let inLick = false;
      for (let i = 0; i < 4; i++) if (c.isPointInPath(L["flameLick" + i].path, x, y)) inLick = true;
      if (inLick) continue;
      // prefer points deep inside (all 8 neighbours at distance 4 also inside the body)
      let deep = true;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (!c.isPointInPath(L.flameBody.path, x + Math.cos(a) * 4, y + Math.sin(a) * 4)) deep = false;
      }
      if (!deep) continue;
      const d = (x - 145) ** 2 + (y - 72) ** 2;
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  })();

  // ---------------- SCENES ----------------
  function sceneIgnite(ctx, t) {
    ctx.fillStyle = C.black;
    ctx.fillRect(0, 0, W, H);
    // the spark
    const sparkP = clamp(prog(t, 0.1, 0.8));
    if (t < 1.1) {
      const flick = (Math.sin(t * 60) * 0.5 + 0.5) * 0.6 + 0.4;
      radialGlow(ctx, W / 2, 1480, 120 + 240 * sparkP, C.orange, 0.6 * flick * sparkP);
      for (let i = 0; i < 26; i++) {
        const st = [0.15, 0.45, 0.7][i % 3];
        const age = t - st;
        if (age < 0 || age > 0.45) continue;
        const a = rnd(i, 1) * Math.PI * 2, v = 300 + rnd(i, 2) * 500;
        const x = W / 2 + Math.cos(a) * v * age, y = 1480 + Math.sin(a) * v * age + 900 * age * age;
        ctx.fillStyle = rnd(i, 3) > 0.5 ? C.yellow : C.orangeHot;
        ctx.globalAlpha = 1 - age / 0.45;
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
      ctx.globalAlpha = 1;
    }
    // fire rises: small, surges on the hits, engulfs at the end
    let level = 0;
    level += E.outCubic(prog(t, 0.85, 0.5)) * 0.5;
    level += Math.exp(-Math.max(0, t - 1.5) * 4) * (t > 1.5 ? 0.18 : 0);
    level += Math.exp(-Math.max(0, t - 2.75) * 4) * (t > 2.75 ? 0.2 : 0);
    level += E.inCubic(prog(t, 3.3, 0.7)) * 2.4;
    radialGlow(ctx, W / 2, H, 1300, C.orange, 0.55 * clamp(level * 1.6));
    grillLines(ctx, t, { alpha: 0.06 * clamp(level * 2) });
    embers(ctx, t, { alpha: clamp(level * 2), count: 80, seed: 2 });

    // headline
    const sh = { face: C.white, shadow: C.orange };
    slam(ctx, "WHERE THERE'S", W / 2, 600, fitPx(ctx, "WHERE THERE'S", 900, 120), t, 1.0, { ...sh, rot: -0.08 });
    slam(ctx, "FIRE,", W / 2, 860, fitPx(ctx, "FIRE,", 900, 330), t, 1.5, { face: C.yellow, shadow: C.orange, rot: 0.1, from: 3.2 });
    slam(ctx, "THERE'S", W / 2, 1090, fitPx(ctx, "THERE'S", 900, 120), t, 2.25, { ...sh, rot: 0.08 });
    slam(ctx, "FLAVOUR", W / 2, 1330, fitPx(ctx, "FLAVOUR", 960, 300), t, 2.75, { face: C.orange, shadow: C.yellow, rot: -0.1, from: 3.2 });

    fireWall(ctx, t, { level, hMax: 1100, count: 9, seed: 4 });
    // foreground flames lick over the text when it engulfs
    if (t > 3.3) fireWall(ctx, t + 3, { level: E.inCubic(prog(t, 3.35, 0.65)) * 2.2, hMax: 1100, count: 7, seed: 8, palette: [C.orange, C.gold, C.yellow] });
  }

  function sceneLogo(ctx, t) {
    const a = t - T.logo;
    ctx.fillStyle = C.black;
    ctx.fillRect(0, 0, W, H);
    const glow = E.outCubic(prog(a, 0, 0.6));
    radialGlow(ctx, W / 2, 820, 1100, C.orangeDeep, 0.5 * glow);
    grillLines(ctx, t, { alpha: 0.07 * glow, speed: 30 });
    rays(ctx, W / 2, 560, t, 0.22 * E.outCubic(prog(a, 1.6, 1.2)));
    embers(ctx, t, { alpha: E.outCubic(prog(a, 1.6, 0.6)), count: 70, seed: 5, y0: 900, rise: 1000, x0: 240, x1: 840, life: 2 });
    // burst of sparks when the flame erupts
    if (a > 1.6 && a < 2.6) {
      for (let i = 0; i < 40; i++) {
        const age = a - 1.6 - rnd(i, 9) * 0.1;
        if (age < 0) continue;
        const ang = -Math.PI / 2 + (rnd(i, 1) - 0.5) * 2.4, v = 700 + rnd(i, 2) * 1300;
        const x = W / 2 + Math.cos(ang) * v * age, y = 640 + Math.sin(ang) * v * age + 1200 * age * age;
        ctx.globalAlpha = clamp(1 - age / 0.9);
        ctx.fillStyle = rnd(i, 3) > 0.5 ? C.yellow : C.orangeHot;
        ctx.fillRect(x - 4, y - 4, 8, 8);
      }
      ctx.globalAlpha = 1;
    }

    // slow push, then zoom through the flame into the next scene
    const push = 1 + 0.05 * E.inOutCubic(prog(a, 3.6, 1.4));
    const zp = E.inExpo(prog(a, 5.0, 0.5));
    const s = 5.4 * push * (1 + zp * 40);
    const [zx, zy] = ZOOM_PT;
    const cy = 900;
    // keep the zoom point fixed on screen while scaling
    const sx = W / 2 + (zx - LOGO_CX) * 5.4 * push, sy = cy + (zy - LOGO_CY) * 5.4 * push;
    const cx2 = sx - (zx - LOGO_CX) * s, cy2 = sy - (zy - LOGO_CY) * s;
    drawLogo(ctx, t, a, { cx: cx2, cy: cy2, s });
    if (zp > 0.6) {
      ctx.fillStyle = C.orange;
      ctx.globalAlpha = clamp((zp - 0.6) * 3);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  function sceneHook(ctx, t) {
    const a = t - T.hook;
    ctx.fillStyle = C.orange;
    ctx.fillRect(0, 0, W, H);
    grillLines(ctx, t, { color: C.black, alpha: 0.12, speed: 120, gap: 90, thick: 14 });
    const lift = E.inOutCubic(prog(a, 2.0, 0.5)) * -120;
    ctx.save();
    ctx.translate(0, lift);
    const black = { face: C.white, shadow: C.black, keyline: C.black };
    slam(ctx, "YES,", W / 2, 470, 210, t, 9.6, { face: C.yellow, shadow: C.black, rot: -0.12, from: 3 });
    slam(ctx, "IT TASTES", W / 2, 720, fitPx(ctx, "IT TASTES", 940, 170), t, 9.95, { ...black, rot: 0.06 });
    slam(ctx, "AS GOOD", W / 2, 940, fitPx(ctx, "AS GOOD", 940, 190), t, 10.35, { ...black, rot: -0.06 });
    slam(ctx, "AS IT", W / 2, 1150, 150, t, 10.75, { ...black, rot: 0.05 });
    slam(ctx, "SOUNDS", W / 2, 1400, fitPx(ctx, "SOUNDS", 980, 280), t, 11.1, { face: C.yellow, shadow: C.black, rot: -0.1, from: 3.4 });
    ctx.restore();
    // sound-wave squiggles flanking SOUNDS
    const wp = E.outCubic(prog(a, 1.7, 0.4));
    if (wp > 0) {
      ctx.save();
      ctx.translate(0, lift);
      ctx.strokeStyle = C.black;
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      for (let side = -1; side <= 1; side += 2)
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          const r0 = 80 + k * 46;
          ctx.globalAlpha = wp * (1 - k * 0.2);
          const pulse = Math.sin(t * 8 - k) * 6;
          ctx.arc(W / 2 + side * 400, 1420, r0 + pulse, side < 0 ? Math.PI * 0.8 : -Math.PI * 0.2, side < 0 ? Math.PI * 1.2 : Math.PI * 0.2);
          ctx.stroke();
        }
      ctx.restore();
    }
  }

  function sceneMenu(ctx, t, m, idx) {
    const r = t - m.start;
    ctx.fillStyle = C.black;
    ctx.fillRect(0, 0, W, H);
    radialGlow(ctx, W / 2, 760, 900, C.orangeDeep, 0.45);
    grillLines(ctx, t, { alpha: 0.06 });

    // giant outlined title scrolling behind everything
    ctx.save();
    ctx.font = font(560, FONT_BRAND);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = C.orange;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 4;
    const tw = ctx.measureText(m.title + "  ").width;
    const x0 = -((r * 260 + idx * 300) % tw);
    for (let x = x0; x < W; x += tw) ctx.strokeText(m.title + "  ", x, 760);
    ctx.restore();

    embers(ctx, t, { alpha: 0.7, count: 30, seed: 11 + idx, life: 3 });

    // counter tag
    const cp = E.outCubic(prog(r, 0.05, 0.4));
    ctx.save();
    ctx.globalAlpha = cp;
    ctx.translate(-(1 - cp) * 200, 0);
    ctx.font = font(34, FONT_COND, "700");
    ctx.letterSpacing = "8px";
    ctx.textAlign = "left";
    ctx.fillStyle = C.orange;
    ctx.fillText(`THE MENU`, 70, 150);
    ctx.fillStyle = C.white;
    ctx.fillText(`0${idx + 1} / 05`, 300, 150);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = C.orange;
    ctx.fillRect(70, 172, 120 * cp, 6);
    ctx.restore();

    // title
    const tp = fitPx(ctx, m.title, 920, m.twoCol ? 200 : 210);
    slam(ctx, m.title, W / 2, m.twoCol ? 310 : 330, tp, t, m.start + 0.1, { rot: -0.06, from: 2.8 });

    // illustration
    const artY = m.twoCol ? 650 : 720, artS = m.twoCol ? 0.72 : 0.85;
    const bob = Math.sin(t * 2) * 6;
    sticker(ctx, m.art, W / 2 - 40, artY + bob, artS, r - 0.15, t);

    // price badge (logo hexagon)
    const bp = r < 0.6 ? 0 : spring(prog(r, 0.6, 0.6), 2.4, 4.8);
    if (bp > 0) {
      ctx.save();
      ctx.translate(845, m.twoCol ? 520 : 560);
      ctx.rotate(lerp(-1.2, -0.12, bp) + Math.sin(t * 2.6) * 0.03);
      ctx.scale(bp, bp);
      hexPath(ctx, 0, 0, 250, 270, 0.12);
      ctx.fillStyle = C.white; ctx.fill();
      hexPath(ctx, 0, 0, 222, 242, 0.12);
      ctx.fillStyle = C.black; ctx.fill();
      hexPath(ctx, 0, 0, 200, 220, 0.12);
      ctx.fillStyle = C.orange; ctx.fill();
      ctx.save();
      hexPath(ctx, 0, 0, 200, 220, 0.12);
      ctx.clip();
      ctx.fillStyle = C.orangeDeep;
      for (let y = -110; y < 110; y += 22) ctx.fillRect(-120, y, 240, 6);
      ctx.restore();
      ctx.textAlign = "center";
      ctx.font = font(34, FONT_COND, "700");
      ctx.letterSpacing = "6px";
      ctx.fillStyle = C.black;
      ctx.fillText("FROM", 3, -36);
      ctx.letterSpacing = "0px";
      ctx.font = font(84, FONT_HEAVY);
      ctx.lineWidth = 10; ctx.strokeStyle = C.black; ctx.lineJoin = "round";
      ctx.strokeText(rupee(m.from), 0, 52);
      ctx.fillStyle = C.yellow;
      ctx.fillText(rupee(m.from), 0, 52);
      ctx.restore();
    }

    // menu list
    const short = m.items.length <= 3;
    const listY = m.twoCol ? 1010 : short ? 1230 : 1095;
    const rowH = m.twoCol ? 84 : short ? 110 : 72;
    const cols = m.twoCol ? 2 : 1;
    const perCol = Math.ceil(m.items.length / cols);
    m.items.forEach(([name, price, veg], i) => {
      const col = Math.floor(i / perCol), row = i % perCol;
      const t0 = 0.75 + i * (m.twoCol ? 0.07 : 0.1);
      const p = prog(r, t0, 0.45);
      if (p <= 0) return;
      const e = E.outExpo(p);
      const colW = cols === 2 ? 470 : 940;
      const x = 70 + col * 500;
      const y = listY + row * rowH;
      ctx.save();
      ctx.globalAlpha = clamp(p * 3);
      ctx.translate((1 - e) * 500, 0);
      // highlight sweep
      const hp = prog(r, t0 + 0.05, 0.35);
      if (hp > 0 && hp < 1) {
        ctx.fillStyle = C.orange;
        ctx.globalAlpha = 0.85 * (1 - hp);
        ctx.fillRect(x - 14 + colW * hp * 0.6, y - rowH * 0.5, colW * (1 - hp * 0.6) + 28, rowH - 10);
        ctx.globalAlpha = clamp(p * 3);
      }
      let nx = x;
      if (veg) {
        vegMark(ctx, x + 14, y - 12, 26);
        nx += 44;
      }
      const fs = cols === 2 ? 36 : short ? 64 : 44;
      ctx.font = font(fs, FONT_COND, "600");
      ctx.textAlign = "left";
      ctx.fillStyle = C.white;
      ctx.letterSpacing = "1px";
      const label = name.toUpperCase();
      ctx.fillText(label, nx, y);
      const nw = ctx.measureText(label).width;
      ctx.letterSpacing = "0px";
      ctx.font = font(cols === 2 ? 42 : short ? 72 : 50, FONT_HEAVY);
      ctx.textAlign = "right";
      ctx.fillStyle = C.yellow;
      const px = x + colW;
      const pr = rupee(price);
      ctx.fillText(pr, px, y + 2);
      const pw = ctx.measureText(pr).width;
      // dot leaders
      ctx.fillStyle = C.orange;
      for (let dx = nx + nw + 18; dx < px - pw - 16; dx += 16) ctx.fillRect(dx, y - 6, 5, 5);
      ctx.restore();
    });

    // meal / extra banner
    const bannerY = m.twoCol ? 1580 : 1640;
    const mp = r < 1.7 ? 0 : spring(prog(r, 1.7, 0.55), 2.4, 5);
    if (mp > 0 && m.extra) {
      ctx.save();
      ctx.translate(W / 2, bannerY);
      ctx.rotate(-0.03 + (1 - mp) * 0.3);
      ctx.scale(mp, mp);
      const bw = 900, bh = 120;
      rrect(ctx, -bw / 2 - 8, -bh / 2 - 8, bw + 16, bh + 16, 30);
      ctx.fillStyle = C.white; ctx.fill();
      rrect(ctx, -bw / 2, -bh / 2, bw, bh, 24);
      ctx.fillStyle = C.yellow; ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = C.black; ctx.stroke();
      // ticket notches
      ctx.fillStyle = C.black;
      ctx.beginPath(); ctx.arc(-bw / 2, 0, 20, 0, Math.PI * 2); ctx.arc(bw / 2, 0, 20, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = "left";
      ctx.font = font(fitPx(ctx, m.extra.label, 560, 40, FONT_COND, "700", 2), FONT_COND, "700");
      ctx.letterSpacing = "2px";
      ctx.fillStyle = C.black;
      ctx.fillText(m.extra.label, -bw / 2 + 50, 14);
      ctx.letterSpacing = "0px";
      ctx.textAlign = "right";
      ctx.font = font(76, FONT_HEAVY);
      const ptxt = (m.extra.prefix || "") + rupee(m.extra.price);
      ctx.lineWidth = 8;
      ctx.strokeText(ptxt, bw / 2 - 46, 28);
      ctx.fillStyle = C.orange;
      ctx.fillText(ptxt, bw / 2 - 46, 28);
      ctx.restore();
    }
    if (m.note) {
      const np = E.outCubic(prog(r, 2.0, 0.4));
      ctx.save();
      ctx.globalAlpha = np;
      ctx.font = font(34, FONT_COND, "700");
      ctx.letterSpacing = "6px";
      ctx.textAlign = "center";
      ctx.fillStyle = C.orange;
      ctx.fillText(m.note, W / 2, bannerY + 120 + (1 - np) * 30);
      ctx.restore();
    }
    if (m.key === "kebabs") {
      const np = E.outCubic(prog(r, 2.1, 0.4));
      ctx.save();
      ctx.globalAlpha = np;
      ctx.font = font(32, FONT_COND, "600");
      ctx.letterSpacing = "5px";
      ctx.textAlign = "center";
      ctx.fillStyle = C.white;
      ctx.fillText("FRESH OFF THE GRILL", W / 2, 1725 + (1 - np) * 30);
      ctx.restore();
    }
  }

  const MEALS = [
    { name: "SHAWARMA", price: 199, art: FOOD.shawarma },
    { name: "BURGER", price: 189, art: FOOD.burger },
    { name: "SANDWICH", price: 179, art: FOOD.sandwich },
  ];
  function sceneMeals(ctx, t) {
    const a = t - T.meals;
    ctx.fillStyle = C.black;
    ctx.fillRect(0, 0, W, H);
    radialGlow(ctx, W / 2, H, 1200, C.orange, 0.5);
    grillLines(ctx, t, { alpha: 0.06, angle: 0.18 });
    fireWall(ctx, t, { level: 0.22 + 0.04 * Math.sin(t * 3), hMax: 900, count: 8, seed: 21 });
    embers(ctx, t, { alpha: 0.8, count: 40, seed: 22 });

    slam(ctx, "MEAL DEALS", W / 2, 250, fitPx(ctx, "MEAL DEALS", 940, 190), t, T.meals + 0.1, { face: C.yellow, shadow: C.orange, rot: -0.07, from: 3 });
    const sp = E.outCubic(prog(a, 0.35, 0.4));
    ctx.save();
    ctx.globalAlpha = sp;
    ctx.font = font(40, FONT_COND, "700");
    ctx.letterSpacing = "9px";
    ctx.textAlign = "center";
    ctx.fillStyle = C.white;
    ctx.fillText("WITH FRIES & SOFT DRINK", W / 2, 400 + (1 - sp) * 20);
    ctx.restore();

    MEALS.forEach((ml, i) => {
      const t0 = 0.6 + i * 0.5;
      const p = prog(a, t0 - 0.15, 0.6);
      if (p <= 0) return;
      const e = spring(p, 2.2, 5.2);
      const dir = i % 2 ? 1 : -1;
      const y = 640 + i * 340;
      ctx.save();
      ctx.translate(W / 2 + (1 - e) * dir * 1200, y);
      ctx.rotate((1 - e) * dir * 0.4 + dir * 0.02);
      const cw = 940, ch = 280;
      rrect(ctx, -cw / 2 - 10, -ch / 2 - 10, cw + 20, ch + 20, 40);
      ctx.fillStyle = C.white; ctx.fill();
      rrect(ctx, -cw / 2, -ch / 2, cw, ch, 32);
      ctx.fillStyle = C.orange; ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = C.orangeDeep;
      for (let yy = -ch / 2; yy < ch / 2; yy += 30) ctx.fillRect(-cw / 2, yy, cw, 8);
      // price panel
      ctx.fillStyle = C.black;
      ctx.beginPath();
      ctx.moveTo(cw / 2 - 300, -ch / 2);
      ctx.lineTo(cw / 2, -ch / 2);
      ctx.lineTo(cw / 2, ch / 2);
      ctx.lineTo(cw / 2 - 360, ch / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      rrect(ctx, -cw / 2, -ch / 2, cw, ch, 32);
      ctx.lineWidth = 8; ctx.strokeStyle = C.black; ctx.stroke();
      sticker(ctx, ml.art, -cw / 2 + 140, 10, 0.32, a - t0 + 0.6, t, { edge: 8, shadow: false });
      // name
      ctx.textAlign = "left";
      brandText(ctx, ml.name, -cw / 2 + 300, -6, fitPx(ctx, ml.name, 300, 76), { face: C.white, shadow: C.black, depth: 6 });
      ctx.font = font(36, FONT_COND, "700");
      ctx.letterSpacing = "8px";
      ctx.fillStyle = C.black;
      ctx.fillText("MEAL", -cw / 2 + 304, 54);
      ctx.letterSpacing = "0px";
      // price with count-up
      const cnt = Math.round(lerp(ml.price - 60, ml.price, E.outCubic(prog(a, t0, 0.5))));
      ctx.textAlign = "center";
      ctx.font = font(124, FONT_HEAVY);
      ctx.fillStyle = C.yellow;
      ctx.fillText(rupee(cnt), cw / 2 - 160, 46);
      ctx.restore();
    });

    // "COMBO" stamp
    const st = prog(a, 2.2, 0.35);
    if (st > 0) {
      const s = lerp(2.6, 1, E.outExpo(st));
      ctx.save();
      ctx.translate(850, 470);
      ctx.rotate(0.22);
      ctx.scale(s, s);
      ctx.globalAlpha = clamp(st * 4);
      rrect(ctx, -150, -54, 300, 108, 18);
      ctx.fillStyle = C.yellow; ctx.fill();
      ctx.lineWidth = 8; ctx.strokeStyle = C.black; ctx.stroke();
      ctx.textAlign = "center";
      ctx.font = font(68, FONT_BRAND);
      ctx.fillStyle = C.black;
      ctx.fillText("COMBO", 0, 26);
      ctx.restore();
    }

    // fries + drink included strip
    const ip = prog(a, 2.6, 0.5);
    if (ip > 0) {
      sticker(ctx, FOOD.fries, 400, 1720, 0.22, a - 2.6, t, { edge: 7, shadow: false });
      sticker(ctx, FOOD.drink, 680, 1720, 0.25, a - 2.7, t, { edge: 7, shadow: false });
      ctx.save();
      ctx.globalAlpha = clamp(ip * 2);
      ctx.font = font(90, FONT_HEAVY);
      ctx.textAlign = "center";
      ctx.fillStyle = C.yellow;
      ctx.fillText("+", 540, 1752);
      ctx.restore();
    }
  }

  function sliced(ctx, str, x, y, px, t, amount, opts) {
    // "One Slice" glitch: cut the word into horizontal strips that slide apart.
    const strips = 7, top = y - px * 0.75, h = px * 1.1;
    for (let i = 0; i < strips; i++) {
      const off = amount * (rnd(i + Math.floor(t * 24), 3) - 0.5) * 46;
      ctx.save();
      ctx.beginPath();
      ctx.rect(-W * 2, top + (i / strips) * h, W * 4, h / strips + 1);
      ctx.clip();
      ctx.translate(off, 0);
      brandText(ctx, str, x, y, px, opts);
      ctx.restore();
    }
  }

  function sceneCheat(ctx, t) {
    const a = t - T.cheat;
    ctx.fillStyle = C.yellow;
    ctx.fillRect(0, 0, W, H);
    grillLines(ctx, t, { color: C.orange, alpha: 0.25, speed: 150, gap: 110, thick: 20, angle: 0.2 });
    const ink = { face: C.black, shadow: C.orange, keyline: C.black };
    slam(ctx, "FINALLY,", W / 2, 520, fitPx(ctx, "FINALLY,", 900, 190), t, T.cheat + 0.1, { ...ink, face: C.white, rot: -0.1 });
    slam(ctx, "A CHEAT MEAL", W / 2, 780, fitPx(ctx, "A CHEAT MEAL", 960, 150), t, T.cheat + 0.5, { ...ink, face: C.white, rot: 0.06 });
    slam(ctx, "THAT ISN'T", W / 2, 1000, fitPx(ctx, "THAT ISN'T", 900, 150), t, T.cheat + 1.0, { ...ink, face: C.white, rot: -0.05 });
    if (t >= T.cheat + 1.5) {
      const px = fitPx(ctx, "CHEATING", 990, 260);
      const g = Math.max(0, 1 - Math.abs(a - 2.05) * 5) + Math.max(0, 1 - Math.abs(a - 2.3) * 8) * 0.6;
      ctx.save();
      const k = prog(t, T.cheat + 1.5, 0.2);
      const s = lerp(3.4, 1, E.outExpo(k));
      ctx.translate(W / 2, 1300);
      ctx.rotate(lerp(-0.2, -0.04, E.outCubic(k)));
      ctx.scale(s, s);
      const opts = { face: C.orange, shadow: C.black, shadowK: E.outBack(prog(t, T.cheat + 1.62, 0.28)) };
      if (g > 0.02) sliced(ctx, "CHEATING", 0, px * 0.36, px, t, g, opts);
      else brandText(ctx, "CHEATING", 0, px * 0.36, px, opts);
      ctx.restore();
    }
    // strike underline under ISN'T
    const ul = E.outCubic(prog(a, 1.2, 0.3));
    if (ul > 0) {
      ctx.save();
      ctx.translate(W / 2 + 190, 1060);
      ctx.rotate(-0.05);
      ctx.fillStyle = C.orange;
      ctx.fillRect(-150, 0, 300 * ul, 16);
      ctx.restore();
    }
  }

  function sceneEnd(ctx, t) {
    const a = t - T.end;
    ctx.fillStyle = C.black;
    ctx.fillRect(0, 0, W, H);
    radialGlow(ctx, W / 2, 820, 1200, C.orangeDeep, 0.55);
    grillLines(ctx, t, { alpha: 0.06, speed: 20 });
    rays(ctx, W / 2, 560, t, 0.25 * E.outCubic(prog(a, 0.9, 1)));
    fireWall(ctx, t, { level: 0.16 + 0.03 * Math.sin(t * 2.5), hMax: 900, count: 8, seed: 31 });
    embers(ctx, t, { alpha: 1, count: 90, seed: 32, life: 3 });

    // top slogan
    const tp = E.outCubic(prog(a, 2.6, 0.5));
    ctx.save();
    ctx.globalAlpha = tp;
    ctx.textAlign = "center";
    ctx.font = font(44, FONT_COND, "700");
    ctx.letterSpacing = "10px";
    ctx.fillStyle = C.orange;
    ctx.fillText("WHERE THERE'S FIRE,", W / 2, 230 - (1 - tp) * 30);
    ctx.fillStyle = C.yellow;
    ctx.fillText("THERE'S FLAVOUR", W / 2, 296 - (1 - tp) * 30);
    ctx.restore();

    // logo: fast build (speed 1.6 => build compresses into ~2.3s)
    const push = 1 + 0.06 * E.inOutCubic(prog(a, 2.5, 4));
    drawLogo(ctx, t, a, { cx: W / 2, cy: 900, s: 5.4 * push, speed: 1.6 });

    // category strip
    const cats = ["FRIES", "SHAWARMA", "BURGERS", "SANDWICHES", "KEBABS"];
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = font(40, FONT_COND, "700");
    ctx.letterSpacing = "4px";
    const line1 = cats.slice(0, 3), line2 = cats.slice(3);
    [line1, line2].forEach((ln, li) => {
      const str = ln.join("  •  ");
      const p = E.outCubic(prog(a, 3.0 + li * 0.2, 0.5));
      ctx.globalAlpha = p;
      ctx.fillStyle = C.white;
      ctx.fillText(str, W / 2, 1440 + li * 64 + (1 - p) * 30);
    });
    ctx.restore();
    // veg note
    const vp = E.outCubic(prog(a, 3.4, 0.5));
    if (vp > 0) {
      ctx.save();
      ctx.globalAlpha = vp;
      ctx.font = font(32, FONT_COND, "600");
      ctx.letterSpacing = "5px";
      ctx.textAlign = "left";
      const label = "VEG & NON-VEG";
      const w = ctx.measureText(label).width + 50;
      vegMark(ctx, W / 2 - w / 2 + 12, 1617, 26);
      ctx.fillStyle = C.orange;
      ctx.fillText(label, W / 2 - w / 2 + 50, 1628);
      ctx.restore();
    }

    // burn-out to black
    const out = E.inCubic(prog(a, 5.9, 0.6));
    if (out > 0) {
      ctx.fillStyle = C.black;
      ctx.globalAlpha = out;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------- transitions ----------------
  // Grill-slash wipe: orange, yellow and black bands cover, swap the scene, then peel away.
  function stripeWipe(ctx, t, tc, dir = 1) {
    const d = t - tc;
    if (Math.abs(d) > 0.3) return;
    const D = 1300;
    const cols = [C.orange, C.yellow, C.black];
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.35 * dir);
    cols.forEach((col, i) => {
      let lead, trail;
      if (d < 0) {
        const p = E.outCubic(clamp((d + 0.3 - i * 0.05) / 0.22));
        lead = lerp(-D, D, p);
        trail = -D;
      } else {
        lead = D;
        const p = E.inCubic(clamp((d - (2 - i) * 0.05) / 0.2));
        trail = lerp(-D, D, p);
      }
      if (lead <= trail) return;
      ctx.fillStyle = col;
      ctx.fillRect(trail * dir, -D, (lead - trail) * dir, D * 2);
    });
    ctx.restore();
  }

  // ---------------- master ----------------
  const scenes = [
    { start: 0, end: T.logo, draw: sceneIgnite },
    { start: T.logo, end: T.hook, draw: sceneLogo },
    { start: T.hook, end: T.menu, draw: sceneHook, bloom: 0.12 },
    ...MENU.map((m, i) => ({ start: m.start, end: m.end, draw: (c, t) => sceneMenu(c, t, m, i) })),
    { start: T.meals, end: T.cheat, draw: sceneMeals },
    { start: T.cheat, end: T.end, draw: sceneCheat, bloom: 0.1 },
    { start: T.end, end: DURATION + 1, draw: sceneEnd },
  ];
  const WIPES = [T.menu, ...MENU.slice(1).map((m) => m.start), T.meals, T.cheat, T.end];

  const sceneCanvas = makeCanvas(W, H);
  const sctx = sceneCanvas.getContext("2d");

  function render(out, t) {
    const ctx = out.getContext("2d");
    const frame = Math.round(t * FPS);
    const sc = scenes.find((s) => t >= s.start && t < s.end) || scenes[scenes.length - 1];

    // camera: shake impulses + a breathing micro-zoom
    const sh = shake(t, HITS);
    const zoomPunch = HITS.reduce((z, h) => {
      const dt = t - h.t;
      return dt >= 0 && dt < 0.4 ? z + Math.exp(-dt * 12) * 0.035 * h.k : z;
    }, 0);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = "source-over";
    sctx.fillStyle = C.black;
    sctx.fillRect(0, 0, W, H);
    sctx.save();
    sctx.translate(W / 2 + sh.x, H / 2 + sh.y);
    sctx.rotate(sh.r);
    sctx.scale(1.02 + zoomPunch, 1.02 + zoomPunch);
    sctx.translate(-W / 2, -H / 2);
    sc.draw(sctx, t);
    sctx.restore();
    WIPES.forEach((tc, i) => stripeWipe(sctx, t, tc, i % 2 ? -1 : 1));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(sceneCanvas, 0, 0);
    bloom(ctx, sceneCanvas, sc.bloom ?? 0.4, 9);
    const split = HITS.reduce((s, h) => {
      const dt = t - h.t;
      return dt >= 0 && dt < 0.25 ? s + Math.exp(-dt * 18) * 14 * h.k : s;
    }, 0);
    rgbSplit(ctx, sceneCanvas, split);
    for (const f of FLASHES) {
      const dt = t - f.t;
      if (dt < 0 || dt > f.d) continue;
      ctx.globalAlpha = f.k * (1 - dt / f.d) ** 2;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
    vignette(ctx, 0.55);
    grain(ctx, frame, 0.08);
  }

  window.FILM = { render, DURATION, FPS, CUES, W, H, T, MENU };
})();
