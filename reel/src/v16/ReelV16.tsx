import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Img, Sequence, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { COLORS, EASE, FONTS, loadBrandFonts } from "../brand";
import { HEX_PATH, HEX_VIEWBOX } from "../hexagon-path";
import { Category, byId, fromPrice } from "../data";
import { EmberParticles, GrainOverlay, HexWipe, KineticCaption, LightSweep, ParallaxHero, RimGlow, Smoke, VegMark, Vignette, clamp01, ease, hexPolygon, lerp } from "../components";
import { LogoFlame } from "../scenes/Hook";
import { Cheat, LogoEnd } from "../scenes/Outro";
import { Scene, WIPE } from "../timeline";
import layout from "../food-layout.json";
import v1vo from "../../public/audio/vo/vo-timings.json";
import vo16 from "../../public/audio/v16/vo/vo16.json";
import plan from "./plan.json";

const P = plan;
const SC = P.scenes;
export const V16_FRAMES = P.frames;
const rs = (n: number) => `Rs.${n}`;
const expo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(x)));

// Layout: safe areas top 150 / bottom 340 / sides 90; key text inside the centre 4:5 crop (y 285-1635).
const SAFE = { left: 90, right: 990, bottom: 1580 };

/** v1 headline style: One Slice, white, dark stroke, soft shadow. */
const headline = (px: number, color: string = COLORS.white): React.CSSProperties => ({
  fontFamily: FONTS.brand,
  fontSize: px,
  lineHeight: 1.02,
  color,
  letterSpacing: 2,
  WebkitTextStroke: `${px >= 100 ? 8 : 6}px rgba(8,8,8,0.9)`,
  paintOrder: "stroke fill",
  textShadow: "0 6px 24px rgba(0,0,0,0.6)",
});

/** A v1 Scene object for reusing the v1 Cheat and LogoEnd scenes with v1.6 timing. */
const asScene = (id: "cheat" | "logo", from: number, to: number, voAt: number, words: { word: string; start: number; end: number }[], duration: number, extraLength = 0): Scene => ({
  id,
  vo: { id: 0, file: "", text: "", duration, words },
  start: from,
  length: to - from + extraLength,
  voAt: Math.round(voAt * 30) - from,
});

// ================================================================ HOOK (match cut on the whip)
const HOOK = P.hook;
const BURGER_DROP = Math.round(HOOK.flowPxPerFrame * 1.12 * 2); // first frame moves exactly the clip's (zoomed) whip speed
const HOOK_TEXT_Y = 300;

/** The graded clip frame shown at timeline frame `f` (only before the cut). */
const ClipFrame: React.FC<{ f: number }> = ({ f }) => (
  <Img src={staticFile(`hook16/f${String(Math.max(0, Math.min(HOOK.clipFrames - 1, f))).padStart(3, "0")}.png`)} style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }} />
);

/** "EVERYTHING WE MAKE." masked line reveal, fully readable by frame 3. Moves with the burger's settle. */
const HookTitle: React.FC<{ f: number; settle: number }> = ({ f, settle }) => {
  const lines = ["EVERYTHING", "WE MAKE."];
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: HOOK_TEXT_Y + settle, textAlign: "center" }}>
      {lines.map((l, i) => {
        const p = EASE(clamp01((f + 1 - i) / 3)); // frame 0 already shows most of line 1; both lines done by frame 3
        return (
          <div key={l} style={{ overflow: "hidden", padding: "6px 0" }}>
            <div style={{ ...headline(130), transform: `translateY(${(1 - p) * 105}%)` }}>{l}</div>
          </div>
        );
      })}
    </div>
  );
};

/** The v1 burger hero (sharp, rim light, embers), dropping in from the top at whip speed after the cut.
 *  `middle` renders between the hero plate and the cutout (the v1 flame burns behind the bun). */
