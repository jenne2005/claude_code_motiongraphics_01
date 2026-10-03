import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Img, Sequence, continueRender, delayRender, random, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS, loadBrandFonts } from "../brand";
import { HEX_PATH, HEX_VIEWBOX } from "../hexagon-path";
import { byId, fromPrice } from "../data";
import { EmberParticles, GrainOverlay, HexWipe, ParallaxHero, RimGlow, VegMark, Vignette, clamp01, ease, hexPolygon, lerp } from "../components";
import captions from "./captions.json";
import vo2 from "../../public/audio/vo2/vo2-lines.json";
import plan from "./plan.json";
import { CUT, Captions, F, LocationTag, LogoMark, OutlineWord, Pin, Price, SAFE, Slam, TOTAL, Whip, food, strokeText } from "./parts";

export type Variant = "A" | "B";
const OVERLAP = 10; // frames each section keeps playing under the next one's entrance
const veg = (name: string) => byId("kebabs").items.find((i) => i.name.toLowerCase() === name.toLowerCase())?.veg;

// ================================================================ HOOK (0 - 3.6 s)
/** hf = hook frame; negative values are the last frames of the reel (the loop lead-in). */
const Hook: React.FC<{ hf: number; variant: Variant }> = ({ hf, variant }) => {
  const stamp = CUT.stamp;
  const sharp = hf >= stamp;
  const rack = clamp01(hf / stamp);
  const blur = sharp ? 0 : lerp(15, 9, rack);
  const push = sharp ? lerp(1.42, 1.46, clamp01((hf - stamp) / 50)) : lerp(1.6, 1.66, rack);
  const shake = hf >= stamp && hf < stamp + 4 ? { x: (random(`sx${hf}`) - 0.5) * 30, y: (random(`sy${hf}`) - 0.5) * 30 } : { x: 0, y: 0 };
  const flash = sharp ? Math.max(0, 1 - (hf - stamp) / 6) : 0;
  const textOut = ease(hf, stamp - 2, 6);
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal, transform: `translate(${shake.x}px, ${shake.y}px)` }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "540px 880px", filter: blur ? `blur(${blur}px)` : undefined }}>
        <Img src={food("burger-hero.png")} style={{ width: 1080, height: 1920 }} />
        <Img src={food("burger-cutout.png")} style={{ position: "absolute", left: 90, top: 510, width: 900, height: 840 }} />
      </AbsoluteFill>
      {/* darken for type, warm it for appetite */}
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(10,10,10,0.78) 0%, rgba(10,10,10,0.35) 45%, rgba(10,10,10,0.15) 70%, rgba(10,10,10,0.55) 100%)" }} />
      <RimGlow x={540} y={1000} w={1100} h={1000} opacity={0.25} />
      {/* the opening ember (also the loop point) */}
      <HookEmber hf={hf} />
      {variant === "A" ? <Clock hf={hf} out={textOut} /> : <TalkText hf={hf} out={textOut} />}
      {sharp && <Stamp f={hf - stamp} />}
      {flash > 0 && <AbsoluteFill style={{ background: "#FFF4E6", opacity: flash * 0.55, mixBlendMode: "screen" }} />}
    </AbsoluteFill>
  );
};

const HookEmber: React.FC<{ hf: number }> = ({ hf }) => {
  const t = hf / 30;
  const x = 760 + Math.sin(t * 1.3) * 18;
  const y = 1260 - t * 22;
  const k = 0.8 + 0.2 * Math.sin(t * 19) * Math.sin(t * 6.1 + 1);
  return (
    <>
      <div style={{ position: "absolute", left: x - 140, top: y - 140, width: 280, height: 280, opacity: 0.5 * k, background: "radial-gradient(closest-side, rgba(241,90,41,0.6), rgba(241,90,41,0) 100%)" }} />
      <div style={{ position: "absolute", left: x - 8, top: y - 8, width: 16, height: 16, borderRadius: 8, opacity: k, background: "radial-gradient(circle, #FFFBE0 0%, #FFF200 35%, #F15A29 80%)", boxShadow: "0 0 20px 6px rgba(241,90,41,0.85)" }} />
    </>
  );
};

