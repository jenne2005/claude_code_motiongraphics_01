import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Img, Sequence, continueRender, delayRender, random, staticFile, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { ASSETS, COLORS, EASE, FONTS, loadBrandFonts } from "../brand";
import { HEX_PATH, HEX_VIEWBOX } from "../hexagon-path";
import { byId, fromPrice } from "../data";
import { EmberParticles, GrainOverlay, ParallaxHero, VegMark, Vignette, clamp01, hexPolygon, lerp } from "../components";
import { FLAME } from "../logo-flame";
import layout from "../food-layout.json";
import plan from "./plan.json";
import captionsJson from "./captions.json";
import voMeta from "../../public/audio/v4/vo/vo.json";

export type Hook = "A" | "B" | "C";
const C = plan.cuts;
export const V4_FRAMES = plan.frames;

// ---------------------------------------------------------------- grid + type
const SAFE = { top: 150, bottom: 1920 - 340, left: 90, right: 990 };
const ZONE = { heroTop: 160, heroBottom: 1000, captionY: 1060, priceTop: 1150, priceBottom: 1560 };
const T = { hook: 240, num: 280, title: 84, label: 40 };

const expo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(x)));
const ex = (f: number, start: number, dur: number) => expo((f - start) / dur);
const be = (f: number, start: number, dur: number) => EASE(clamp01((f - start) / dur));

const display = (px: number, color: string = COLORS.white): React.CSSProperties => ({
  fontFamily: FONTS.brand,
  fontSize: px,
  lineHeight: 1,
  color,
  textTransform: "uppercase",
  WebkitTextStroke: `${px >= 200 ? 10 : 6}px rgba(8,8,8,0.92)`,
  paintOrder: "stroke fill",
  textShadow: "0 8px 30px rgba(0,0,0,0.55)",
  letterSpacing: px * 0.01,
  whiteSpace: "nowrap",
});

// ---------------------------------------------------------------- masked line reveal
/** Words rise out of a mask: 12 frames, ease-out-expo, 2-frame word stagger. */
const Reveal: React.FC<{ text: string; at: number; style: React.CSSProperties; keyword?: string | null; keyColor?: string; dur?: number; exitAt?: number }> = ({
  text,
  at,
  style,
  keyword,
  keyColor = COLORS.yellow,
  dur = 12,
  exitAt,
}) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  const out = exitAt !== undefined ? ex(f, exitAt, 8) : 0;
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: `0 ${(style.fontSize as number) * 0.24}px`, flexWrap: "nowrap" }}>
      {words.map((w, i) => {
        const p = ex(f, at + i * 2, dur);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", padding: "0.12em 0.06em 0.06em", margin: "-0.12em -0.06em -0.06em" }}>
            <span style={{ ...style, display: "inline-block", color: keyword && w === keyword ? keyColor : style.color, transform: `translateY(${(1 - p) * 110 - out * 110}%)` }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- texture layers
/** Foreground embers through a 12px blur (one filter pass for the whole layer). */
const ForeEmbers: React.FC<{ seed: string; opacity?: number }> = ({ seed, opacity = 0.9 }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  return (
    <AbsoluteFill style={{ filter: "blur(12px)", opacity, pointerEvents: "none" }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const r = (k: number) => random(`${seed}-fe-${i}-${k}`);
        const life = 2.4 + r(1) * 2;
        const age = ((t + r(2) * life) % life) / life;
        const size = 12 + r(3) * 20;
        const x = r(4) * 1080 + Math.sin(t * 0.8 + i) * 30;
        const y = 1980 - age * 2100;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: "50%", background: r(5) > 0.5 ? COLORS.flame : COLORS.yellow, opacity: Math.sin(age * Math.PI) * 0.75 }} />
        );
      })}
    </AbsoluteFill>
  );
};

/** 4-frame orange light leak on a cut. */
const LightLeak: React.FC<{ at: number; corner?: "tl" | "tr" | "bl" | "br"; frames?: number; strength?: number }> = ({ at, corner = "tr", frames = 4, strength = 0.7 }) => {
  const f = useCurrentFrame();
  const d = f - at;
  if (d < 0 || d >= frames) return null;
  const k = (1 - d / frames) * strength;
  const pos = { tl: "0% 0%", tr: "100% 0%", bl: "0% 100%", br: "100% 100%" }[corner];
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: k,
        background: `radial-gradient(circle at ${pos}, rgba(255,200,140,0.95) 0%, rgba(241,90,41,0.75) 28%, rgba(241,90,41,0) 62%)`,
      }}
    />
  );
};

const Push: React.FC<{ len: number; to?: number; children: React.ReactNode; origin?: string }> = ({ len, to = 1.03, children, origin = "50% 40%" }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ transform: `scale(${lerp(1, to, clamp01(f / len))})`, transformOrigin: origin }}>{children}</AbsoluteFill>;
};

