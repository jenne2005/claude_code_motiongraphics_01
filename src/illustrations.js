// Flat, sticker-style food illustrations in the brand palette.
// Each draw fn renders around (0,0) at roughly 640x640, animated by local time r (seconds).
(function () {
  const { C, E, clamp, lerp, prog, spring, fbm, rnd, L, makeCanvas } = HG;
  const INK = 11; // keyline width

  function ink(ctx, w = INK) {
    ctx.lineWidth = w;
    ctx.strokeStyle = C.black;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  }
  function shape(ctx, fill, w = INK) {
    ctx.fillStyle = fill;
    ctx.fill();
    ink(ctx, w);
    ctx.stroke();
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
  // Pop-in scale: 0 -> 1 with springy overshoot.
  const pop = (r, t0, d = 0.55) => (r < t0 ? 0 : spring(prog(r, t0, d), 2.6, 5.5));

  // The logo flame as an emblem, centred at (x, y) with height h.
  function flameEmblem(ctx, x, y, h, body = C.orange, lick = C.yellow) {
    const b = L.flameBody.bbox;
    const s = h / (b[3] - b[1]);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.translate(-(b[0] + b[2]) / 2, -(b[1] + b[3]) / 2);
    ctx.fillStyle = body;
    ctx.fill(L.flameBody.path);
    ctx.fillStyle = lick;
    for (let i = 0; i < 4; i++) ctx.fill(L["flameLick" + i].path);
    ctx.restore();
  }

  // Grill marks: diagonal bars clipped to the current path.
  function grillMarks(ctx, x, y, w, h, color = C.orangeDeep, n = 4) {
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const px = x + ((i + 0.5) / n) * w;
      ctx.beginPath();
      ctx.moveTo(px - h * 0.35, y + h * 0.8);
      ctx.lineTo(px + h * 0.35, y + h * 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------- FRIES ----------------
  function fries(ctx, r) {
    const boxIn = pop(r, 0.0, 0.6);
    const n = 11;
    ctx.save();
    ctx.scale(boxIn, boxIn);
    // fries behind the carton front
    for (let i = 0; i < n; i++) {
      const k = pop(r, 0.18 + ((i * 7) % n) * 0.035, 0.5);
      const fx = lerp(-125, 125, i / (n - 1));
      const lean = (i - (n - 1) / 2) * 0.055 + Math.sin(r * 2 + i) * 0.01;
      const len = 250 + rnd(i, 4) * 70;
      const rise = lerp(220, 0, k);
      ctx.save();
      ctx.translate(fx, 40 + rise);
      ctx.rotate(lean);
      rrect(ctx, -19, -len, 38, len + 120, 8);
      shape(ctx, C.gold);
      ctx.fillStyle = C.yellow;
      ctx.fillRect(-11, -len + 14, 8, len - 30);
      ctx.restore();
    }
    // carton
    ctx.beginPath();
    ctx.moveTo(-190, -10);
    ctx.quadraticCurveTo(0, 40, 190, -10);
    ctx.lineTo(150, 300);
    ctx.lineTo(-150, 300);
    ctx.closePath();
    shape(ctx, C.orange);
    // carton stripes (logo grill bars)
    ctx.save();
    ctx.clip();
    ctx.fillStyle = C.orangeDeep;
    for (let y = 70; y < 300; y += 34) ctx.fillRect(-200, y, 400, 9);
    ctx.restore();
    // badge on carton
    ctx.beginPath();
    ctx.arc(0, 150, 86, 0, Math.PI * 2);
    shape(ctx, C.black, 8);
    ctx.beginPath();
    ctx.arc(0, 150, 72, 0, Math.PI * 2);
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 6;
    ctx.stroke();
    flameEmblem(ctx, 0, 140, 110 * clamp(pop(r, 0.45, 0.5)));
    ctx.restore();

    // falling salt sparkles
    for (let i = 0; i < 14; i++) {
      const per = 1.4, ph = (r * 0.9 + rnd(i, 1) * per) % per;
      if (r < 0.6) continue;
      ctx.globalAlpha = Math.sin((ph / per) * Math.PI) * 0.9;
      ctx.fillStyle = C.white;
      ctx.fillRect(-160 + rnd(i, 2) * 320, -380 + (ph / per) * 260, 6, 6);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- SHAWARMA ----------------
  function shawarma(ctx, r) {
    const k = pop(r, 0.0, 0.65);
    ctx.save();
    ctx.translate(0, lerp(500, 0, k));
    ctx.rotate(lerp(0.9, -0.32, k) + Math.sin(r * 1.6) * 0.02);

    // filling bursting out of the top (drawn first, behind the wrap edge)
    const chunks = [
      [-80, -250, C.orangeDeep], [-20, -285, C.orange], [55, -255, C.orangeDeep], [95, -215, C.orange],
      [-110, -205, C.orange], [10, -230, C.gold], [-50, -300, C.orangeHot], [70, -300, C.orange],
    ];
    chunks.forEach(([x, y, col], i) => {
      const s = pop(r, 0.35 + i * 0.05, 0.45);
      if (s <= 0) return;
      ctx.save();
      ctx.translate(x, y + 60 * (1 - s));
      ctx.rotate(rnd(i, 3) * 1.4 - 0.7);
      ctx.scale(s, s);
      rrect(ctx, -36, -26, 72, 52, 16);
      shape(ctx, col, 8);
      ctx.strokeStyle = C.black;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-18, -8); ctx.lineTo(10, 12);
      ctx.stroke();
      ctx.restore();
    });
    // onion rings
    [[-60, -230], [40, -275], [100, -250]].forEach(([x, y], i) => {
      const s = pop(r, 0.55 + i * 0.06, 0.4);
      if (s <= 0) return;
      ctx.beginPath();
      ctx.ellipse(x, y, 30 * s, 16 * s, 0.4, 0, Math.PI * 2);
      ctx.strokeStyle = C.black; ctx.lineWidth = 16; ctx.stroke();
      ctx.strokeStyle = C.white; ctx.lineWidth = 8; ctx.stroke();
    });

    // tortilla
    ctx.beginPath();
    ctx.moveTo(-150, -200);
    ctx.quadraticCurveTo(0, -150, 150, -200);
    ctx.lineTo(115, 300);
    ctx.quadraticCurveTo(0, 340, -115, 300);
    ctx.closePath();
    shape(ctx, "#FFE9B8");
    // toasted spots
    ctx.save();
    ctx.clip();
    ctx.fillStyle = C.gold;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.ellipse(-110 + rnd(i, 5) * 220, -150 + rnd(i, 6) * 200, 18, 10, rnd(i, 7) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // branded paper wrap (logo stripes)
    ctx.beginPath();
    ctx.moveTo(-138, 40);
    ctx.lineTo(138, 0);
    ctx.lineTo(115, 300);
    ctx.quadraticCurveTo(0, 340, -115, 300);
    ctx.closePath();
    shape(ctx, C.orange);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = C.white;
    for (let y = 50; y < 340; y += 30) {
      ctx.save();
      ctx.translate(0, y);
      ctx.rotate(-0.14);
      ctx.fillRect(-200, 0, 400, 7);
      ctx.restore();
    }
    ctx.restore();
    // emblem on wrap
    ctx.beginPath();
    ctx.arc(0, 175, 62, 0, Math.PI * 2);
    shape(ctx, C.black, 8);
    flameEmblem(ctx, 0, 168, 80);

    // sauce drizzle draws on
    const d = clamp(prog(r, 0.7, 0.6));
    if (d > 0) {
      ctx.beginPath();
      ctx.moveTo(-130, -170);
      for (let i = 1; i <= 24; i++) {
        const x = -130 + (i / 24) * 260;
        ctx.lineTo(x, -175 + Math.sin(i * 1.3) * 24 - i * 1.2);
      }
      ctx.setLineDash([900 * E.outCubic(d), 2000]);
      ctx.strokeStyle = C.black; ctx.lineWidth = 17; ctx.stroke();
      ctx.strokeStyle = C.yellow; ctx.lineWidth = 9; ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // ---------------- BURGER ----------------
  function burger(ctx, r) {
    // [drawFn, restY, height] bottom -> top
    const layers = [
      (c) => { // bottom bun
        rrect(c, -230, -20, 460, 95, [16, 16, 60, 60]);
        shape(c, C.gold);
        c.fillStyle = C.orangeHot; c.fillRect(-215, 50, 430, 10);
      },
      (c) => { // patty
        rrect(c, -245, -45, 490, 90, 45);
        shape(c, "#3A1F14");
        c.save(); rrect(c, -245, -45, 490, 90, 45); c.clip();
        c.strokeStyle = C.orange; c.lineWidth = 8;
        for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(-200 + i * 66, -30); c.lineTo(-170 + i * 66, 30); c.stroke(); }
        c.restore();
      },
      (c) => { // cheese with drips
        c.beginPath();
        c.moveTo(-250, -18);
        c.lineTo(250, -18);
        c.lineTo(250, 10);
        [[200, 60], [120, 18], [60, 75], [-20, 15], [-90, 55], [-170, 14], [-230, 45]].forEach(([x, y]) => {
          c.quadraticCurveTo(x + 28, y, x, y);
          c.quadraticCurveTo(x - 28, y, x - 34, 12);
        });
        c.lineTo(-250, 10);
        c.closePath();
        shape(c, C.yellow);
      },
      (c) => { // tomato
        rrect(c, -215, -22, 430, 44, 22);
        shape(c, C.orange);
        c.fillStyle = C.orangeHot; c.fillRect(-180, -10, 120, 8); c.fillRect(40, -10, 120, 8);
      },
      (c) => { // onion
        rrect(c, -225, -14, 450, 28, 14);
        shape(c, C.white, 9);
      },
      (c) => { // top bun
        c.beginPath();
        c.moveTo(-240, 40);
        c.bezierCurveTo(-240, -170, 240, -170, 240, 40);
        c.quadraticCurveTo(240, 58, 220, 58);
        c.lineTo(-220, 58);
        c.quadraticCurveTo(-240, 58, -240, 40);
        c.closePath();
        shape(c, C.gold);
        c.save(); c.clip();
        c.fillStyle = C.orangeHot;
        c.beginPath(); c.ellipse(80, 60, 260, 70, 0, 0, Math.PI * 2); c.fill();
        c.restore();
        c.beginPath();
        c.moveTo(-240, 40);
        c.bezierCurveTo(-240, -170, 240, -170, 240, 40);
        ink(c); c.stroke();
        // sesame
        c.fillStyle = C.white;
        [[-120, -40], [-50, -85], [30, -60], [110, -80], [150, -20], [-160, 0], [-10, -15], [70, 5]].forEach(([x, y], i) => {
          c.save(); c.translate(x, y); c.rotate(rnd(i, 9) * 2); c.beginPath(); c.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
          c.fill(); c.lineWidth = 4; c.stroke(); c.restore();
        });
      },
    ];
    const restY = [180, 105, 60, 30, 2, -78];
    layers.forEach((fn, i) => {
      const t0 = 0.08 + i * 0.1;
      if (r < t0) return;
      const p = prog(r, t0, 0.5);
      const fall = 1 - spring(p, 2.2, 6);
      const y = restY[i] - fall * 700;
      // squash on landing
      const land = clamp(prog(r, t0 + 0.12, 0.35));
      const sq = 1 + Math.sin(land * Math.PI) * 0.12 * (1 - land);
      ctx.save();
      ctx.translate(0, y + Math.sin(r * 2.2 + i * 0.4) * 3 * clamp(r - 1));
      ctx.scale(sq, 1 / sq);
      fn(ctx);
      ctx.restore();
    });
    // flag pick
    const fp = pop(r, 0.9, 0.5);
    if (fp > 0) {
      ctx.save();
      ctx.translate(40, -150);
      ctx.scale(fp, fp);
      ctx.strokeStyle = C.black; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, -170); ctx.stroke();
      ctx.strokeStyle = C.white; ctx.lineWidth = 6; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -170); ctx.lineTo(110, -140 + Math.sin(r * 5) * 6); ctx.lineTo(0, -105); ctx.closePath();
      shape(ctx, C.orange, 8);
      flameEmblem(ctx, 38, -140, 42, C.yellow, C.white);
      ctx.restore();
    }
  }

  // ---------------- SANDWICH ----------------
  function sandwichHalf(ctx) {
    // triangle toast seen from the front, cut edge at the bottom with layered filling
    ctx.beginPath();
    ctx.moveTo(-210, 120);
    ctx.lineTo(0, -230);
    ctx.lineTo(210, 120);
    ctx.closePath();
    shape(ctx, C.orangeDeep);
    ctx.beginPath();
    ctx.moveTo(-160, 98);
    ctx.lineTo(0, -170);
    ctx.lineTo(160, 98);
    ctx.closePath();
    ctx.fillStyle = C.gold;
    ctx.fill();
    grillMarks(ctx, -160, -170, 320, 268, C.orange, 5);
    // filling strip
    const f = [[C.white, 22], [C.yellow, 22], [C.orange, 26], [C.white, 16]];
    let y = 120;
    f.forEach(([col, h], i) => {
      rrect(ctx, -222 + i * 4, y, 444 - i * 8, h, h / 2);
      shape(ctx, col, 8);
      y += h - 4;
    });
    rrect(ctx, -212, y, 424, 46, 12);
    shape(ctx, C.orangeDeep);
    rrect(ctx, -196, y + 10, 392, 24, 8);
    ctx.fillStyle = C.gold; ctx.fill();
  }
  function sandwich(ctx, r) {
    const a = pop(r, 0.0, 0.6), b = pop(r, 0.22, 0.6);
    ctx.save();
    ctx.translate(lerp(-700, -95, a), 40);
    ctx.rotate(lerp(-1.2, -0.16, a));
    ctx.scale(0.86, 0.86);
    sandwichHalf(ctx);
    ctx.restore();
    ctx.save();
    ctx.translate(lerp(700, 120, b), 70 + Math.sin(r * 2) * 4);
    ctx.rotate(lerp(1.2, 0.12, b));
    ctx.scale(0.9, 0.9);
    sandwichHalf(ctx);
    ctx.restore();
    // toothpick
    const p = pop(r, 0.6, 0.45);
    if (p > 0) {
      ctx.save();
      ctx.translate(120, -120 - (1 - p) * 300);
      ctx.strokeStyle = C.black; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(0, 120); ctx.lineTo(0, -60); ctx.stroke();
      ctx.strokeStyle = C.white; ctx.lineWidth = 6; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -70, 22, 0, Math.PI * 2); shape(ctx, C.orange, 8);
      ctx.restore();
    }
  }

  // ---------------- KEBAB ----------------
  function skewer(ctx, r, t0, flip) {
    const k = pop(r, t0, 0.5);
    ctx.save();
    ctx.rotate(flip ? 0.42 : -0.42);
    ctx.translate(lerp(flip ? 700 : -700, 0, k), 0);
    // stick
    ctx.strokeStyle = C.black; ctx.lineWidth = 22; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-330, 0); ctx.lineTo(330, 0); ctx.stroke();
    ctx.strokeStyle = C.white; ctx.lineWidth = 10; ctx.stroke();
    ctx.beginPath(); ctx.arc(-320, 0, 20, 0, Math.PI * 2); shape(ctx, C.white, 8);
    const pieces = [C.orange, C.yellow, C.orangeDeep, C.white, C.orange, C.yellow, C.orangeDeep];
    pieces.forEach((col, i) => {
      const s = pop(r, t0 + 0.25 + i * 0.05, 0.4);
      if (s <= 0) return;
      const x = -230 + i * 76 + (1 - s) * 140;
      ctx.save();
      ctx.translate(x, Math.sin(i * 2.3) * 4);
      ctx.rotate(Math.sin(i * 1.7) * 0.2);
      ctx.scale(s, s);
      const big = col === C.orange || col === C.orangeDeep;
      rrect(ctx, -36, big ? -48 : -38, 72, big ? 96 : 76, big ? 20 : 14);
      shape(ctx, col, 9);
      if (big) {
        ctx.strokeStyle = "#2A120A"; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(-20, -24); ctx.lineTo(12, -6); ctx.moveTo(-14, 10); ctx.lineTo(18, 28); ctx.stroke();
      }
      ctx.restore();
    });
    ctx.restore();
  }
  function kebab(ctx, r, t) {
    // grill flames underneath
    ctx.save();
    ctx.translate(-330, 270);
    const lvl = clamp(prog(r, 0.0, 0.5));
    HG.fireWall(ctx, t, { baseY: 0, level: lvl, width: 660, count: 8, hMax: 230, seed: 9 });
    ctx.restore();
    // grate
    ctx.save();
    ctx.globalAlpha = clamp(prog(r, 0.05, 0.3));
    ctx.fillStyle = C.black;
    rrect(ctx, -320, 230, 640, 60, 12); ctx.fill();
    ctx.fillStyle = C.white;
    for (let i = 0; i < 9; i++) ctx.fillRect(-300 + i * 72, 240, 12, 40);
    ctx.fillRect(-310, 255, 620, 10);
    ctx.restore();
    skewer(ctx, r, 0.1, false);
    skewer(ctx, r, 0.3, true);
  }

  // ---------------- DRINK (for meal combos) ----------------
  function drink(ctx, r) {
    const k = pop(r, 0, 0.5);
    ctx.save();
    ctx.scale(k, k);
    ctx.strokeStyle = C.black; ctx.lineWidth = 16; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(20, -150); ctx.lineTo(60, -260); ctx.lineTo(110, -270); ctx.stroke();
    ctx.strokeStyle = C.yellow; ctx.lineWidth = 8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-110, -140); ctx.lineTo(110, -140); ctx.lineTo(85, 170); ctx.lineTo(-85, 170); ctx.closePath();
    shape(ctx, C.white);
    ctx.save(); ctx.clip();
    ctx.fillStyle = C.orange;
    for (let i = -4; i < 6; i++) { ctx.save(); ctx.translate(i * 50, 0); ctx.rotate(0.35); ctx.fillRect(-12, -260, 24, 520); ctx.restore(); }
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(-110, -140); ctx.lineTo(110, -140); ctx.lineTo(85, 170); ctx.lineTo(-85, 170); ctx.closePath();
    ink(ctx); ctx.stroke();
    rrect(ctx, -125, -170, 250, 40, 14); shape(ctx, C.black, 8);
    ctx.restore();
  }

  // ---------------- sticker renderer ----------------
  // Draws an illustration to an offscreen buffer, then composites it with a white sticker edge.
  const SZ = 1000;
  const buf = makeCanvas(SZ, SZ), sil = makeCanvas(SZ, SZ);
  function sticker(ctx, fn, x, y, scale, r, t, { edge = 10, edgeColor = C.white, shadow = true } = {}) {
    const b = buf.getContext("2d");
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, SZ, SZ);
    b.translate(SZ / 2, SZ / 2);
    fn(b, r, t);
    b.setTransform(1, 0, 0, 1, 0, 0);
    const s = sil.getContext("2d");
    s.globalCompositeOperation = "source-over";
    s.clearRect(0, 0, SZ, SZ);
    s.drawImage(buf, 0, 0);
    s.globalCompositeOperation = "source-in";
    s.fillStyle = edgeColor;
    s.fillRect(0, 0, SZ, SZ);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-SZ / 2, -SZ / 2);
    if (shadow) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.filter = "brightness(0) blur(18px)";
      ctx.drawImage(sil, 14, 40);
      ctx.restore();
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.drawImage(sil, Math.cos(a) * edge, Math.sin(a) * edge);
    }
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
  }

  window.FOOD = { fries, shawarma, burger, sandwich, kebab, drink, sticker, flameEmblem, rrect, shape, ink, pop };
})();