const Clock: React.FC<{ hf: number; out: number }> = ({ hf, out }) => {
  const steps = [
    { at: -999, t: "9:58" },
    { at: 18, t: "9:59" },
    { at: 38, t: "10:00" },
  ];
  const cur = [...steps].filter((s) => hf >= s.at).pop()!;
  const since = hf - cur.at;
  const slide = cur.at > 0 ? ease(since, 0, 5) : 1;
  const glitch = (cur.at > 0 && since < 6) || (hf >= 50 && hf < 54);
  const gx = glitch ? (random(`g${hf}`) - 0.5) * 26 : 0;
  const base: React.CSSProperties = { fontFamily: FONTS.price, fontWeight: 900, fontSize: 250, lineHeight: 1, letterSpacing: -8, whiteSpace: "nowrap" };
  const word = (
    <span style={{ display: "inline-flex", alignItems: "flex-start" }}>
      {cur.t}
      <span style={{ fontSize: 92, marginLeft: 16, marginTop: 26, letterSpacing: 0 }}>PM</span>
    </span>
  );
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 330, textAlign: "center", opacity: 1 - out, transform: `translateY(${-out * 60}px)` }}>
      <div style={{ position: "relative", height: 260, transform: `translateY(${(1 - slide) * -40}px)` }}>
        {glitch && <div style={{ ...base, position: "absolute", inset: 0, color: COLORS.flame, opacity: 0.85, transform: `translateX(${gx}px)`, clipPath: `inset(${30 + random(`c${hf}`) * 40}% 0 ${10 + random(`d${hf}`) * 30}% 0)` }}>{word}</div>}
        {glitch && <div style={{ ...base, position: "absolute", inset: 0, color: COLORS.yellow, opacity: 0.7, transform: `translateX(${-gx}px)`, clipPath: `inset(0 0 ${55 + random(`e${hf}`) * 30}% 0)` }}>{word}</div>}
        <div style={{ ...base, position: "absolute", inset: 0, color: COLORS.white, textShadow: "0 0 40px rgba(241,90,41,0.45), 0 8px 30px rgba(0,0,0,0.6)", opacity: lerp(0.3, 1, slide) }}>{word}</div>
      </div>
      <div style={{ ...strokeText(112), marginTop: 70 }}>STILL AT WORK?</div>
    </div>
  );
};

const TalkText: React.FC<{ hf: number; out: number }> = ({ out }) => (
  <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 330, textAlign: "center", opacity: 1 - out, transform: `translateY(${-out * 60}px)`, display: "flex", flexDirection: "column", gap: 26 }}>
    <div style={strokeText(150, COLORS.yellow)}>ADIBATLA,</div>
    <div style={strokeText(150)}>WE NEED</div>
    <div style={strokeText(150)}>TO TALK.</div>
  </div>
);

const Stamp: React.FC<{ f: number }> = ({ f }) => {
  const p = ease(f, 0, 5);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 360, display: "flex", justifyContent: "center" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id="ink">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="7" />
        </filter>
      </svg>
      <div
        style={{
          transform: `rotate(-6deg) scale(${lerp(2.1, 1, p)})`,
          opacity: clamp01(f / 2),
          filter: "url(#ink)",
          border: `10px solid ${COLORS.flame}`,
          outline: `3px solid ${COLORS.flame}`,
          outlineOffset: 8,
          borderRadius: 14,
          padding: "26px 46px 30px",
          background: "rgba(12,12,12,0.74)",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontFamily: FONTS.brand, fontSize: 82, lineHeight: 1, color: COLORS.flame, letterSpacing: 4 }}>COMPLAINT FILED:</div>
        <div style={{ fontFamily: FONTS.brand, fontSize: 176, lineHeight: 1, color: COLORS.flame, letterSpacing: 6, marginTop: 8 }}>HUNGER.</div>
      </div>
    </div>
  );
};

