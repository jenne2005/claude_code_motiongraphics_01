import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { ASSETS, COLORS, EASE, FONTS } from "../brand";
import { HEX_PATH, HEX_VIEWBOX } from "../hexagon-path";
import { clamp01, ease, lerp } from "../components";
import { FLAME } from "../logo-flame";
import plan from "./plan.json";

export const FPS = plan.fps;
export const F = (sec: number) => Math.round(sec * FPS);
export const CUT = Object.fromEntries(Object.entries(plan.cuts).map(([k, v]) => [k, F(v)])) as Record<keyof typeof plan.cuts, number>;
export const TOTAL = F(plan.duration);

// Instagram-safe layout (px): 150 top, 340 bottom, 90 sides.
export const SAFE = { top: 150, bottom: 1920 - 340, left: 90, right: 1080 - 90 };
export const CAPTION_Y = 1368;

/** Crisp outlined/filled display text in the brand face with the 6px dark stroke used by captions. */
export const strokeText = (px: number, color: string = COLORS.white): React.CSSProperties => ({
  fontFamily: FONTS.brand,
  fontSize: px,
  lineHeight: 1,
  color,
  textTransform: "uppercase",
  WebkitTextStroke: `${Math.max(4, px * 0.075)}px rgba(8,8,8,0.92)`,
  paintOrder: "stroke fill",
  textShadow: "0 6px 26px rgba(0,0,0,0.55)",
  letterSpacing: px * 0.02,
});

/**
 * PRICE SYSTEM: small-caps label, "Rs." superscript, Inter Black numeral that rolls up like a slot
 * counter for 8 frames, then locks with a 3% punch; a yellow underline sweeps in; a thin hexagon
 * outline frames it. `at` = lock frame (relative to the parent sequence).
 */
export const Price: React.FC<{ value: number; label: string; at: number; y: number; px?: number; until?: number; hexFrame?: boolean }> = ({
  value,
  label,
  at,
  y,
  px = 240,
  until,
  hexFrame = true,
}) => {
  const frame = useCurrentFrame();
  const rollStart = at - 8;
  if (frame < rollStart - 3) return null;
  const inP = ease(frame, rollStart - 3, 6);
  const roll = 1 - clamp01((frame - rollStart) / 8); // 1 -> 0 over 8 frames
  const punch = frame >= at ? 1 + 0.03 * Math.exp(-(frame - at) / 2.2) * Math.cos((frame - at) * 0.9) : 1;
  const sweep = ease(frame, at, 9);
  const out = until !== undefined ? ease(frame, until - 5, 5) : 0;
  const digits = String(value).split("");
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: y - px * 0.85, height: px * 1.7, opacity: inP * (1 - out) }}>
      {hexFrame && (
        <svg viewBox={HEX_VIEWBOX} style={{ position: "absolute", left: "50%", top: "50%", width: px * 2.3, height: px * 2.3, transform: `translate(-50%, -50%) scale(${lerp(0.9, 1, inP)})`, overflow: "visible", opacity: 0.55 }}>
          <path d={HEX_PATH} fill="rgba(10,10,10,0.35)" stroke={COLORS.flame} strokeWidth={0.7} />
        </svg>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, top: -px * 0.05, textAlign: "center", fontFamily: FONTS.price, fontWeight: 700, fontSize: 56, letterSpacing: 12, color: "rgba(255,255,255,0.86)", fontVariantCaps: "all-small-caps", textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
        {label}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: px * 0.36, display: "flex", justifyContent: "center", alignItems: "flex-start", transform: `scale(${punch})` }}>
        <span style={{ fontFamily: FONTS.price, fontWeight: 900, fontSize: px * 0.34, color: COLORS.white, marginTop: px * 0.08, marginRight: px * 0.04, textShadow: "0 0 30px rgba(241,90,41,0.55)" }}>Rs.</span>
        <span style={{ fontFamily: FONTS.price, fontWeight: 900, fontSize: px, lineHeight: 1, color: COLORS.white, letterSpacing: -px * 0.03, textShadow: "0 0 40px rgba(241,90,41,0.65), 0 0 90px rgba(241,90,41,0.35)", display: "inline-flex" }}>
          {digits.map((d, i) => (
            <SlotDigit key={i} d={+d} roll={clamp01(roll * (1 + i * 0.25))} px={px} />
          ))}
        </span>
      </div>
      <div style={{ position: "absolute", left: "50%", top: px * 1.42, height: 8, width: 420 * sweep, transform: "translateX(-50%)", background: COLORS.yellow, borderRadius: 4, boxShadow: "0 0 18px rgba(255,242,0,0.6)" }} />
    </div>
  );
};

