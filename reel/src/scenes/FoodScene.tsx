import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "../brand";
import { Category, fromPrice } from "../data";
import { EmberParticles, HexBadge, LightSweep, ParallaxHero, RimGlow, VegMark, VoCaption, clamp01, ease, lerp } from "../components";
import { Scene, WIPE, f } from "../timeline";
import layout from "../food-layout.json";

export const rs = (n: number) => `Rs.${n}`;

/** Per-scene beats, in frames from scene start (the scene is visible WIPE frames earlier, mid-motion). */
export const foodBeats = (s: Scene, count: number) => {
  const flavourStart = f(0.45);
  const step = Math.max(7, Math.min(10, Math.floor((f(2.3)) / count)));
  const flavourEnd = flavourStart + step * count;
  const badge = flavourEnd + f(0.15);
  const meal = Math.min(badge + f(0.85), s.length - f(0.75));
  return { flavourStart, step, flavourEnd, badge, meal };
};

const PHOTO: Record<string, keyof typeof layout> = { shawarma: "shawarma", burgers: "burger", sandwiches: "sandwich" };

/** Giant outlined category title that sits between the hero plate and the cutout. */
const OutlineTitle: React.FC<{ text: string; y: number; frame: number }> = ({ text, y, frame }) => (
  <div
    style={{
      position: "absolute",
      left: -200,
      right: -200,
      top: y - 230,
      textAlign: "center",
      fontFamily: FONTS.brand,
      fontSize: 400,
      lineHeight: 1,
      whiteSpace: "nowrap",
      color: "transparent",
      WebkitTextStroke: `2.5px rgba(241,90,41,0.55)`,
      transform: `translateX(${lerp(40, -40, clamp01(frame / 150))}px)`,
      opacity: ease(frame, -WIPE, 18),
      letterSpacing: 6,
    }}
  >
    {text.toUpperCase()}
  </div>
);

export const FoodScene: React.FC<{ s: Scene; cat: Category }> = ({ s, cat }) => {
  const frame = useCurrentFrame() - WIPE; // 0 = scene start; negative during the incoming wipe
  const item = PHOTO[cat.id];
  const L = layout[item];
  const offsetY = -110;
  const b = foodBeats(s, cat.items.length);
  const foodCy = L.y + L.h / 2 + offsetY;

  // flavour ticker: one flavour at a time, flicking in
  const idx = Math.floor((frame - b.flavourStart) / b.step);
  const tickerOut = ease(frame, b.flavourEnd + 2, 8);
  const current = idx >= 0 && idx < cat.items.length ? cat.items[idx] : idx >= cat.items.length ? cat.items[cat.items.length - 1] : null;
  const local = frame - (b.flavourStart + Math.min(idx, cat.items.length - 1) * b.step);
  const fp = ease(local, 0, 6);

  const titleP = ease(frame, -WIPE + 4, 18);
  const mealP = ease(frame, b.meal, 14);

  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <ParallaxHero item={item} from={0} dur={s.length + WIPE} offsetY={offsetY}>
        <OutlineTitle text={cat.title} y={L.y + L.h / 2} frame={frame + WIPE} />
      </ParallaxHero>
      <RimGlow x={540} y={foodCy - L.h * 0.15} w={L.w * 1.3} h={L.h * 1.1} opacity={0.22} />
      <EmberParticles count={40} opacity={0.75} seed={cat.id} area={[120, 300, 840, 1300]} />

      {/* top title */}
      <div
        style={{
          position: "absolute",
          left: 150,
          right: 150,
          top: 190,
          textAlign: "center",
          overflow: "hidden",
          padding: "10px 0",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.brand,
            fontSize: 118,
            lineHeight: 1,
            color: COLORS.white,
            letterSpacing: 3,
            opacity: clamp01(titleP * 1.4),
            filter: `blur(${(1 - titleP) * 10}px)`,
            transform: `translateY(${(1 - titleP) * 40}px)`,
            textShadow: "0 4px 24px rgba(0,0,0,0.6)",
          }}
        >
          {cat.title.toUpperCase()}
        </div>
        <LightSweep start={WIPE + f(0.3)} dur={24} opacity={0.4} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 540 - 60 * titleP,
          width: 120 * titleP,
          top: 330,
          height: 4,
          background: COLORS.flame,
          boxShadow: "0 0 14px rgba(241,90,41,0.8)",
        }}
      />

      {/* flavour ticker */}
      {current && tickerOut < 1 && (
        <div
          style={{
            position: "absolute",
            left: 150,
            right: 150,
            top: 1290,
            height: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            opacity: (1 - tickerOut) * clamp01(fp * 1.5),
            filter: `blur(${(1 - fp) * 9}px)`,
            transform: `translateY(${(1 - fp) * 16 - tickerOut * 20}px)`,
          }}
        >
          {current.veg && <VegMark size={34} />}
          <span style={{ fontFamily: FONTS.price, fontWeight: 700, fontSize: 54, color: COLORS.white, letterSpacing: 3, textTransform: "uppercase", textShadow: "0 2px 14px rgba(0,0,0,0.8)" }}>
            {current.name}
          </span>
          <span style={{ fontFamily: FONTS.price, fontWeight: 500, fontSize: 40, color: "rgba(255,255,255,0.7)" }}>{rs(current.price)}</span>
        </div>
      )}
      {/* flavour counter dots */}
      {tickerOut < 1 && frame >= b.flavourStart && (
        <div style={{ position: "absolute", top: 1390, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 12, opacity: 1 - tickerOut }}>
          {cat.items.map((_, i) => (
            <div key={i} style={{ width: 22, height: 4, borderRadius: 2, background: i <= idx ? COLORS.flame : "rgba(255,255,255,0.25)" }} />
          ))}
        </div>
      )}

      <HexBadge x={790} y={520} at={b.badge + WIPE} label="FROM" price={rs(fromPrice(cat))} />

      {/* meal line: lands last */}
      {cat.meal && frame >= b.meal && (
        <div
          style={{
            position: "absolute",
            left: 150,
            right: 150,
            top: 1285,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            opacity: clamp01(mealP * 1.5),
            filter: `blur(${(1 - mealP) * 10}px)`,
            transform: `translateY(${(1 - mealP) * 30}px)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, fontFamily: FONTS.price, whiteSpace: "nowrap", textShadow: "0 2px 14px rgba(0,0,0,0.8)" }}>
            <span style={{ fontWeight: 800, fontSize: 38, color: COLORS.flame, letterSpacing: 3 }}>MEAL</span>
            <span style={{ fontWeight: 800, fontSize: 44, color: COLORS.white }}>{rs(cat.meal.price)}</span>
            <span style={{ fontWeight: 600, fontSize: 30, letterSpacing: 2, color: "rgba(255,255,255,0.82)" }}>- WITH FRIES + SOFT DRINK</span>
          </div>
          <div style={{ width: lerp(0, 520, mealP), height: 2, background: "linear-gradient(90deg, rgba(241,90,41,0), #F15A29, rgba(241,90,41,0))", marginTop: 6 }} />
        </div>
      )}

      <VoCaption words={s.vo.words} voStart={WIPE + s.voAt} until={WIPE + s.voAt + f(s.vo.duration) + f(0.5)} />
    </AbsoluteFill>
  );
};