// ================================================================ LOGO + LOCATION (3.6 - 6.1 s)
const LogoLocation: React.FC = () => {
  const f = useCurrentFrame();
  const flame = ease(f, 0, 12);
  const logo = ease(f, 10, 14); // logo locked by frame 24 (0.8 s)
  const pinP = ease(f, 26, 8);
  const ripple = (k: number) => clamp01((f - 34 - k * 6) / 22);
  return (
    <AbsoluteFill style={{ background: COLORS.logoBlack }}>
      <RimGlow x={540} y={640} w={1200} h={1100} opacity={0.45 * flame} />
      <EmberParticles seed="v2logo" opacity={flame} area={[150, 250, 780, 900]} />
      <LogoMark cx={540} cy={560} width={640} p={logo} flame={flame} glow={logo} />
      {/* map pin drop with ripple */}
      {f >= 26 && (
        <>
          {[0, 1, 2].map((k) => (
            <div key={k} style={{ position: "absolute", left: 540 - 140 * ripple(k), top: 1030 - 34 * ripple(k), width: 280 * ripple(k), height: 68 * ripple(k), borderRadius: "50%", border: `3px solid ${COLORS.flame}`, opacity: (1 - ripple(k)) * 0.9 }} />
          ))}
          <div style={{ position: "absolute", left: 540 - 36, top: lerp(760, 940, pinP), opacity: clamp01(pinP * 3) }}>
            <Pin size={72} />
          </div>
        </>
      )}
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1080, textAlign: "center" }}>
        <SlamText at={30} text="NEAR TCS," px={104} />
        <SlamText at={36} text="ADIBATLA" px={136} color={COLORS.yellow} />
      </div>
    </AbsoluteFill>
  );
};

const SlamText: React.FC<{ at: number; text: string; px: number; color?: string; until?: number; style?: React.CSSProperties }> = ({ at, text, px, color, until, style }) => {
  const f = useCurrentFrame();
  if (f < at) return <div style={{ height: px * 1.08 }} />;
  const p = ease(f, at, 7);
  const out = until !== undefined ? ease(f, until, 5) : 0;
  return (
    <div style={{ ...strokeText(px, color), height: px * 1.08, opacity: clamp01(p * 2) * (1 - out), transform: `scale(${lerp(1.35, 1, p) * lerp(1, 0.9, out)}) translateY(${-out * 30}px)`, filter: `blur(${(1 - p) * 8}px)`, ...style }}>
      {text}
    </div>
  );
};

// ================================================================ MONTAGE
const lowerShade = "linear-gradient(to bottom, rgba(17,17,17,0) 52%, rgba(17,17,17,0.82) 72%, rgba(17,17,17,0.92) 100%)";

const FoodShot: React.FC<{
  item: "shawarma" | "burger" | "sandwich" | "fries";
  word: string;
  len: number;
  price?: { value: number; label: string; lockAbs: number; start: number };
  children?: React.ReactNode;
}> = ({ item, word, len, price, children }) => {
  const offsetY = -250;
  const L = { shawarma: [662, 536], burger: [510, 840], sandwich: [617, 645], fries: [481, 877] }[item];
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <Slam>
        <ParallaxHero item={item} from={0} dur={len + OVERLAP} offsetY={offsetY} pushTo={1.06}>
          <OutlineWord text={word} y={L[0] + L[1] / 2} />
        </ParallaxHero>
      </Slam>
      <AbsoluteFill style={{ background: lowerShade }} />
      <EmberParticles seed={`v2${item}`} opacity={0.9} area={[120, 200, 840, 1100]} />
      {price && <Price value={price.value} label={price.label} at={price.lockAbs - price.start} y={1150} />}
      {children}
    </AbsoluteFill>
  );
};