/** One slot-machine digit: a vertical strip rolling upward that settles on the target. */
const SlotDigit: React.FC<{ d: number; roll: number; px: number }> = ({ d, roll, px }) => {
  const travel = 14; // digits scrolled during the roll
  const pos = travel * EASE(roll); // remaining distance, in cells
  const h = px;
  const first = Math.max(0, Math.floor(pos) - 1);
  const cells = [];
  for (let i = first; i <= Math.min(travel, Math.ceil(pos) + 1); i++) cells.push(i);
  return (
    <span style={{ position: "relative", display: "inline-block", height: h, overflow: "hidden", width: px * 0.6 }}>
      {cells.map((i) => (
        <span key={i} style={{ position: "absolute", left: 0, right: 0, top: (pos - i) * h, height: h, lineHeight: `${h}px`, textAlign: "center", filter: roll > 0.02 ? `blur(${Math.min(5, roll * 7)}px)` : undefined }}>
          {(d - i + 100) % 10}
        </span>
      ))}
    </span>
  );
};

// ---------------------------------------------------------------- captions
type Chunk = { text: string; key: string | null; start: number; end: number; line: string };
/** Big kinetic captions: One Slice, 2-4 words, keyword in yellow, popping in on each chunk. */
export const Captions: React.FC<{ chunks: Chunk[]; hide?: (c: Chunk) => boolean }> = ({ chunks, hide }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const active = [...chunks].filter((c) => c.start <= t && t < c.end).pop();
  if (!active || hide?.(active)) return null;
  const a = F(active.start);
  const p = ease(frame, a, 6);
  const out = ease(frame, F(active.end) - 3, 3);
  const words = active.text.split(" ");
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: CAPTION_Y, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 22px", opacity: clamp01(p * 1.8) * (1 - out), transform: `scale(${lerp(1.12, 1, p)})`, filter: `blur(${(1 - p) * 6}px)` }}>
      {words.map((w, i) => (
        <span key={i} style={strokeText(78, active.key && w === active.key ? COLORS.yellow : COLORS.white)}>
          {w}
        </span>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- location
export const Pin: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 40 52" style={{ overflow: "visible", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))" }}>
    <path d="M20 51 C20 51 3 31 3 19 A17 17 0 0 1 37 19 C37 31 20 51 20 51 Z" fill={COLORS.flame} stroke="#fff" strokeWidth={2.4} />
    <circle cx={20} cy={19} r={6.5} fill="#fff" />
  </svg>
);

/** Small persistent location tag, bottom-left safe area. */
export const LocationTag: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame > to) return null;
  const p = ease(frame, from, 10) * (1 - ease(frame, to - 6, 6));
  return (
    <div style={{ position: "absolute", left: SAFE.left, top: SAFE.bottom - 66, display: "flex", alignItems: "center", gap: 14, opacity: p, transform: `translateX(${(1 - p) * -30}px)`, padding: "6px 18px 6px 10px", borderRadius: 40, background: "rgba(10,10,10,0.55)" }}>
      <Pin size={34} />
      <span style={{ ...strokeText(56), WebkitTextStroke: "0px", textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
        NEAR TCS, <span style={{ color: COLORS.yellow }}>ADIBATLA</span>
      </span>
    </div>
  );
};

// ---------------------------------------------------------------- logo
// Logo PNG: rendered at 10 px per logo unit, cropped with its origin at (508, 189).
const PNG_W = 1868;
const PNG_H = 1625;
export const LogoMark: React.FC<{ cx: number; cy: number; width: number; p: number; flame?: number; glow?: number }> = ({ cx, cy, width, p, flame = 0, glow = 0 }) => {
  const k = width / PNG_W;
  const left = cx - width / 2;
  const top = cy - (PNG_H * k) / 2;
  // flame position inside the logo, so the ignition hands off exactly onto the logo's own flame
  const b = FLAME.body.bbox;
  const fx = left + (((b[0] + b[2]) / 2) * 10 - 508) * k;
  const fBase = top + (b[3] * 10 - 189) * k;
  const fH = (b[3] - b[1]) * 10 * k;
  const s = fH / (b[3] - b[1]);
  const bx = (b[0] + b[2]) / 2;
  const frame = useCurrentFrame();
  const flick = Math.sin(frame * 0.35) * 0.02 + Math.sin(frame * 0.81) * 0.012;
  return (
    <>
      {flame > 0 && p < 1 && (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: 1 - p, filter: `drop-shadow(0 0 ${40 * flame}px rgba(241,90,41,0.7))` }}>
          <g transform={`translate(${fx} ${fBase}) scale(${s * lerp(0.6, 1, flame)} ${s * flame * (1 + flick)}) translate(${-bx} ${-b[3]})`}>
            <path d={FLAME.body.d} fill={COLORS.flame} />
            {FLAME.licks.map((l, i) => (
              <path key={i} d={l.d} fill={COLORS.yellow} opacity={clamp01(flame * 1.6 - 0.3 - i * 0.1)} />
            ))}
          </g>
        </svg>
      )}
      <div style={{ position: "absolute", left, top, width, height: PNG_H * k, opacity: clamp01(p * 1.4), transform: `scale(${lerp(1.25, 1, p)})`, filter: `blur(${(1 - p) * 10}px) drop-shadow(0 0 ${30 * glow}px rgba(241,90,41,0.55))` }}>
        <Img src={ASSETS.logo} style={{ width, height: PNG_H * k }} />
      </div>
    </>
  );
};