/** Motion blur only while something moves fast (whips, stamp, wipes): 8 samples. */
const BlurWhile: React.FC<{ until: number; children: React.ReactNode }> = ({ until, children }) => {
  const f = useCurrentFrame();
  if (f >= until) return <>{children}</>;
  return (
    <CameraMotionBlur shutterAngle={200} samples={8}>
      {children}
    </CameraMotionBlur>
  );
};

/** Whip-pan entrance: a fast settle from the side (rendered with motion blur). */
const WhipIn: React.FC<{ dir?: 1 | -1; children: React.ReactNode }> = ({ dir = 1, children }) => {
  const f = useCurrentFrame();
  const p = ex(f, 0, 7);
  return (
    <BlurWhile until={7}>
      <AbsoluteFill style={{ transform: `translateX(${dir * (1 - p) * 420}px)` }}>{children}</AbsoluteFill>
    </BlurWhile>
  );
};

/** Warm rim-light pool rendered as a heavily blurred ellipse: smooth, no gradient banding. */
const Glow: React.FC<{ x: number; y: number; w: number; h: number; opacity?: number }> = ({ x, y, w, h, opacity = 0.35 }) => (
  <div style={{ position: "absolute", left: x - w * 0.35, top: y - h * 0.35, width: w * 0.7, height: h * 0.7, borderRadius: "50%", background: COLORS.flame, opacity, filter: "blur(110px)" }} />
);

// ---------------------------------------------------------------- price system
/** Dark chamfered panel (24px chamfers echo the logo hexagon), 2px flame hairline. */
const chamfer = (w: number, h: number, c = 24) => `polygon(${c}px 0, ${w - c}px 0, ${w}px ${c}px, ${w}px ${h - c}px, ${w - c}px ${h}px, ${c}px ${h}px, 0 ${h - c}px, 0 ${c}px)`;

const DIGIT_DUR = 10;
/** Frame at which the panel's digits must start so the last digit lands on `lock`. */
const digitsStart = (lock: number, digits: number) => lock - (digits - 1) * 2 - DIGIT_DUR;