const KebabShot: React.FC<{ len: number }> = ({ len }) => {
  const f = useCurrentFrame();
  const names = ["HARA BARA", "TIKKA", "WINGS", "TANDOORI JOINT"];
  const at = [14, 26, 38, 50];
  const cur = [...at.keys()].filter((i) => f >= at[i]).pop();
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <Slam>
        <ParallaxHero item="kebab" from={0} dur={len + OVERLAP} fadeEdges="both" pushTo={1.07} offsetY={-60} />
      </Slam>
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(17,17,17,0.9) 0px, rgba(17,17,17,0.2) 560px, rgba(17,17,17,0.15) 820px, rgba(17,17,17,0.85) 1080px, rgba(17,17,17,0.95) 1920px)" }} />
      <EmberParticles seed="v2kebab" area={[120, 300, 840, 900]} />
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 230, textAlign: "center" }}>
        <SlamText at={2} text="12 KEBABS" px={150} />
        <div style={{ fontFamily: FONTS.price, fontWeight: 800, fontSize: 60, color: COLORS.white, opacity: ease(f, 8, 8), marginTop: 18, textShadow: "0 2px 14px rgba(0,0,0,0.8)" }}>
          FROM <span style={{ fontSize: 40, verticalAlign: "top" }}>Rs.</span>
          {fromPrice(byId("kebabs"))}
        </div>
      </div>
      {cur !== undefined && (
        <div key={cur} style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1080, display: "flex", justifyContent: "center", alignItems: "center", gap: 22 }}>
          {veg(names[cur]) && <VegMark size={56} />}
          <SlamText at={at[cur]} text={names[cur]} px={names[cur].length > 10 ? 104 : 124} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ================================================================ BUNDLE (15.8 - 19.2 s)
const MEALS = [
  { name: "SHAWARMA", id: "shawarma", photo: "shawarma" },
  { name: "BURGER", id: "burgers", photo: "burger" },
  { name: "SANDWICH", id: "sandwiches", photo: "sandwich" },
] as const;

const Bundle: React.FC = () => {
  const f = useCurrentFrame();
  const hit = CUT.bundleHit - CUT.bundle;
  const swell = clamp01((f - 30) / (hit - 30));
  const away = ease(f, hit, 7);
  const minMeal = Math.min(...MEALS.map((m) => byId(m.id).meal!.price));
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <RimGlow x={540} y={900} w={1200} h={1300} opacity={0.25 + swell * 0.35} />
      <EmberParticles seed="v2bundle" opacity={0.6 + swell * 0.4} />
      {away < 1 &&
        MEALS.map((m, i) => {
          const p = ease(f, 2 + i * 8, 10);
          const dir = i % 2 ? 1 : -1;
          const y = 430 + i * 330;
          const meal = byId(m.id).meal!;
          return (
            <div key={m.id} style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: y - 140, height: 280, opacity: clamp01(p * 2) * (1 - away), transform: `translateX(${dir * (1 - p) * 1000}px) scale(${(1 + swell * 0.04) * lerp(1, 1.25, away)})`, filter: away > 0 ? `blur(${away * 12}px)` : undefined }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: 280, height: 280 }}>
                <svg viewBox={HEX_VIEWBOX} width={280} height={280} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                  <path d={HEX_PATH} fill="rgba(8,8,8,0.85)" stroke={COLORS.flame} strokeWidth={1.6} />
                </svg>
                <div style={{ position: "absolute", inset: 0, clipPath: hexPolygon(140, 140, 266), display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Img src={food(`${m.photo}-cutout.png`)} style={{ width: 250, height: 250, objectFit: "contain" }} />
                </div>
              </div>
              <div style={{ position: "absolute", left: 320, top: 30 }}>
                <div style={{ ...strokeText(76), whiteSpace: "nowrap" }}>{m.name} MEAL</div>
                <div style={{ fontFamily: FONTS.price, fontWeight: 900, fontSize: 112, lineHeight: 1.05, color: COLORS.white, textShadow: "0 0 30px rgba(241,90,41,0.55)" }}>
                  <span style={{ fontSize: 46, verticalAlign: "top", marginRight: 6 }}>Rs.</span>
                  {meal.price}
                </div>
              </div>
            </div>
          );
        })}
      {f >= hit - 11 && (
        <>
          <Price value={minMeal} label="MEALS FROM" at={hit} y={930} px={260} />
          <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1150, textAlign: "center", opacity: ease(f, hit + 6, 8), transform: `translateY(${(1 - ease(f, hit + 6, 8)) * 24}px)` }}>
            <div style={strokeText(78)}>FRIES + SOFT DRINK</div>
            <div style={{ ...strokeText(78), marginTop: 6 }}>INCLUDED</div>
          </div>
        </>
      )}
      {f >= hit && f < hit + 7 && <AbsoluteFill style={{ background: "#FFE9D6", opacity: (1 - (f - hit) / 7) * 0.5, mixBlendMode: "screen" }} />}
    </AbsoluteFill>
  );
};