// ---------------------------------------------------------------- food frame
/** Food shot: slams in at 1.15x -> 1.0 with the brand easing. */
export const Slam: React.FC<{ children: React.ReactNode; dur?: number; from?: number }> = ({ children, dur = 10, from = 1.15 }) => {
  const frame = useCurrentFrame();
  const p = ease(frame, 0, dur);
  return <AbsoluteFill style={{ transform: `scale(${lerp(from, 1, p)})` }}>{children}</AbsoluteFill>;
};

/** Horizontal whip-pan entrance (motion-blurred slide). */
export const Whip: React.FC<{ children: React.ReactNode; dur?: number; dir?: 1 | -1 }> = ({ children, dur = 7, dir = 1 }) => {
  const frame = useCurrentFrame();
  const p = ease(frame, 0, dur);
  if (p >= 1) return <>{children}</>;
  return <AbsoluteFill style={{ transform: `translateX(${dir * (1 - p) * 1080}px)`, filter: `blur(${(1 - p) * 26}px)` }}>{children}</AbsoluteFill>;
};

export const OutlineWord: React.FC<{ text: string; y: number; px?: number }> = ({ text, y, px = 330 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: -300, right: -300, top: y - px / 2, textAlign: "center", fontFamily: FONTS.brand, fontSize: px, lineHeight: 1, whiteSpace: "nowrap", color: "transparent", WebkitTextStroke: "3px rgba(241,90,41,0.6)", letterSpacing: 6, transform: `translateX(${lerp(60, -60, clamp01(frame / 75))}px)`, opacity: ease(frame, 2, 10) }}>
      {text}
    </div>
  );
};

export const food = (name: string) => staticFile(`food/${name}`);