const PricePanel: React.FC<{ label: string; value: number; lock: number; exit: number; extra?: React.ReactNode }> = ({ label, value, lock, exit, extra }) => {
  const f = useCurrentFrame();
  const digits = String(value).split("");
  const start = digitsStart(lock, digits.length);
  const enter = start - 4;
  if (f < enter) return null;
  const pin = be(f, enter, 6);
  const out = be(f, exit, 6);
  const punch = f >= lock ? 1 + 0.015 * Math.exp(-(f - lock) / 3) : 1; // no overshoot: decays straight back
  const sweep = be(f, lock, 8);
  const W = 780;
  const H = 372;
  return (
    <div style={{ position: "absolute", left: (1080 - W) / 2, top: ZONE.priceTop, width: W, height: H + 60, opacity: pin * (1 - out), transform: `translateY(${out * 40}px) scale(${lerp(0.96, 1, pin)})`, transformOrigin: "50% 0%" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, clipPath: chamfer(W, H), background: COLORS.flame }} />
      <div style={{ position: "absolute", left: 2, top: 2, width: W - 4, height: H - 4, clipPath: chamfer(W - 4, H - 4, 23), background: "rgba(17,17,17,0.82)", backdropFilter: "blur(6px)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 22, textAlign: "center", fontFamily: FONTS.price, fontWeight: 600, fontSize: T.label, letterSpacing: "0.2em", color: "rgba(255,255,255,0.7)", paddingLeft: "0.2em" }}>{label}</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 66, display: "flex", justifyContent: "center", transform: `scale(${punch})` }}>
        <div style={{ position: "relative", display: "flex", fontFamily: FONTS.price, fontWeight: 900, fontSize: T.num, lineHeight: 1, color: COLORS.white, fontVariantNumeric: "tabular-nums", letterSpacing: -8, textShadow: "0 0 36px rgba(241,90,41,0.45)" }}>
          <span style={{ position: "absolute", right: "100%", top: 30, marginRight: 10, fontSize: 64, fontWeight: 900, letterSpacing: 0, opacity: be(f, start, 6) }}>Rs.</span>
          {digits.map((d, i) => {
            const p = ex(f, start + i * 2, DIGIT_DUR);
            return (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", height: T.num * 1.0 }}>
                <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 100}%)` }}>{d}</span>
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: "50%", top: 336, width: 460 * sweep, height: 6, transform: "translateX(-50%)", background: COLORS.flame, borderRadius: 3, boxShadow: "0 0 14px rgba(241,90,41,0.7)" }} />
      {extra && <div style={{ position: "absolute", left: 0, right: 0, top: H + 14, textAlign: "center", opacity: be(f, lock + 8, 8) }}>{extra}</div>}
    </div>
  );
};

const extraLine = (children: React.ReactNode) => (
  <span style={{ fontFamily: FONTS.price, fontWeight: 700, fontSize: T.label, letterSpacing: "0.06em", color: COLORS.white, textShadow: "0 2px 10px rgba(0,0,0,0.8)", whiteSpace: "nowrap" }}>{children}</span>
);

// ---------------------------------------------------------------- food in the hero zone
type FoodKey = "shawarma" | "burger" | "sandwich" | "fries" | "kebab";
/** Places a treated hero in the hero zone (y160-1000), masked so food never reaches the price zone. */
const HeroZoneFood: React.FC<{ item: FoodKey; len: number; word?: string; children?: React.ReactNode }> = ({ item, len, word, children }) => {
  const L = layout[item];
  const cy = (ZONE.heroTop + ZONE.heroBottom) / 2 + 10;
  const k = item === "kebab" ? 1.0 : Math.min(1, 720 / L.h, 900 / L.w);
  const ox = L.x + L.w / 2;
  const oy = L.y + L.h / 2;
  const mask = "linear-gradient(to bottom, black 0px, black 900px, transparent 1010px)";
  return (
    <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask }}>
      <AbsoluteFill style={{ transform: `translate(${540 - ox}px, ${cy - oy}px) scale(${k})`, transformOrigin: `${ox}px ${oy}px` }}>
        <ParallaxHero item={item} from={0} dur={len} pushTo={1.06} fadeEdges={item === "kebab" ? "both" : "bottom"} smoke={item !== "kebab"}>
          {word && <OutlineWord text={word} y={oy} />}
        </ParallaxHero>
      </AbsoluteFill>
      {children}
    </AbsoluteFill>
  );
};

const OutlineWord: React.FC<{ text: string; y: number }> = ({ text, y }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: -500, right: -500, top: y - 210, textAlign: "center", fontFamily: FONTS.brand, fontSize: 420, lineHeight: 1, whiteSpace: "nowrap", color: "transparent", WebkitTextStroke: "3px rgba(241,90,41,0.6)", letterSpacing: 8, transform: `translateX(${lerp(50, -50, clamp01(f / 70))}px)` }}>
      {text}
    </div>
  );
};

// ================================================================ scenes
const burgerMacro = (scale: number) => (
  <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "540px 1040px" }}>
    <AbsoluteFill style={{ transform: "translateY(170px) scale(1.25)", transformOrigin: "540px 930px" }}>
      <Img src={staticFile("food/burger-hero.png")} style={{ width: 1080, height: 1920 }} />
      <Img src={staticFile("food/burger-cutout.png")} style={{ position: "absolute", left: layout.burger.x, top: layout.burger.y, width: layout.burger.w, height: layout.burger.h }} />
    </AbsoluteFill>
  </AbsoluteFill>
);

const topScrim = <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(10,10,10,0.88) 0%, rgba(10,10,10,0.55) 30%, rgba(10,10,10,0) 52%, rgba(10,10,10,0) 80%, rgba(10,10,10,0.6) 100%)" }} />;

/** HOOK. `hf` lets the loop dissolve render the exact frame-0 state. */
const HookScene: React.FC<{ hook: Hook; hf: number }> = ({ hook, hf }) => {
  const punch = lerp(1, 1.12, EASE(clamp01(hf / (C.stamp - 1))));
  const line = (at: number) => expo((hf - at) / 12); // line reveal; starts before 0 so frame 0 is fully readable
  const L1 = line(-9);
  const L2 = line(-7);
  const mask = (p: number, node: React.ReactNode) => (
    <div style={{ overflow: "hidden", padding: "0.1em 0.2em 0.05em", margin: "-0.1em -0.2em -0.05em" }}>
      <div style={{ transform: `translateY(${(1 - p) * 105}%)` }}>{node}</div>
    </div>
  );
  const big =
    hook === "C" ? (
      <div style={{ ...display(T.num, COLORS.yellow), textTransform: "none", fontFamily: FONTS.price, fontWeight: 900, WebkitTextStroke: "0px", letterSpacing: -8, textShadow: "0 0 40px rgba(241,90,41,0.55), 0 10px 30px rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
        <span style={{ fontSize: 64, marginTop: 34, marginRight: 10, letterSpacing: 0 }}>Rs.</span>
        {fromPrice(byId("burgers"))}.
      </div>
    ) : (
      <div style={{ ...display(T.hook, COLORS.yellow), letterSpacing: -2 }}>{hook === "A" ? "ADIBATLA." : "ADIBATLA,"}</div>
    );
  const small = hook === "A" ? <div style={display(T.title)}>10 PM. STILL AT WORK?</div> : <div style={display(120)}>{hook === "B" ? "WE NEED TO TALK." : "NOT A TYPO."}</div>;
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      {burgerMacro(punch)}
      {topScrim}
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 330, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        {mask(L1, big)}
        {mask(L2, small)}
      </div>
    </AbsoluteFill>
  );
};

const HookLayer: React.FC<{ hook: Hook }> = ({ hook }) => {
  const f = useCurrentFrame();
  return (
    <>
      <HookScene hook={hook} hf={f} />
      {/* orange light-leak flash on frames 0-3 (edges only, food stays sharp) */}
      <LightLeak at={0} corner="tl" frames={4} strength={0.55} />
      <ForeEmbers seed="hook" opacity={0.7} />
    </>
  );
};

const StampScene: React.FC = () => {
  const f = useCurrentFrame();
  const shake = f < 5 ? { x: (random(`sx${f}`) - 0.5) * 28, y: (random(`sy${f}`) - 0.5) * 28 } : { x: 0, y: 0 };
  const p = ex(f, 0, 6);
  const len = C.logo - C.stamp;
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal, transform: `translate(${shake.x}px, ${shake.y}px)` }}>
      {burgerMacro(lerp(1.12, 1.17, clamp01(f / len)))}
      <AbsoluteFill style={{ background: "rgba(10,10,10,0.35)" }} />
      <BlurWhile until={6}>
        <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 420 }}>
          <svg width={0} height={0} style={{ position: "absolute" }}>
            <filter id="ink4">
              <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
              <feDisplacementMap in="SourceGraphic" scale="6" />
            </filter>
          </svg>
          <div style={{ transform: `rotate(-6deg) scale(${lerp(2.2, 1, p)})`, opacity: clamp01(f / 2 + 0.01), filter: "url(#ink4)", border: `10px solid ${COLORS.flame}`, outline: `3px solid ${COLORS.flame}`, outlineOffset: 8, borderRadius: 14, padding: "24px 44px 30px", background: "rgba(12,12,12,0.78)", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ fontFamily: FONTS.brand, fontSize: T.title, lineHeight: 1, color: COLORS.flame, letterSpacing: 4 }}>COMPLAINT FILED:</div>
            <div style={{ fontFamily: FONTS.brand, fontSize: T.hook - 60, lineHeight: 1, color: COLORS.flame, letterSpacing: 6, marginTop: 10 }}>HUNGER.</div>
          </div>
        </AbsoluteFill>
      </BlurWhile>
      <LightLeak at={0} corner="tr" />
      <ForeEmbers seed="stamp" />
    </AbsoluteFill>
  );
};

const Pin: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 40 52" style={{ overflow: "visible", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))", flex: "none" }}>
    <path d="M20 51 C20 51 3 31 3 19 A17 17 0 0 1 37 19 C37 31 20 51 20 51 Z" fill={COLORS.flame} stroke="#fff" strokeWidth={2.4} />
    <circle cx={20} cy={19} r={6.5} fill="#fff" />
  </svg>
);

/** The logo PNG with its flame igniting first (hands off onto the logo's own flame). */
const Logo: React.FC<{ cx: number; cy: number; width: number; p: number; flame: number; glow: number }> = ({ cx, cy, width, p, flame, glow }) => {
  const PNG_W = 1868, PNG_H = 1625;
  const k = width / PNG_W;
  const left = cx - width / 2, top = cy - (PNG_H * k) / 2;
  const b = FLAME.body.bbox;
  const fx = left + (((b[0] + b[2]) / 2) * 10 - 508) * k;
  const fBase = top + (b[3] * 10 - 189) * k;
  const s = ((b[3] - b[1]) * 10 * k) / (b[3] - b[1]);
  const bx = (b[0] + b[2]) / 2;
  const f = useCurrentFrame();
  const flick = Math.sin(f * 0.35) * 0.02 + Math.sin(f * 0.81) * 0.012;
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
      <div style={{ position: "absolute", left, top, width, height: PNG_H * k, opacity: clamp01(p * 1.4), transform: `scale(${lerp(1.18, 1, p)})`, filter: `drop-shadow(0 0 ${30 * glow}px rgba(241,90,41,0.55))` }}>
        <Img src={ASSETS.logo} style={{ width, height: PNG_H * k }} />
      </div>
    </>
  );
};

const LogoScene: React.FC = () => {
  const f = useCurrentFrame();
  const len = C.shawarma - C.logo;
  const flame = be(f, 0, 12);
  const logo = ex(f, 9, 14); // locked by ~0.8 s
  const pinP = ex(f, 24, 9);
  const ripple = (k: number) => clamp01((f - 32 - k * 6) / 22);
  return (
    <AbsoluteFill style={{ background: COLORS.logoBlack }}>
      <Push len={len}>
        <Glow x={540} y={560} w={1200} h={1000} opacity={0.35 * flame} />
        <EmberParticles seed="v4logo" opacity={flame} area={[150, 200, 780, 800]} />
        <Logo cx={540} cy={560} width={680} p={logo} flame={flame} glow={logo} />
        {f >= 24 && (
          <>
            {[0, 1, 2].map((k) => (
              <div key={k} style={{ position: "absolute", left: 540 - 150 * ripple(k), top: 1262 - 36 * ripple(k), width: 300 * ripple(k), height: 72 * ripple(k), borderRadius: "50%", border: `3px solid ${COLORS.flame}`, opacity: (1 - ripple(k)) * 0.9 }} />
            ))}
            <div style={{ position: "absolute", left: 540 - 40, top: lerp(1010, 1158, pinP), opacity: clamp01(pinP * 4) }}>
              <Pin size={80} />
            </div>
          </>
        )}
        <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1330 }}>
          <Reveal text="NEAR TCS, ADIBATLA" keyword="ADIBATLA" at={30} style={display(T.title)} />
        </div>
      </Push>
      <LightLeak at={0} corner="bl" />
      <ForeEmbers seed="logo" />
    </AbsoluteFill>
  );
};

const FoodScene: React.FC<{ item: FoodKey; word: string; start: number; end: number; price: { label: string; value: number; key: keyof typeof plan.prices; extra?: React.ReactNode }; children?: React.ReactNode; flash?: boolean; dir?: 1 | -1 }> = ({ item, word, start, end, price, children, flash, dir = 1 }) => {
  const f = useCurrentFrame();
  const len = end - start;
  const pr = plan.prices[price.key];
  const body = (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <Glow x={540} y={560} w={1150} h={950} opacity={0.22} />
      <HeroZoneFood item={item} len={len} word={word} />
      <EmberParticles seed={`v4${item}`} opacity={0.8} area={[120, 160, 840, 820]} />
      {children}
      <PricePanel label={price.label} value={price.value} lock={pr.lock - start} exit={pr.exit - start} extra={price.extra} />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill>
      {flash ? body : <WhipIn dir={dir}>{body}</WhipIn>}
      {flash && f < 6 && <AbsoluteFill style={{ background: f < 3 ? "#FFF3E6" : COLORS.flame, opacity: 1 - f / 6 * 0.7 }} />}
      <LightLeak at={0} corner={dir > 0 ? "tr" : "tl"} />
      <ForeEmbers seed={`fe${item}`} />
    </AbsoluteFill>
  );
};

const KebabExtras: React.FC = () => {
  const f = useCurrentFrame();
  const names = ["HARA BARA", "TIKKA", "WINGS", "TANDOORI JOINT"];
  const at = [14, 26, 38, 50];
  const cur = [...at.keys()].filter((i) => f >= at[i]).pop();
  const veg = (n: string) => byId("kebabs").items.find((i) => i.name.toLowerCase() === n.toLowerCase())?.veg;
  return (
    <>
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(17,17,17,0.82) 160px, rgba(17,17,17,0.15) 520px, rgba(17,17,17,0.2) 700px, rgba(17,17,17,0.8) 960px)" }} />
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 300 }}>
        <Reveal text="12 KEBABS" at={0} style={{ ...display(220), letterSpacing: -2 }} keyword="12" />
      </div>
      {cur !== undefined && (
        <div key={cur} style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 860, display: "flex", justifyContent: "center", alignItems: "center", gap: 20 }}>
          {veg(names[cur]) && <VegMark size={56} />}
          <Reveal text={names[cur]} at={at[cur]} style={display(T.title)} />
        </div>
      )}
    </>
  );
};

// ---------------------------------------------------------------- bundle
const MEALS = [
  { name: "SHAWARMA MEAL", id: "shawarma", photo: "shawarma" },
  { name: "BURGER MEAL", id: "burgers", photo: "burger" },
  { name: "SANDWICH MEAL", id: "sandwiches", photo: "sandwich" },
] as const;

const BundleScene: React.FC = () => {
  const f = useCurrentFrame();
  const len = C.cheat - C.bundle;
  const lock = plan.prices.meals.lock - C.bundle;
  const exitRows = 60; // rows hold 1.2 s after the last one lands, then leave upward through their masks
  const minMeal = Math.min(...MEALS.map((m) => byId(m.id).meal!.price));
  const cluster = ex(f, exitRows + 4, 12);
  return (
    <AbsoluteFill>
      <WhipIn>
        <AbsoluteFill style={{ background: COLORS.charcoal }}>
          <Push len={len}>
            <Glow x={540} y={600} w={1200} h={1100} opacity={0.22 + 0.18 * cluster} />
            <EmberParticles seed="v4bundle" />
            {f < exitRows + 12 &&
              MEALS.map((m, i) => {
                const inP = ex(f, 2 + i * 6, 12);
                const outP = ex(f, exitRows + i * 2, 10);
                const y = 300 + i * 200;
                const meal = byId(m.id).meal!;
                return (
                  <div key={m.id} style={{ position: "absolute", left: SAFE.left, width: SAFE.right - SAFE.left, top: y, height: 170, overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", transform: `translateY(${(1 - inP) * 110 - outP * 110}%)` }}>
                      <div style={{ position: "relative", width: 120, height: 120, flex: "none" }}>
                        <svg viewBox={HEX_VIEWBOX} width={120} height={120} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                          <path d={HEX_PATH} fill="rgba(8,8,8,0.85)" stroke={COLORS.flame} strokeWidth={2.2} />
                        </svg>
                        <div style={{ position: "absolute", inset: 0, clipPath: hexPolygon(60, 60, 114), display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Img src={staticFile(`food/${m.photo}-cutout.png`)} style={{ width: 108, height: 108, objectFit: "contain" }} />
                        </div>
                      </div>
                      <div style={{ ...display(54), marginLeft: 26, WebkitTextStroke: "5px rgba(8,8,8,0.92)" }}>{m.name}</div>
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-start", fontFamily: FONTS.price, fontWeight: 900, color: COLORS.white, fontVariantNumeric: "tabular-nums", textShadow: "0 0 26px rgba(241,90,41,0.5)" }}>
                        <span style={{ fontSize: T.label, marginTop: 14, marginRight: 6 }}>Rs.</span>
                        <span style={{ fontSize: 120, lineHeight: 1, letterSpacing: -4, width: 210, textAlign: "right" }}>{meal.price}</span>
                      </div>
                    </div>
                    <div style={{ position: "absolute", left: 146, right: 0, bottom: 4, height: 2, background: "rgba(241,90,41,0.45)", transform: `scaleX(${inP * (1 - outP)})`, transformOrigin: "0 0" }} />
                  </div>
                );
              })}
            {/* payoff: the three heroes together in the hero zone */}
            {cluster > 0 && (
              <AbsoluteFill style={{ opacity: clamp01(cluster * 1.5), transform: `scale(${lerp(1.12, 1, cluster)})`, transformOrigin: "540px 600px" }}>
                <Img src={staticFile("food/fries-cutout.png")} style={{ position: "absolute", left: 600, top: 330, width: 400, height: 390 }} />
                <Img src={staticFile("food/shawarma-cutout.png")} style={{ position: "absolute", left: 60, top: 470, width: 470, height: 293 }} />
                <Img src={staticFile("food/burger-cutout.png")} style={{ position: "absolute", left: 260, top: 360, width: 560, height: 521, filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.6))" }} />
              </AbsoluteFill>
            )}
          </Push>
          <PricePanel label="MEALS FROM" value={minMeal} lock={lock} exit={plan.prices.meals.exit - C.bundle} extra={extraLine("FRIES + SOFT DRINK INCLUDED")} />
        </AbsoluteFill>
      </WhipIn>
      {f >= lock && f < lock + 5 && <AbsoluteFill style={{ background: "#FFE9D6", opacity: (1 - (f - lock) / 5) * 0.4, mixBlendMode: "screen" }} />}
      <LightLeak at={0} corner="br" />
      <ForeEmbers seed="bundle" />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- cheat line
const CheatScene: React.FC<{ voStart: number; dur: number }> = ({ voStart, dur }) => {
  const f = useCurrentFrame();
  const len = C.end - C.cheat;
  const parts = ["FINALLY,", "A CHEAT MEAL", "THAT ISN'T", "CHEATING."];
  const total = parts.reduce((s, p) => s + p.length, 0);
  let acc = 0;
  const at = parts.map((p) => {
    const t = voStart + ((dur - 0.2) * acc) / total;
    acc += p.length;
    return Math.max(0, Math.round(t * 30) - C.cheat);
  });
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <BlurWhile until={6}>
        <AbsoluteFill style={{ clipPath: hexPolygon(540, 960, lerp(200, 2600, ex(f, 0, 8))) }}>
          <AbsoluteFill style={{ background: COLORS.charcoal }}>
            <Push len={len} to={1.04}>
              <Glow x={540} y={980} w={1200} h={1200} opacity={0.28} />
              <EmberParticles seed="v4cheat" />
              <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 470, display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
                <Reveal text={parts[0]} at={at[0]} style={display(120)} />
                <Reveal text={parts[1]} at={at[1]} style={display(120)} />
                <Reveal text={parts[2]} at={at[2]} style={display(120)} />
                <Reveal text={parts[3]} at={at[3]} style={{ ...display(T.hook, COLORS.yellow), letterSpacing: -2, textShadow: "0 0 30px rgba(255,242,0,0.4), 0 0 70px rgba(241,90,41,0.55)" }} />
              </div>
            </Push>
          </AbsoluteFill>
        </AbsoluteFill>
      </BlurWhile>
      <LightLeak at={0} corner="tl" />
      <ForeEmbers seed="cheat" />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- end card
const EndScene: React.FC = () => {
  const f = useCurrentFrame();
  const len = C.dissolve - C.end;
  const logo = ex(f, 0, 10);
  return (
    <AbsoluteFill style={{ background: COLORS.logoBlack }}>
      <Push len={len} to={1.03}>
        <Glow x={540} y={560} w={1200} h={1000} opacity={0.35} />
        <EmberParticles seed="v4end" />
        <Logo cx={540} cy={560} width={600} p={logo} flame={0} glow={logo} />
        <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 880, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
          <Reveal text="CRAVE. GRILL. REPEAT." at={4} style={display(T.title)} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: be(f, 8, 6) }}>
            <Pin size={40} />
            <Reveal text="NEAR TCS, ADIBATLA" keyword="ADIBATLA" at={8} style={{ ...display(56), WebkitTextStroke: "4px rgba(8,8,8,0.92)" }} />
          </div>
          <Reveal text={`${plan.order ? plan.order.toUpperCase() + "  •  " : ""}${plan.handle}`} at={12} style={{ fontFamily: FONTS.price, fontWeight: 700, fontSize: T.label, color: "rgba(255,255,255,0.88)", letterSpacing: "0.04em", whiteSpace: "nowrap" }} />
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <Reveal text="TAG THE FRIEND" at={16} style={{ fontFamily: FONTS.price, fontWeight: 900, fontSize: 56, color: COLORS.white, lineHeight: 1.1 }} />
            <Reveal text="WHO WORKS LATE." at={18} style={{ fontFamily: FONTS.price, fontWeight: 900, fontSize: 56, color: COLORS.white, lineHeight: 1.1 }} />
            <div style={{ margin: "16px auto 0", width: 380 * be(f, 22, 8), height: 6, background: COLORS.flame, borderRadius: 3 }} />
          </div>
        </div>
      </Push>
      <LightLeak at={0} corner="tr" />
      <ForeEmbers seed="end" />
    </AbsoluteFill>
  );
};

/** Last 6 frames: the end card dissolves into the exact frame-0 hook so the reel loops. */
const LoopDissolve: React.FC<{ hook: Hook }> = ({ hook }) => {
  const f = useCurrentFrame();
  const n = plan.frames - C.dissolve;
  return (
    <AbsoluteFill>
      <Sequence from={-(C.dissolve - C.end)} name="end card (continued)">
        <EndScene />
      </Sequence>
      <AbsoluteFill style={{ opacity: (f + 1) / n }}>
        {/* the exact frame-0 stack: hook, its light-leak flash and its foreground embers, all at frame 0 */}
        <Sequence from={f} layout="none">
          <HookLayer hook={hook} />
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- persistent tags + captions
const LocationTag: React.FC = () => {
  const f = useCurrentFrame();
  const [a, b] = plan.locationTag;
  if (f < a || f >= b) return null;
  const p = ex(f, a, 12);
  const [la, lb] = plan.openLoop;
  const loop = f >= la && f < lb;
  const lp = ex(f, la + 6, 12) * (1 - ex(f, lb - 8, 8));
  return (
    <div style={{ position: "absolute", left: SAFE.left, top: 170, transform: `translateX(${(1 - p) * -40}px)`, opacity: p }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 18px 8px 12px", background: "rgba(10,10,10,0.6)", borderRadius: 30, border: "1px solid rgba(241,90,41,0.5)" }}>
        <Pin size={30} />
        <span style={{ fontFamily: FONTS.price, fontWeight: 800, fontSize: T.label, color: COLORS.white, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
          NEAR TCS, <span style={{ color: COLORS.yellow }}>ADIBATLA</span>
        </span>
      </div>
      {loop && (
        <div style={{ marginTop: 10, marginLeft: 6, overflow: "hidden" }}>
          <div style={{ transform: `translateY(${(1 - lp) * 110}%)`, fontFamily: FONTS.price, fontWeight: 700, fontSize: T.label, color: COLORS.flame, letterSpacing: "0.04em", whiteSpace: "nowrap", textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
            MEAL DEALS AT THE END ↓
          </div>
        </div>
      )}
    </div>
  );
};

type Chunk = { text: string; key: string | null; start: number; end: number; line: string };
const Captions: React.FC<{ chunks: Chunk[] }> = ({ chunks }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const locks = Object.values(plan.prices).map((p) => p.lock);
  if (locks.some((l) => f >= l - 12 && f <= l + 10)) return null; // never compete with a price lock
  const c = [...chunks].filter((x) => x.start <= t && t < x.end).pop();
  if (!c) return null;
  if (c.line === "L3" && c.text.startsWith("NEAR")) return null; // the location piece is on screen
  const at = Math.round(c.start * 30);
  const out = ex(f, Math.round(c.end * 30) - 3, 4);
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: ZONE.captionY - 46, opacity: 1 - out }}>
      <Reveal text={c.text} keyword={c.key} at={at} style={display(T.title)} />
    </div>
  );
};

/** Cover still: the hook at full reveal, no flash, all text inside the 4:5 grid crop. */
export const CoverV4: React.FC = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    loadBrandFonts().then(() => continueRender(handle));
  }, [handle]);
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <HookScene hook="A" hf={20} />
      <Vignette strength={0.4} />
    </AbsoluteFill>
  );
};

// ================================================================ assembly
export const ReelV4: React.FC<{ hook: Hook }> = ({ hook }) => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    loadBrandFonts().then(() => continueRender(handle));
  }, [handle]);
  const S = (from: number, to: number) => ({ from, durationInFrames: to - from });
  const L6 = plan.vo.A.find((v) => v[0] === "L6")![1] as number;
  const L6dur = voMeta.lines.L6.duration;
  const pr = (k: keyof typeof plan.prices) => k;
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <Sequence {...S(0, C.stamp)} name="hook">
        <HookLayer hook={hook} />
      </Sequence>
      <Sequence {...S(C.stamp, C.logo)} name="stamp">
        <StampScene />
      </Sequence>
      <Sequence {...S(C.logo, C.shawarma)} name="logo">
        <LogoScene />
      </Sequence>
      <Sequence {...S(C.shawarma, C.burger)} name="shawarma">
        <FoodScene item="shawarma" word="SHAWARMA" start={C.shawarma} end={C.burger} price={{ label: "FROM", value: fromPrice(byId("shawarma")), key: pr("shawarma") }} />
      </Sequence>
      <Sequence {...S(C.burger, C.sandwich)} name="burger">
        <FoodScene item="burger" word="BURGERS" start={C.burger} end={C.sandwich} dir={-1} price={{ label: "FROM", value: fromPrice(byId("burgers")), key: pr("burger") }} />
      </Sequence>
      <Sequence {...S(C.sandwich, C.kebab)} name="sandwich (pattern interrupt)">
        <FoodScene item="sandwich" word="SANDWICHES" start={C.sandwich} end={C.kebab} flash price={{ label: "FROM", value: fromPrice(byId("sandwiches")), key: pr("sandwich") }} />
      </Sequence>
      <Sequence {...S(C.kebab, C.fries)} name="kebabs">
        <FoodScene item="kebab" word="" start={C.kebab} end={C.fries} dir={-1} price={{ label: "FROM", value: fromPrice(byId("kebabs")), key: pr("kebab") }}>
          <KebabExtras />
        </FoodScene>
      </Sequence>
      <Sequence {...S(C.fries, C.bundle)} name="fries">
        <FoodScene
          item="fries"
          word="FRIES"
          start={C.fries}
          end={C.bundle}
          price={{
            label: byId("fries").items[0].name.toUpperCase(),
            value: byId("fries").items[0].price,
            key: pr("fries"),
            extra: extraLine(
              <>
                <span style={{ color: COLORS.flame }}>+ </span>SPECIAL MAYO Rs.{byId("fries").addOns[0].price}
              </>,
            ),
          }}
        />
      </Sequence>
      <Sequence {...S(C.bundle, C.cheat)} name="bundle">
        <BundleScene />
      </Sequence>
      <Sequence {...S(C.cheat, C.end)} name="cheat">
        <CheatScene voStart={L6} dur={L6dur} />
      </Sequence>
      <Sequence {...S(C.end, C.dissolve)} name="end card">
        <EndScene />
      </Sequence>
      <Sequence {...S(C.dissolve, plan.frames)} name="loop dissolve">
        <LoopDissolve hook={hook} />
      </Sequence>

      <LocationTag />
      <Captions chunks={(captionsJson as Record<Hook, Chunk[]>)[hook]} />
      <Vignette strength={0.45} />
      <GrainOverlay opacity={0.05} />
      <Audio src={staticFile(`audio/v4/mix-${hook}.wav`)} />
    </AbsoluteFill>
  );
};