const BURGER_SCALE = 0.88;
const BURGER_Y = 100;
const BurgerDrop: React.FC<{ k: number; middle?: React.ReactNode }> = ({ k, middle }) => {
  // k = frames since the cut
  const p = expo(k / 10);
  const y = -BURGER_DROP * (1 - p) + BURGER_Y;
  const s = lerp(1.15, 1, p) * BURGER_SCALE;
  const L = layout.burger;
  return (
    <AbsoluteFill style={{ transform: `translateY(${y}px) scale(${s})`, transformOrigin: `540px ${L.y + L.h / 2}px` }}>
      <Img src={staticFile("food/burger-hero.png")} style={{ position: "absolute", inset: 0, width: 1080, height: 1920, WebkitMaskImage: "radial-gradient(ellipse 50% 40% at 50% 49%, black 55%, transparent 100%)", maskImage: "radial-gradient(ellipse 50% 40% at 50% 49%, black 55%, transparent 100%)" }} />
      {middle}
      <Img src={staticFile("food/burger-cutout.png")} style={{ position: "absolute", left: L.x, top: L.y, width: L.w, height: L.h }} />
    </AbsoluteFill>
  );
};

const HookScene: React.FC<{ f: number }> = ({ f }) => {
  const cut = HOOK.cut;
  const k = f - cut;
  const after = k >= 0;
  const settle = after ? lerp(0, 34, expo(k / 10)) : 0; // the title rides the burger's settle
  const fire = ease(f, HOOK.onFire, 14);
  const L = layout.burger;
  void L;
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      {!after && <ClipFrame f={f} />}
      {after && (
        <>
          <RimGlow x={540} y={760} w={1250} h={1150} opacity={0.35 + 0.25 * fire} />
          {k < 2 ? (
            <CameraMotionBlur shutterAngle={270} samples={8}>
              <BurgerDropAt k={k} />
            </CameraMotionBlur>
          ) : (
            <BurgerDrop k={k} middle={fire > 0 ? <LogoFlame x={540} baseY={L.y + 60} height={330} grow={fire} /> : undefined} />
          )}
          <EmberParticles seed="v16hook" opacity={clamp01(k / 6)} area={[160, 400, 760, 1000]} />
          <Smoke x={540} y={720} w={500} count={5} opacity={clamp01(k / 10)} />
        </>
      )}
      <HookTitle f={f} settle={settle} />
      {f >= HOOK.onFire && (
        <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1400 }}>
          <KineticCaption words={[{ text: "ON", at: HOOK.onFire, color: COLORS.yellow, glow: true }, { text: "FIRE.", at: HOOK.onFire + 3, color: COLORS.yellow, glow: true }]} wordStyle={{ ...headline(150, COLORS.yellow) }} dur={7} />
        </div>
      )}
      {/* 3-frame orange-white flash on the cut */}
      {k >= 0 && k < 3 && <AbsoluteFill style={{ background: k === 0 ? "#FFF1E2" : COLORS.flame, opacity: [0.7, 0.45, 0.2][k], mixBlendMode: "screen" }} />}
    </AbsoluteFill>
  );
};

/** BurgerDrop reading the frame from the motion-blur sampler (sub-frame k). */
const BurgerDropAt: React.FC<{ k: number }> = () => {
  const f = useCurrentFrame();
  return <BurgerDrop k={f - HOOK.cut} />;
};

const HookLayer: React.FC = () => {
  const f = useCurrentFrame();
  return <HookScene f={f} />;
};

