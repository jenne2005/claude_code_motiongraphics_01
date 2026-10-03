import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "../brand";
import { Category } from "../data";
import { EmberParticles, RimGlow, Smoke, VoCaption, clamp01, ease, lerp } from "../components";
import { Scene, WIPE, f } from "../timeline";
import { rs } from "./FoodScene";
import layout from "../food-layout.json";

/** Three quick cuts; each cut lands one price. */
export const friesCuts = (s: Scene) => {
  const n = 3;
  const len = Math.floor(s.length / n);
  return Array.from({ length: n }, (_, i) => i * len);
};

// framing for each cut: scale + focus point on the hero frame
const SHOTS = [
  { scale: 1.0, to: 1.05, fx: 540, fy: 930, rot: 0 },
  { scale: 1.55, to: 1.65, fx: 560, fy: 700, rot: -3 },
  { scale: 1.3, to: 1.38, fx: 520, fy: 1060, rot: 2 },
];

export const Fries: React.FC<{ s: Scene; cat: Category }> = ({ s, cat }) => {
  const frame = useCurrentFrame() - WIPE;
  const cuts = friesCuts(s);
  const ci = Math.max(0, cuts.filter((c) => frame >= c).length - 1);
  const shot = SHOTS[ci];
  const cutStart = cuts[ci];
  const cutLen = (cuts[ci + 1] ?? s.length) - cutStart;
  const p = clamp01((frame - (ci === 0 ? -WIPE : cutStart)) / (cutLen + (ci === 0 ? WIPE : 0)));
  const sc = lerp(shot.scale, shot.to, p);
  const L = layout.fries;
  const lines = [
    { name: cat.items[0].name, price: rs(cat.items[0].price), yellow: true },
    { name: cat.items[1].name, price: rs(cat.items[1].price) },
    { name: cat.addOns[0].name, price: `+${rs(cat.addOns[0].price)}` },
  ];
  const ln = lines[ci];
  const lp = ease(frame, cutStart + (ci === 0 ? f(0.2) : 3), 9);
  const flash = ci > 0 ? 1 - clamp01((frame - cutStart) / 4) : 0;
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${540 - shot.fx}px, ${960 - shot.fy}px) scale(${sc}) rotate(${shot.rot}deg)`,
          transformOrigin: `${shot.fx}px ${shot.fy}px`,
        }}
      >
        <Img src={staticFile("food/fries-hero.png")} style={{ width: 1080, height: 1920 }} />
        <Img src={staticFile("food/fries-cutout.png")} style={{ position: "absolute", left: L.x, top: L.y, width: L.w, height: L.h }} />
      </AbsoluteFill>
      <Smoke x={540} y={560} w={600} count={6} />
      <RimGlow x={540} y={760} w={1100} h={900} opacity={0.18} />
      <EmberParticles count={40} opacity={0.7} seed="fries" area={[120, 300, 840, 1100]} />
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(17,17,17,0.85) 0px, rgba(17,17,17,0) 420px, rgba(17,17,17,0) 1150px, rgba(17,17,17,0.9) 1450px)" }} />

      <div style={{ position: "absolute", left: 150, right: 150, top: 190, textAlign: "center", fontFamily: FONTS.brand, fontSize: 124, lineHeight: 1, color: COLORS.white, letterSpacing: 3 }}>
        <span style={{ display: "inline-block", opacity: ease(frame, -WIPE + 4, 14), filter: `blur(${(1 - ease(frame, -WIPE + 4, 14)) * 10}px)` }}>FRIES</span>
      </div>

      {/* price line for this cut */}
      <div
        style={{
          position: "absolute",
          left: 150,
          right: 150,
          top: 1290,
          display: "flex",
          justifyContent: "center",
          alignItems: "baseline",
          gap: 22,
          opacity: clamp01(lp * 1.5),
          filter: `blur(${(1 - lp) * 10}px)`,
          transform: `translateY(${(1 - lp) * 24}px)`,
          whiteSpace: "nowrap",
          textShadow: "0 2px 14px rgba(0,0,0,0.8)",
        }}
      >
        <span style={{ fontFamily: FONTS.price, fontWeight: 700, fontSize: ln.name.length > 12 ? 40 : 54, color: COLORS.white, letterSpacing: 3, textTransform: "uppercase" }}>{ln.name}</span>
        <span style={{ fontFamily: FONTS.price, fontWeight: 800, fontSize: 64, color: ln.yellow ? COLORS.yellow : COLORS.white }}>{ln.price}</span>
      </div>
      {flash > 0 && <AbsoluteFill style={{ background: "rgba(255,190,140,1)", opacity: flash * 0.35, mixBlendMode: "screen" }} />}
      <VoCaption words={s.vo.words} voStart={WIPE + s.voAt} until={WIPE + s.voAt + f(s.vo.duration) + f(0.4)} />
    </AbsoluteFill>
  );
};