// ================================================================ CHEAT (19.2 - 21.7 s)
const Cheat: React.FC = () => {
  const L6 = vo2.lines.find((l) => l.key === "L6")!;
  const t0 = plan.vo.A.find((v) => v[0] === "L6")![1] as number;
  const parts = ["FINALLY,", "A CHEAT MEAL", "THAT ISN'T", "CHEATING."];
  const total = parts.reduce((s, p) => s + p.length, 0);
  let acc = 0;
  const at = parts.map((p) => {
    const t = t0 + (L6.duration * acc) / total;
    acc += p.length;
    return Math.max(0, F(t) - CUT.cheat);
  });
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <RimGlow x={540} y={980} w={1200} h={1200} opacity={0.32} />
      <EmberParticles seed="v2cheat" />
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 520, textAlign: "center", display: "flex", flexDirection: "column", gap: 28, transform: `scale(${lerp(1, 1.04, clamp01(f / 75))})` }}>
        <SlamText at={at[0]} text={parts[0]} px={122} />
        <SlamText at={at[1]} text={parts[1]} px={122} />
        <SlamText at={at[2]} text={parts[2]} px={122} />
        <SlamText at={at[3]} text={parts[3]} px={168} color={COLORS.yellow} style={{ textShadow: "0 0 30px rgba(255,242,0,0.45), 0 0 70px rgba(241,90,41,0.55)" }} />
      </div>
    </AbsoluteFill>
  );
};