// ================================================================ LOCATION
const Location: React.FC = () => {
  const seq = useCurrentFrame();
  const len = SC.location.to - SC.location.from;
  const w = vo16.lines.L2.words;
  const voAt = Math.round(P.vo.L2.at * 30) - SC.location.from;
  // words: Near, T, C, S, <name...> -> index-based so every NAME_VARIANT spelling works
  const idx = { Near: 0, T: 1, Aadi: w.length - 2 } as Record<string, number>;
  const at = (name: string) => voAt + Math.round(w[idx[name]].start * 30);
  const push = lerp(1, 1.06, clamp01(seq / len));
  const dim = ease(seq, 0, 14);
  const L = layout.burger;
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      {/* the burger keeps burning behind the place name (continuity from the hook) */}
      <AbsoluteFill style={{ transform: `translateY(${BURGER_Y}px) scale(${BURGER_SCALE * push})`, transformOrigin: `540px ${L.y + L.h / 2}px` }}>
        <Img src={staticFile("food/burger-hero.png")} style={{ position: "absolute", inset: 0, width: 1080, height: 1920, WebkitMaskImage: "radial-gradient(ellipse 50% 40% at 50% 49%, black 55%, transparent 100%)", maskImage: "radial-gradient(ellipse 50% 40% at 50% 49%, black 55%, transparent 100%)" }} />
        <LogoFlame x={540} baseY={L.y + 60} height={330} grow={1} />
        <Img src={staticFile("food/burger-cutout.png")} style={{ position: "absolute", left: L.x, top: L.y, width: L.w, height: L.h }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(12,12,12,0.62)", opacity: dim }} />
      <RimGlow x={540} y={720} w={1200} h={900} opacity={0.35} />
      <EmberParticles seed="v16loc" />
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 470, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <KineticCaption words={[{ text: "NEAR", at: Math.min(2, at("Near") - 2) }, { text: "TCS,", at: Math.min(5, at("T") - 2) }]} wordStyle={headline(150)} />
        <div style={{ position: "relative", overflow: "hidden", padding: "0 10px" }}>
          <KineticCaption words={[{ text: "ADIBATLA", at: Math.min(16, at("Aadi") - 2), color: COLORS.yellow, glow: true }]} wordStyle={headline(190, COLORS.yellow)} />
          <LightSweep start={at("Aadi")} dur={22} opacity={0.45} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ================================================================ PRICE BADGE (v1 style, 40% larger, digits reveal left to right)
const BADGE = { x: 540, y: 1232, size: 406 };

const Digits: React.FC<{ text: string; at: number; px: number; color: string }> = ({ text, at, px, color }) => {
  const f = useCurrentFrame();
  return (
    <span style={{ display: "inline-flex", fontFamily: FONTS.price, fontWeight: 800, fontSize: px, color, lineHeight: 1.05, letterSpacing: -1, fontVariantNumeric: "tabular-nums" }}>
      {text.split("").map((ch, i) => {
        const p = EASE(clamp01((f - at - i * 2) / 8)); // left to right, ease-out, no overshoot, never a wrong digit
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", height: px * 1.08 }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 100}%)` }}>{ch}</span>
          </span>
        );
      })}
    </span>
  );
};

/** v1 HexBadge, 40% larger, centred in the lower third; `lock` = frame the last digit lands. */
const BigBadge: React.FC<{ label: string; value: number; lock: number }> = ({ label, value, lock }) => {
  const frame = useCurrentFrame();
  const n = String(value).length + 3; // "Rs." + digits
  const at = lock - (n - 1) * 2 - 8;
  const enter = at - 8;
  if (frame < enter) return null;
  const p = ease(frame, enter, 16);
  const { x, y, size } = BADGE;
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, transform: `scale(${lerp(1.35, 1, p)}) rotate(${lerp(-10, -4, p)}deg)`, opacity: clamp01(p * 2.2), filter: `blur(${(1 - p) * 8}px) drop-shadow(0 0 ${28 * p}px rgba(241,90,41,0.55))` }}>
      <svg viewBox={HEX_VIEWBOX} width={size} height={size} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={HEX_PATH} fill="rgba(13,13,13,0.92)" stroke={COLORS.flame} strokeWidth={2.6} strokeLinejoin="round" />
        <path d={HEX_PATH} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={0.6} transform="translate(143.85 116.4) scale(0.9) translate(-143.85 -116.4)" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", clipPath: hexPolygon(size / 2, size / 2, size * 0.98), overflow: "hidden" }}>
        <div style={{ fontFamily: FONTS.price, fontWeight: 600, fontSize: size * 0.085, letterSpacing: size * 0.03, color: "rgba(255,255,255,0.78)" }}>{label}</div>
        <Digits text={rs(value)} at={at} px={size * 0.2} color={COLORS.yellow} />
        <LightSweep start={lock + 4} dur={20} opacity={0.35} />
      </div>
    </div>
  );
};

