import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "../brand";
import { Category } from "../data";
import { EmberParticles, LightSweep, ParallaxHero, PriceRow, VoCaption, clamp01, ease } from "../components";
import { Scene, WIPE, f } from "../timeline";
import { rs } from "./FoodScene";

/** Row k appears at kebabRowAt(k); two columns stack in every 0.3 s. */
export const kebabRowAt = (k: number) => f(0.35) + k * f(0.3);

export const Kebabs: React.FC<{ s: Scene; cat: Category }> = ({ s, cat }) => {
  const seq = useCurrentFrame();
  const frame = seq - WIPE;
  const rows = Math.ceil(cat.items.length / 2);
  const left = cat.items.slice(0, rows);
  const right = cat.items.slice(rows);
  const titleP = ease(frame, -WIPE + 4, 16);
  const rumaliAt = kebabRowAt(rows) + f(0.25);
  const addOn = cat.addOns[0];
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      {/* full-bleed slow push, charcoal fade top and bottom */}
      <ParallaxHero item="kebab" from={0} dur={s.length + WIPE} fadeEdges="both" pushTo={1.08} />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(17,17,17,0.92) 0px, rgba(17,17,17,0.15) 420px, rgba(17,17,17,0) 700px, rgba(17,17,17,0.55) 900px, rgba(17,17,17,0.93) 1080px, rgba(17,17,17,0.97) 1920px)",
        }}
      />
      <EmberParticles count={40} opacity={0.8} seed="kebab" area={[100, 200, 880, 900]} />

      <div style={{ position: "absolute", left: 150, right: 150, top: 190, textAlign: "center", overflow: "hidden", padding: "10px 0" }}>
        <div
          style={{
            fontFamily: FONTS.brand,
            fontSize: 124,
            lineHeight: 1,
            color: COLORS.white,
            letterSpacing: 3,
            opacity: clamp01(titleP * 1.4),
            filter: `blur(${(1 - titleP) * 10}px)`,
            transform: `translateY(${(1 - titleP) * 40}px)`,
          }}
        >
          KEBABS
        </div>
        <LightSweep start={WIPE + f(0.25)} dur={22} opacity={0.4} />
      </div>
      <div style={{ position: "absolute", left: 540 - 60 * titleP, width: 120 * titleP, top: 335, height: 4, background: COLORS.flame, boxShadow: "0 0 14px rgba(241,90,41,0.8)" }} />

      {/* two columns stacking in */}
      <div style={{ position: "absolute", left: 140, top: 990, width: 800, display: "flex", justifyContent: "space-between" }}>
        {[left, right].map((col, c) => (
          <div key={c} style={{ display: "flex", flexDirection: "column" }}>
            {col.map((it, k) => (
              <PriceRow key={it.name} name={it.name} price={rs(it.price)} veg={it.veg} at={WIPE + kebabRowAt(k) + c * 2} width={388} size={26} />
            ))}
          </div>
        ))}
      </div>
      {/* Rumali roti: the last price to land */}
      {addOn && (
        <div style={{ position: "absolute", left: 340, top: 990 + rows * 39 + 30 }}>
          <PriceRow name={addOn.name} price={`+${rs(addOn.price)}`} at={WIPE + rumaliAt} width={400} size={32} priceColor={COLORS.yellow} />
        </div>
      )}
      <VoCaption words={s.vo.words} voStart={WIPE + s.voAt} until={WIPE + s.voAt + f(s.vo.duration) + f(0.5)} />
    </AbsoluteFill>
  );
};
