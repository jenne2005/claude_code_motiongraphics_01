import React from "react";
import { AbsoluteFill, Img, interpolate, random, staticFile, useCurrentFrame } from "remotion";
import { COLORS, EASE, FONTS } from "../brand";
import { HEX_PATH, HEX_VERTICES, HEX_VIEWBOX } from "../hexagon-path";
import { FPS } from "../timeline";
import layout from "../food-layout.json";

// ---------------------------------------------------------------- helpers
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0 -> 1 over `dur` frames from `start`, with the brand easing. */
export const ease = (frame: number, start: number, dur: number) => EASE(clamp01((frame - start) / dur));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Hexagon geometry (logo units) -> centred, unit-height polygon for clip paths and rings.
const HX = HEX_VERTICES.map(([x]) => x);
const HY = HEX_VERTICES.map(([, y]) => y);
const HCX = (Math.min(...HX) + Math.max(...HX)) / 2;
const HCY = (Math.min(...HY) + Math.max(...HY)) / 2;
const HH = Math.max(...HY) - Math.min(...HY);
export const hexPolygon = (cx: number, cy: number, height: number) =>
  `polygon(${HEX_VERTICES.map(([x, y]) => `${cx + ((x - HCX) / HH) * height}px ${cy + ((y - HCY) / HH) * height}px`).join(", ")})`;