/** Meal line, 40% larger than v1, two clean lines under the badge. */
const MealLine: React.FC<{ price: number; at: number }> = ({ price, at }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = ease(frame, at, 14);
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1452, display: "flex", flexDirection: "column", alignItems: "center", opacity: clamp01(p * 1.5), filter: `blur(${(1 - p) * 10}px)`, transform: `translateY(${(1 - p) * 30}px)`, textShadow: "0 2px 14px rgba(0,0,0,0.85)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, fontFamily: FONTS.price, whiteSpace: "nowrap" }}>
        <span style={{ fontWeight: 800, fontSize: 53, color: COLORS.flame, letterSpacing: 4 }}>MEAL</span>
        <span style={{ fontWeight: 800, fontSize: 62, color: COLORS.white }}>{rs(price)}</span>
      </div>
      <div style={{ fontFamily: FONTS.price, fontWeight: 600, fontSize: 40, letterSpacing: 3, color: "rgba(255,255,255,0.86)", whiteSpace: "nowrap" }}>WITH FRIES + SOFT DRINK</div>
    </div>
  );
};

// ================================================================ FOOD SCENES (v1 FoodScene, re-laid for the bigger badge)
const PHOTO = { shawarma: "shawarma", burgers: "burger", sandwiches: "sandwich", fries: "fries" } as const;
const FOOD_CY = 690; // food centre in the hero zone; the lower third stays free for the price

/** v1 ParallaxHero, scaled and lifted so the food sits in the hero zone (never in the price zone). */
const HeroUp: React.FC<{ item: keyof typeof layout; len: number; children?: React.ReactNode; scale?: number }> = ({ item, len, children, scale = 0.85 }) => {
  const L = layout[item];
  const ox = L.x + L.w / 2, oy = L.y + L.h / 2;
  const mask = "linear-gradient(to bottom, black 0px, black 960px, transparent 1040px)";
  return (
    <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask }}>
      <AbsoluteFill style={{ transform: `translate(${540 - ox}px, ${FOOD_CY - oy}px) scale(${scale})`, transformOrigin: `${ox}px ${oy}px` }}>
        <ParallaxHero item={item} from={0} dur={len} pushTo={1.06}>
          {children}
        </ParallaxHero>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const OutlineTitle: React.FC<{ text: string; y: number; frame: number }> = ({ text, y, frame }) => (
  <div style={{ position: "absolute", left: -200, right: -200, top: y - 230, textAlign: "center", fontFamily: FONTS.brand, fontSize: 400, lineHeight: 1, whiteSpace: "nowrap", color: "transparent", WebkitTextStroke: "2.5px rgba(241,90,41,0.55)", transform: `translateX(${lerp(40, -40, clamp01(frame / 120))}px)`, letterSpacing: 6 }}>
    {text.toUpperCase()}
  </div>
);

const SceneTitle: React.FC<{ text: string; frame: number }> = ({ text, frame }) => {
  const t = ease(frame, -WIPE + 4, 18);
  return (
    <>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 238, textAlign: "center", overflow: "hidden", padding: "10px 0" }}>
        <div style={{ fontFamily: FONTS.brand, fontSize: 118, lineHeight: 1, color: COLORS.white, letterSpacing: 3, opacity: clamp01(t * 1.4), filter: `blur(${(1 - t) * 10}px)`, transform: `translateY(${(1 - t) * 40}px)`, textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>{text.toUpperCase()}</div>
        <LightSweep start={WIPE + 9} dur={24} opacity={0.4} />
      </div>
      <div style={{ position: "absolute", left: 540 - 60 * t, width: 120 * t, top: 378, height: 4, background: COLORS.flame, boxShadow: "0 0 14px rgba(241,90,41,0.8)" }} />
    </>
  );
};