// ================================================================ END CARD (21.7 - 22.8 s)
const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const logo = ease(f, 0, 8);
  return (
    <AbsoluteFill style={{ background: COLORS.logoBlack }}>
      <RimGlow x={540} y={600} w={1200} h={1000} opacity={0.45} />
      <EmberParticles seed="v2end" />
      <LogoMark cx={540} cy={520} width={620} p={logo} glow={logo} />
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 900, textAlign: "center" }}>
        <SlamText at={3} text="CRAVE. GRILL. REPEAT." px={80} />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 34, opacity: ease(f, 6, 6) }}>
          <Pin size={44} />
          <span style={{ ...strokeText(62) }}>
            NEAR TCS, <span style={{ color: COLORS.yellow }}>ADIBATLA</span>
          </span>
        </div>
        <div style={{ marginTop: 40, opacity: ease(f, 9, 6), transform: `translateY(${(1 - ease(f, 9, 6)) * 20}px)` }}>
          <div style={{ fontFamily: FONTS.price, fontWeight: 900, fontSize: 58, lineHeight: 1.15, color: COLORS.white, textShadow: "0 2px 14px rgba(0,0,0,0.8)" }}>
            SEND THIS TO YOUR
            <br />
            OFFICE BUDDY.
          </div>
          <div style={{ margin: "14px auto 0", width: 360 * ease(f, 12, 8), height: 6, background: COLORS.flame, borderRadius: 3 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ================================================================ assembly
const HexIn: React.FC<{ children: React.ReactNode; dur?: number }> = ({ children, dur = 10 }) => {
  const f = useCurrentFrame();
  return <HexWipe progress={f / dur}>{children}</HexWipe>;
};

const HookLayer: React.FC<{ variant: Variant }> = ({ variant }) => {
  const f = useCurrentFrame();
  return <Hook hf={f} variant={variant} />;
};
const LoopLayer: React.FC<{ variant: Variant }> = ({ variant }) => {
  const f = useCurrentFrame();
  return <Hook hf={f - (TOTAL - CUT.loop)} variant={variant} />;
};

export const ReelV2: React.FC<{ variant: Variant }> = ({ variant }) => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    loadBrandFonts().then(() => continueRender(handle));
  }, [handle]);
  const seq = (from: number, to: number) => ({ from, durationInFrames: to - from + OVERLAP });
  const P = plan.priceLocks.map(F);
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <Sequence {...seq(0, CUT.logo)} name="hook">
        <HookLayer variant={variant} />
      </Sequence>
      <Sequence {...seq(CUT.logo, CUT.shawarma)} name="logo+location">
        <HexIn>
          <LogoLocation />
        </HexIn>
      </Sequence>
      <Sequence {...seq(CUT.shawarma, CUT.burger)} name="shawarma">
        <HexIn>
          <FoodShot item="shawarma" word="SHAWARMA" len={CUT.burger - CUT.shawarma} price={{ value: fromPrice(byId("shawarma")), label: "FROM", lockAbs: P[0], start: CUT.shawarma }} />
        </HexIn>
      </Sequence>
      <Sequence {...seq(CUT.burger, CUT.sandwich)} name="burger">
        <Whip>
          <FoodShot item="burger" word="BURGERS" len={CUT.sandwich - CUT.burger} price={{ value: fromPrice(byId("burgers")), label: "FROM", lockAbs: P[1], start: CUT.burger }} />
        </Whip>
      </Sequence>
      <Sequence {...seq(CUT.sandwich, CUT.kebab)} name="sandwich">
        <HexIn>
          <FoodShot item="sandwich" word="SANDWICHES" len={CUT.kebab - CUT.sandwich} />
        </HexIn>
      </Sequence>
      <Sequence {...seq(CUT.kebab, CUT.fries)} name="kebab">
        <Whip dir={-1}>
          <KebabShot len={CUT.fries - CUT.kebab} />
        </Whip>
      </Sequence>
      <Sequence {...seq(CUT.fries, CUT.bundle)} name="fries">
        <HexIn>
          <FoodShot item="fries" word="FRIES" len={CUT.bundle - CUT.fries} price={{ value: byId("fries").items[0].price, label: "CLASSIC", lockAbs: P[2], start: CUT.fries }}>
            <FriesMayo at={P[2] - CUT.fries + 12} />
          </FoodShot>
        </HexIn>
      </Sequence>
      <Sequence {...seq(CUT.bundle, CUT.cheat)} name="bundle">
        <Whip>
          <Bundle />
        </Whip>
      </Sequence>
      <Sequence {...seq(CUT.cheat, CUT.end)} name="cheat">
        <HexIn>
          <Cheat />
        </HexIn>
      </Sequence>
      <Sequence from={CUT.end} durationInFrames={CUT.loop - CUT.end} name="end card">
        <HexIn dur={6}>
          <EndCard />
        </HexIn>
      </Sequence>
      <Sequence from={CUT.loop} durationInFrames={TOTAL - CUT.loop} name="loop lead-in">
        <LoopLayer variant={variant} />
      </Sequence>

      <Sequence from={CUT.shawarma} durationInFrames={CUT.cheat - CUT.shawarma} name="location tag">
        <LocationTag from={0} to={CUT.cheat - CUT.shawarma - 1} />
      </Sequence>
      <Captions chunks={(captions as Record<Variant, any[]>)[variant]} hide={(c) => (c.line === "L3" && !c.text.startsWith("A GRILL")) || (c.line === "L5" && c.start >= plan.cuts.bundleHit - 0.1)} />

      <Vignette strength={0.5} />
      <GrainOverlay opacity={0.05} />
      <Audio src={staticFile(`audio/v2/mix-${variant}.wav`)} />
    </AbsoluteFill>
  );
};

const FriesMayo: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const p = ease(f, at, 7);
  if (f < at) return null;
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1395, textAlign: "center", opacity: clamp01(p * 2), transform: `scale(${lerp(1.2, 1, p)})`, fontFamily: FONTS.price, fontWeight: 800, fontSize: 60, color: COLORS.white, textShadow: "0 2px 14px rgba(0,0,0,0.85)", whiteSpace: "nowrap" }}>
      SPECIAL MAYO <span style={{ color: COLORS.flame }}>+</span>
      <span style={{ fontSize: 40, verticalAlign: "top" }}>Rs.</span>
      {byId("fries").addOns[0].price}
    </div>
  );
};

export const V2_TOTAL = TOTAL;