// ---------------------------------------------------------------- GrainOverlay
/** Animated monochrome film grain at ~5% strength. */
export const GrainOverlay: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "normal" }}>
      <svg width="100%" height="100%">
        <filter id={`grain${frame % 8}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 8} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain${frame % 8})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** Soft vignette. */
export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.6 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse 75% 62% at 50% 47%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

/** Warm orange rim-light glow pooled behind a subject. */
export const RimGlow: React.FC<{ x: number; y: number; w: number; h: number; opacity?: number }> = ({ x, y, w, h, opacity = 0.55 }) => (
  <div
    style={{
      position: "absolute",
      left: x - w / 2,
      top: y - h / 2,
      width: w,
      height: h,
      opacity,
      background: `radial-gradient(closest-side, rgba(241,90,41,0.75), rgba(241,90,41,0.18) 55%, rgba(241,90,41,0) 100%)`,
      mixBlendMode: "screen",
    }}
  />
);

// ---------------------------------------------------------------- EmberParticles
/** 40 slow-rising orange/yellow embers, fully deterministic. */
export const EmberParticles: React.FC<{ count?: number; opacity?: number; seed?: string; area?: [number, number, number, number] }> = ({
  count = 40,
  opacity = 1,
  seed = "embers",
  area = [0, 0, 1080, 1920],
}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const [ax, ay, aw, ah] = area;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k: number) => random(`${seed}-${i}-${k}`);
        const speed = 35 + r(1) * 70; // px/s: slow
        const life = ah / speed;
        const phase = r(2) * life;
        const age = ((t + phase) % life) / life; // 0..1
        const x = ax + r(3) * aw + Math.sin(t * (0.6 + r(4)) + r(5) * 6) * (14 + r(6) * 26);
        const y = ay + ah - age * ah;
        const size = 2 + r(7) * 3.5;
        const a = Math.sin(age * Math.PI) * (0.35 + 0.65 * r(8)) * (0.75 + 0.25 * Math.sin(t * 9 + i));
        const col = r(9) > 0.4 ? COLORS.flame : COLORS.yellow;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: col,
              opacity: a,
              boxShadow: `0 0 ${size * 3}px ${size}px ${col}66`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- LightSweep
/** A soft diagonal light band that passes once across its parent (parent must clip). */
export const LightSweep: React.FC<{ start: number; dur?: number; opacity?: number }> = ({ start, dur = 22, opacity = 0.55 }) => {
  const frame = useCurrentFrame();
  const p = clamp01((frame - start) / dur);
  if (p <= 0 || p >= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity,
        background: `linear-gradient(110deg, rgba(255,255,255,0) ${lerp(-40, 120, EASE(p)) - 18}%, rgba(255,236,200,0.9) ${lerp(-40, 120, EASE(p))}%, rgba(255,255,255,0) ${lerp(-40, 120, EASE(p)) + 18}%)`,
      }}
    />
  );
};

// ---------------------------------------------------------------- VegMark
export const VegMark: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <span
    style={{
      display: "inline-flex",
      width: size,
      height: size,
      border: `${Math.max(2, size * 0.11)}px solid ${COLORS.veg}`,
      borderRadius: size * 0.08,
      alignItems: "center",
      justifyContent: "center",
      flex: "none",
      background: "rgba(17,17,17,0.6)",
    }}
  >
    <span style={{ width: size * 0.42, height: size * 0.42, borderRadius: "50%", background: COLORS.veg }} />
  </span>
);

// ---------------------------------------------------------------- HexBadge
/** Price badge in the logo hexagon. Lands with the brand easing, then a light sweep passes. */
export const HexBadge: React.FC<{ x: number; y: number; size?: number; at: number; label: string; price: string }> = ({
  x,
  y,
  size = 290,
  at,
  label,
  price,
}) => {
  const frame = useCurrentFrame();
  const p = ease(frame, at, 16);
  if (frame < at) return null;
  const s = lerp(1.35, 1, p);
  const rot = lerp(-10, -4, p);
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        transform: `scale(${s}) rotate(${rot}deg)`,
        opacity: clamp01(p * 2.2),
        filter: `blur(${(1 - p) * 8}px) drop-shadow(0 0 ${28 * p}px rgba(241,90,41,0.55))`,
      }}
    >
      <svg viewBox={HEX_VIEWBOX} width={size} height={size} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={HEX_PATH} fill="rgba(13,13,13,0.92)" stroke={COLORS.flame} strokeWidth={2.6} strokeLinejoin="round" />
        <path d={HEX_PATH} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={0.6} transform={`translate(143.85 116.4) scale(0.9) translate(-143.85 -116.4)`} />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          clipPath: hexPolygon(size / 2, size / 2, size * 0.98),
          overflow: "hidden",
        }}
      >
        <div style={{ fontFamily: FONTS.price, fontWeight: 600, fontSize: size * 0.085, letterSpacing: size * 0.03, color: "rgba(255,255,255,0.78)" }}>
          {label}
        </div>
        <div style={{ fontFamily: FONTS.price, fontWeight: 800, fontSize: size * 0.2, color: COLORS.yellow, lineHeight: 1.05, letterSpacing: -1 }}>{price}</div>
        <LightSweep start={at + 12} dur={20} opacity={0.35} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- HexWipe
/** Reveals children through an expanding logo hexagon, with a glowing flame-orange edge ring. */
export const HexWipe: React.FC<{ progress: number; children: React.ReactNode; cx?: number; cy?: number }> = ({
  progress,
  children,
  cx = 540,
  cy = 960,
}) => {
  if (progress >= 1) return <>{children}</>;
  const p = EASE(clamp01(progress));
  const h = lerp(10, 2600, p);
  const ringH = h * 1.0;
  const ringAlpha = 1 - clamp01((p - 0.55) / 0.45);
  const s = ringH / HH;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: hexPolygon(cx, cy, h) }}>{children}</AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: ringAlpha }}>
        <g transform={`translate(${cx} ${cy}) scale(${s}) translate(${-HCX} ${-HCY})`}>
          <path d={HEX_PATH} fill="none" stroke={COLORS.flame} strokeWidth={6 / s} style={{ filter: "drop-shadow(0 0 12px rgba(241,90,41,0.9))" }} />
          <path d={HEX_PATH} fill="none" stroke="rgba(255,242,0,0.6)" strokeWidth={1.5 / s} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- KineticCaption
export type CaptionWord = { text: string; at: number; color?: string; glow?: boolean };
/** Word-by-word reveal, blur-to-sharp, each word lands on its own frame. */
export const KineticCaption: React.FC<{
  words: CaptionWord[];
  style?: React.CSSProperties;
  wordStyle?: React.CSSProperties;
  dur?: number;
  exitAt?: number;
}> = ({ words, style, wordStyle, dur = 9, exitAt }) => {
  const frame = useCurrentFrame();
  const out = exitAt === undefined ? 0 : ease(frame, exitAt, 8);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", opacity: 1 - out, ...style }}>
      {words.map((w, i) => {
        const p = ease(frame, w.at, dur);
        const space = { marginLeft: "0.13em", marginRight: "0.13em" };
        if (frame < w.at) return <span key={i} style={{ ...wordStyle, ...space, opacity: 0 }}>{w.text}</span>;
        return (
          <span
            key={i}
            style={{
              ...wordStyle,
              ...space,
              color: w.color ?? (wordStyle?.color as string) ?? COLORS.white,
              display: "inline-block",
              opacity: clamp01(p * 1.6),
              filter: `blur(${(1 - p) * 10}px)`,
              transform: `translateY(${(1 - p) * 22}px)`,
              textShadow: w.glow
                ? `0 0 28px rgba(255,242,0,0.55), 0 0 60px rgba(241,90,41,0.6)`
                : (wordStyle?.textShadow as string),
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

/** Burned-in VO caption in the bottom third (word-by-word from vo-timings). */
export const VoCaption: React.FC<{ words: { word: string; start: number }[]; voStart: number; until: number }> = ({ words, voStart, until }) => {
  const frame = useCurrentFrame();
  if (frame < voStart - 2 || frame > until) return null;
  return (
    <div style={{ position: "absolute", left: 150, right: 150, top: 1560, display: "flex", justifyContent: "center" }}>
      <KineticCaption
        dur={6}
        exitAt={until - 8}
        words={words.map((w) => ({ text: w.word.replace(/[.,]$/, ""), at: voStart + Math.round(w.start * FPS) }))}
        wordStyle={{
          fontFamily: FONTS.price,
          fontWeight: 600,
          fontSize: 46,
          color: COLORS.white,
          letterSpacing: 0.2,
          textShadow: "0 2px 10px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)",
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------- ParallaxHero
type FoodKey = keyof typeof layout;
/**
 * Treated food photo in 3 depth layers: the hero plate (background, rim light, shadow),
 * a middle layer passed as children (e.g. a giant outlined title), and the cutout on top.
 * Push-in 1.0 -> 1.08 over the scene; steam and smoke wisps drift in front.
 */
export const ParallaxHero: React.FC<{
  item: FoodKey;
  from: number;
  dur: number;
  offsetY?: number;
  children?: React.ReactNode;
  smoke?: boolean;
  fadeEdges?: "bottom" | "both";
  pushTo?: number;
}> = ({ item, from, dur, offsetY = 0, children, smoke = true, fadeEdges = "bottom", pushTo = 1.08 }) => {
  const frame = useCurrentFrame();
  const L = layout[item];
  const p = clamp01((frame - from) / dur);
  const k = EASE(p) * 0.35 + p * 0.65; // confident: mostly linear, gently eased
  const ox = L.x + L.w / 2;
  const oy = L.y + L.h / 2;
  const sBack = lerp(1, 1 + (pushTo - 1) * 0.5, k);
  const sMid = lerp(1, 1 + (pushTo - 1) * 0.75, k);
  const sFront = lerp(1, pushTo, k);
  const origin = `${ox}px ${oy}px`;
  const mask =
    fadeEdges === "both"
      ? "linear-gradient(to bottom, transparent 0px, black 260px, black 1560px, transparent 1880px)"
      : "linear-gradient(to bottom, black 0px, black 1500px, transparent 1880px)";
  return (
    <AbsoluteFill style={{ transform: `translateY(${offsetY}px)` }}>
      <AbsoluteFill style={{ transform: `scale(${sBack})`, transformOrigin: origin, WebkitMaskImage: mask, maskImage: mask }}>
        <Img src={staticFile(`food/${item}-hero.png`)} style={{ width: 1080, height: 1920 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${sMid})`, transformOrigin: origin }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${sFront})`, transformOrigin: origin, WebkitMaskImage: mask, maskImage: mask }}>
        <Img src={staticFile(`food/${item}-cutout.png`)} style={{ position: "absolute", left: L.x, top: L.y, width: L.w, height: L.h }} />
      </AbsoluteFill>
      {smoke && <Smoke x={ox} y={L.y + L.h * 0.25} w={L.w * 0.7} />}
    </AbsoluteFill>
  );
};

/** Soft steam/smoke wisps rising from a point. */
export const Smoke: React.FC<{ x: number; y: number; w: number; count?: number; opacity?: number }> = ({ x, y, w, count = 7, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "screen" }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k: number) => random(`smoke-${i}-${k}`);
        const life = 3.2 + r(1) * 2;
        const age = ((t + r(2) * life) % life) / life;
        const px = x + (r(3) - 0.5) * w + Math.sin(t * 0.9 + i * 2) * 40 * age;
        const py = y - age * 520;
        const size = 160 + age * 320;
        const a = Math.sin(age * Math.PI) * (0.07 + r(4) * 0.06);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px - size / 2,
              top: py - size / 2,
              width: size,
              height: size * 1.25,
              borderRadius: "50%",
              opacity: a,
              transform: `rotate(${r(5) * 60 - 30 + age * 40}deg)`,
              background: "radial-gradient(closest-side, rgba(255,240,225,0.9), rgba(255,240,225,0.35) 45%, rgba(255,240,225,0) 100%)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- PriceRow
export const PriceRow: React.FC<{
  name: string;
  price: string;
  veg?: boolean;
  at: number;
  size?: number;
  width: number;
  priceColor?: string;
}> = ({ name, price, veg, at, size = 30, width, priceColor = COLORS.white }) => {
  const frame = useCurrentFrame();
  const p = ease(frame, at, 10);
  if (frame < at) return <div style={{ height: size * 1.5 }} />;
  return (
    <div
      style={{
        width,
        height: size * 1.5,
        display: "flex",
        alignItems: "center",
        gap: size * 0.4,
        opacity: clamp01(p * 1.5),
        filter: `blur(${(1 - p) * 8}px)`,
        transform: `translateY(${(1 - p) * 26}px)`,
      }}
    >
      {veg && <VegMark size={size * 0.82} />}
      <span style={{ fontFamily: FONTS.price, fontWeight: 600, fontSize: size, color: COLORS.white, letterSpacing: size * 0.02, whiteSpace: "nowrap", textTransform: "uppercase" }}>
        {name}
      </span>
      <span style={{ flex: 1, height: 2, marginTop: size * 0.3, backgroundImage: `radial-gradient(circle, rgba(241,90,41,0.8) 1.2px, transparent 1.6px)`, backgroundSize: "10px 4px", backgroundRepeat: "repeat-x", opacity: interpolate(p, [0.4, 1], [0, 1], { extrapolateLeft: "clamp" }) }} />
      <span style={{ fontFamily: FONTS.price, fontWeight: 800, fontSize: size * 1.05, color: priceColor, whiteSpace: "nowrap" }}>{price}</span>
    </div>
  );
};