const Food: React.FC<{ cat: Category; sceneKey: "shawarma" | "burgers" | "sandwiches" }> = ({ cat, sceneKey }) => {
  const frame = useCurrentFrame() - WIPE;
  const sc = SC[sceneKey];
  const len = sc.to - sc.from;
  const item = PHOTO[sceneKey];
  const [fStart, fStep] = P.food.flavours;
  const step = Math.max(4, Math.round(((P.food.lock - 10) - fStart) / cat.items.length));
  const idx = Math.floor((frame - fStart) / step);
  const lockRel = P.priceLocks[sceneKey] - sc.from;
  const tickerOut = ease(frame, lockRel - 16, 6);
  const cur = idx >= 0 ? cat.items[Math.min(idx, cat.items.length - 1)] : null;
  const local = frame - (fStart + Math.min(idx, cat.items.length - 1) * step);
  const fp = ease(local, 0, 4);
  void fStep;
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <HeroUp item={item} len={len + WIPE}>
        <OutlineTitle text={cat.title} y={layout[item].y + layout[item].h / 2} frame={frame + WIPE} />
      </HeroUp>
      <RimGlow x={540} y={FOOD_CY - 80} w={1100} h={900} opacity={0.22} />
      <EmberParticles seed={`v16${sceneKey}`} opacity={0.75} area={[120, 260, 840, 900]} />
      <SceneTitle text={cat.title} frame={frame} />
      {cur && tickerOut < 1 && (
        <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1190, height: 90, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, opacity: (1 - tickerOut) * clamp01(fp * 1.5), filter: `blur(${(1 - fp) * 8}px)`, transform: `translateY(${(1 - fp) * 14}px)` }}>
          {cur.veg && <VegMark size={44} />}
          <span style={{ ...headline(72), WebkitTextStroke: "6px rgba(8,8,8,0.9)" }}>{cur.name.toUpperCase()}</span>
        </div>
      )}
      {tickerOut < 1 && frame >= fStart && (
        <div style={{ position: "absolute", top: 1300, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 12, opacity: 1 - tickerOut }}>
          {cat.items.map((_, i) => (
            <div key={i} style={{ width: 26, height: 5, borderRadius: 3, background: i <= idx ? COLORS.flame : "rgba(255,255,255,0.25)" }} />
          ))}
        </div>
      )}
      <Sequence from={WIPE} layout="none">
        <BigBadge label="FROM" value={fromPrice(cat)} lock={lockRel} />
        {cat.meal && <MealLine price={cat.meal.price} at={P.food.meal} />}
      </Sequence>
    </AbsoluteFill>
  );
};

// ================================================================ KEBABS
const Kebabs16: React.FC = () => {
  const frame = useCurrentFrame() - WIPE;
  const sc = SC.kebabs;
  const len = sc.to - sc.from;
  const cat = byId("kebabs");
  const picks = ["Hara bara", "Tikka", "Wings", "Tandoori joint"].map((n) => cat.items.find((i) => i.name === n)!);
  const t = ease(frame, -WIPE + 4, 16);
  const row = (name: string, price: string, at: number, veg?: boolean, yellow?: boolean) => {
    const p = ease(frame, at, 10);
    if (frame < at) return <div key={name} style={{ height: 84 }} />;
    return (
      <div key={name} style={{ height: 84, display: "flex", alignItems: "center", justifyContent: "center", gap: 20, opacity: clamp01(p * 1.5), filter: `blur(${(1 - p) * 8}px)`, transform: `translateY(${(1 - p) * 22}px)` }}>
        {veg && <VegMark size={42} />}
        <span style={{ ...headline(72) }}>{name.toUpperCase()}</span>
        <span style={{ fontFamily: FONTS.price, fontWeight: 800, fontSize: 60, color: yellow ? COLORS.yellow : COLORS.white, textShadow: "0 2px 14px rgba(0,0,0,0.85)" }}>{price}</span>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <ParallaxHero item="kebab" from={0} dur={len + WIPE} fadeEdges="both" pushTo={1.06} offsetY={-170} />
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(17,17,17,0.9) 0px, rgba(17,17,17,0.15) 430px, rgba(17,17,17,0.1) 720px, rgba(17,17,17,0.82) 1000px, rgba(17,17,17,0.96) 1180px)" }} />
      <EmberParticles seed="v16kebab" area={[100, 300, 880, 800]} />
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 250, textAlign: "center", overflow: "hidden", padding: "10px 0" }}>
        <div style={{ ...headline(150), opacity: clamp01(t * 1.4), filter: `blur(${(1 - t) * 10}px)`, transform: `translateY(${(1 - t) * 40}px)` }}>
          <span style={{ color: COLORS.yellow }}>12</span> KEBABS
        </div>
        <LightSweep start={WIPE + 8} dur={22} opacity={0.4} />
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1110, display: "flex", flexDirection: "column" }}>
        {picks.map((it, i) => row(it.name, rs(it.price), P.kebab.names[i] - WIPE + WIPE, it.veg))}
        {row(cat.addOns[0].name, `+${rs(cat.addOns[0].price)}`, P.kebab.rumali, false, true)}
      </div>
    </AbsoluteFill>
  );
};

// ================================================================ FRIES
const Fries16: React.FC = () => {
  const frame = useCurrentFrame() - WIPE;
  const sc = SC.fries;
  const len = sc.to - sc.from;
  const cat = byId("fries");
  const classic = cat.items[0];
  const mayo = cat.addOns[0];
  const mp = ease(frame, P.fries.mayo, 12);
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <HeroUp item="fries" len={len + WIPE} scale={0.82}>
        <OutlineTitle text="FRIES" y={layout.fries.y + layout.fries.h / 2} frame={frame + WIPE} />
      </HeroUp>
      <RimGlow x={540} y={FOOD_CY - 80} w={1100} h={900} opacity={0.22} />
      <EmberParticles seed="v16fries" opacity={0.75} area={[120, 260, 840, 900]} />
      <SceneTitle text="FRIES" frame={frame} />
      <Sequence from={WIPE} layout="none">
        <BigBadge label={classic.name.toUpperCase()} value={classic.price} lock={P.fries.classic} />
      </Sequence>
      {frame >= P.fries.mayo && (
        <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1462, textAlign: "center", whiteSpace: "nowrap", opacity: clamp01(mp * 1.5), filter: `blur(${(1 - mp) * 10}px)`, transform: `translateY(${(1 - mp) * 26}px)`, fontFamily: FONTS.price, fontWeight: 800, fontSize: 56, color: COLORS.white, textShadow: "0 2px 14px rgba(0,0,0,0.85)" }}>
          <span style={{ color: COLORS.flame }}>+ </span>SPECIAL MAYO {rs(mayo.price)}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ================================================================ captions, tags, loop
const CAPTION_Y = 1060;
const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const badgeOn = (["shawarma", "burgers", "sandwiches", "fries"] as const).some((k) => f >= P.priceLocks[k] - 26 && f < SC[k].to);
  const locked = badgeOn || Object.values(P.priceLocks).some((l) => f >= l - 10 && f <= l + 40);
  if (locked) return null;
  const c = P.captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  const words = c.text.split(" ").map((w, i) => ({ text: w, at: c.from + i * 2, color: c.key && w === c.key ? COLORS.yellow : undefined }));
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: CAPTION_Y - 40 }}>
      <KineticCaption words={words} dur={6} exitAt={c.to - 4} wordStyle={{ ...headline(72), whiteSpace: "nowrap" }} />
    </div>
  );
};

const LocationTag: React.FC = () => {
  const f = useCurrentFrame();
  const [a, b] = P.locationTag;
  if (f < a - WIPE || f >= b - WIPE) return null;
  const p = ease(f, a - WIPE, 14) * (1 - ease(f, b - WIPE - 8, 8));
  return (
    <div style={{ position: "absolute", left: SAFE.left, top: 170, opacity: p, transform: `translateX(${(1 - p) * -30}px)`, display: "flex", alignItems: "center", gap: 12, padding: "8px 20px", borderRadius: 30, background: "rgba(10,10,10,0.6)", border: "1px solid rgba(241,90,41,0.55)" }}>
      <span style={{ width: 12, height: 12, borderRadius: 6, background: COLORS.flame, boxShadow: "0 0 10px rgba(241,90,41,0.9)" }} />
      <span style={{ fontFamily: FONTS.brand, fontSize: 40, color: COLORS.white, letterSpacing: 1, whiteSpace: "nowrap" }}>
        NEAR TCS, <span style={{ color: COLORS.yellow }}>ADIBATLA</span>
      </span>
    </div>
  );
};

/** Location line under the logo in the outro. */
const OutroLocation: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1480 }}>
      <KineticCaption words={[{ text: "NEAR", at }, { text: "TCS,", at: at + 2 }, { text: "ADIBATLA", at: at + 4, color: COLORS.yellow }]} wordStyle={{ ...headline(72), whiteSpace: "nowrap" }} />
    </div>
  );
};

const WipeIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const content = <HexWipe progress={f / WIPE}>{children}</HexWipe>;
  if (f >= WIPE) return content;
  return (
    <CameraMotionBlur shutterAngle={180} samples={8}>
      <WipeFrame>{children}</WipeFrame>
    </CameraMotionBlur>
  );
};
const WipeFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  return <HexWipe progress={f / WIPE}>{children}</HexWipe>;
};

/** Hard cut on the beat for scenes written in the v1 "frame - WIPE" convention. */
const HardCut: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Sequence from={-WIPE} layout="none">
    {children}
  </Sequence>
);

/** Last 6 frames: the outro dissolves into frame 0 (the graded clip + the hook title at frame 0). */
const LoopDissolve: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: (f + 1) / 6 }}>
      <HookScene f={0} />
    </AbsoluteFill>
  );
};

// ================================================================ assembly
export const ReelV16: React.FC = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    loadBrandFonts().then(() => continueRender(handle));
  }, [handle]);
  const seq = (k: keyof typeof SC) => ({ from: SC[k].from - WIPE, durationInFrames: SC[k].to - SC[k].from + WIPE });
  const cheatWords = (v1vo.lines.find((l) => l.id === 7)!.words) as { word: string; start: number; end: number }[];
  const cheat = asScene("cheat", SC.finally.from, SC.finally.to, P.vo.L8.at, cheatWords, P.vo.L8.duration);
  const l9 = vo16.lines.L9.words;
  const pick = (n: string) => l9.find((w) => w.word === n)!;
  const logoWords = [pick("Hungrillz"), pick("Crave"), pick("Grill"), pick("Repeat")];
  const outro = asScene("logo", SC.outro.from, SC.outro.to, P.vo.L9.at, logoWords, P.vo.L9.duration, 14);
  const nearAt = Math.round((P.vo.L9.at + pick("Near").start) * 30) - SC.outro.from + WIPE;
  const total = P.frames;
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <Sequence from={0} durationInFrames={SC.hook.to} name="hook">
        <HookLayer />
      </Sequence>
      <Sequence from={SC.location.from} durationInFrames={SC.location.to - SC.location.from} name="location">
        <Location />
      </Sequence>
      <Sequence {...seq("shawarma")} name="shawarma">
        <WipeIn>
          <Food cat={byId("shawarma")} sceneKey="shawarma" />
        </WipeIn>
      </Sequence>
      <Sequence {...seq("burgers")} name="burgers">
        <WipeIn>
          <Food cat={byId("burgers")} sceneKey="burgers" />
        </WipeIn>
      </Sequence>
      <Sequence {...seq("sandwiches")} name="sandwiches">
        <WipeIn>
          <Food cat={byId("sandwiches")} sceneKey="sandwiches" />
        </WipeIn>
      </Sequence>
      <Sequence {...seq("kebabs")} name="kebabs">
        <WipeIn>
          <Kebabs16 />
        </WipeIn>
      </Sequence>
      <Sequence from={SC.fries.from} durationInFrames={SC.fries.to - SC.fries.from} name="fries">
        <HardCut>
          <Fries16 />
        </HardCut>
      </Sequence>
      <Sequence from={SC.finally.from} durationInFrames={SC.finally.to - SC.finally.from} name="finally">
        <HardCut>
          <Cheat s={cheat} />
        </HardCut>
      </Sequence>
      <Sequence from={SC.outro.from} durationInFrames={total - SC.outro.from} name="outro">
        <HardCut>
          <LogoEnd s={outro} total={total} />
          <OutroLocation at={nearAt} />
        </HardCut>
      </Sequence>
      <Sequence from={total - 6} durationInFrames={6} name="loop dissolve">
        <LoopDissolve />
      </Sequence>
      <LocationTag />
      <Captions />
      <Vignette strength={0.5} />
      <GrainOverlay opacity={0.05} />
      <Audio src={staticFile("audio/v16/mix.wav")} />
    </AbsoluteFill>
  );
};

export const CoverV16: React.FC = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    loadBrandFonts().then(() => continueRender(handle));
  }, [handle]);
  return (
    <AbsoluteFill>
      <HookScene f={HOOK.cut + 8} />
      <Vignette strength={0.45} />
    </AbsoluteFill>
  );
};
