import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "../brand";
import { EmberParticles, KineticCaption, clamp01, ease, lerp } from "../components";
import { FLAME } from "../logo-flame";
import { FPS, Scene, f } from "../timeline";

/** The single ember the reel opens and closes on (same position, same look, so it loops). */
export const EMBER = { x: 540, y: 1215 };

export const Ember: React.FC<{ intensity?: number; sparkAt?: number; tFrame?: number }> = ({ intensity = 1, sparkAt, tFrame }) => {
  const frame = useCurrentFrame();
  // flicker clock: the outro passes frames counted back from the reel's end so the loop is seamless
  const t = (tFrame ?? frame) / FPS;
  const flick = 0.82 + 0.18 * Math.sin(t * 23) * Math.sin(t * 7.3 + 1);
  const k = intensity * flick;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: EMBER.x - 260,
          top: EMBER.y - 260,
          width: 520,
          height: 520,
          opacity: 0.55 * k,
          background: "radial-gradient(closest-side, rgba(241,90,41,0.55), rgba(241,90,41,0.12) 45%, rgba(0,0,0,0))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: EMBER.x - 7,
          top: EMBER.y - 7,
          width: 14,
          height: 14,
          borderRadius: "50%",
          opacity: Math.min(1, k * 1.1),
          background: "radial-gradient(circle, #FFFBE0 0%, #FFF200 35%, #F15A29 75%)",
          boxShadow: "0 0 18px 6px rgba(241,90,41,0.85), 0 0 50px 16px rgba(241,90,41,0.35)",
        }}
      />
      {sparkAt !== undefined &&
        Array.from({ length: 12 }).map((_, i) => {
          const age = (frame - sparkAt) / 16;
          if (age < 0 || age > 1) return null;
          const a = -Math.PI / 2 + (random(`sp${i}`) - 0.5) * 2.2;
          const v = 90 + random(`sv${i}`) * 170;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: EMBER.x + Math.cos(a) * v * age,
                top: EMBER.y + Math.sin(a) * v * age + 80 * age * age,
                width: 4,
                height: 4,
                borderRadius: 2,
                background: i % 2 ? COLORS.yellow : COLORS.flame,
                opacity: 1 - age,
                boxShadow: `0 0 8px 2px ${COLORS.flame}`,
              }}
            />
          );
        })}
    </>
  );
};

/** The logo flame, growing from its base. */
export const LogoFlame: React.FC<{ x: number; baseY: number; height: number; grow: number; alive?: boolean }> = ({ x, baseY, height, grow, alive = true }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const b = FLAME.body.bbox;
  const s = height / (b[3] - b[1]);
  const bx = (b[0] + b[2]) / 2;
  const flick = alive ? Math.sin(t * 5.1) * 0.018 + Math.sin(t * 11.7) * 0.012 : 0;
  const sway = alive ? Math.sin(t * 2.3) * 1.6 : 0;
  return (
    <svg
      width={1080}
      height={1920}
      style={{ position: "absolute", inset: 0, overflow: "visible", filter: `drop-shadow(0 0 ${40 * grow}px rgba(241,90,41,0.65))` }}
    >
      <g transform={`translate(${x} ${baseY}) skewX(${sway}) scale(${s * lerp(0.55, 1, grow)} ${s * grow * (1 + flick)}) translate(${-bx} ${-b[3]})`}>
        <path d={FLAME.body.d} fill={COLORS.flame} />
        {FLAME.licks.map((l, i) => {
          const lp = clamp01(grow * 1.6 - 0.25 - i * 0.12);
          const lb = l.bbox;
          const lx = (lb[0] + lb[2]) / 2;
          return (
            <g key={i} transform={`translate(${lx} ${lb[3]}) scale(${lp}) translate(${-lx} ${-lb[3]})`}>
              <path d={l.d} fill={COLORS.yellow} />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export const Hook: React.FC<{ s: Scene }> = ({ s }) => {
  const frame = useCurrentFrame(); // relative to scene start
  const w = s.vo.words;
  const at = (i: number) => s.voAt + f(w[i].start);
  const igniteAt = at(4); // "on"
  const grow = ease(frame, igniteAt, 20);
  const text = { fontFamily: FONTS.brand, fontSize: 132, lineHeight: 1.02, color: COLORS.white, letterSpacing: 2 };
  const push = lerp(1, 1.05, clamp01(frame / s.length));
  return (
    <AbsoluteFill style={{ background: COLORS.logoBlack }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            opacity: grow,
            background: `radial-gradient(ellipse 60% 38% at 50% 58%, rgba(241,90,41,0.32), rgba(17,17,17,0) 70%)`,
          }}
        />
        <EmberParticles opacity={grow} seed="hook" area={[200, 500, 680, 900]} />
        <Ember intensity={1 - grow * 0.6} sparkAt={6} />
        {grow > 0 && <LogoFlame x={EMBER.x} baseY={EMBER.y + 30} height={430} grow={grow} />}
        <div style={{ position: "absolute", left: 150, right: 150, top: 330 }}>
          <KineticCaption
            words={[
              { text: "EVERYTHING", at: at(0) },
              { text: "WE", at: at(1) },
              { text: "MAKE.", at: at(2) },
            ]}
            wordStyle={text}
          />
        </div>
        <div style={{ position: "absolute", left: 150, right: 150, top: 1330 }}>
          <KineticCaption
            words={[
              { text: "ON", at: at(4), color: COLORS.yellow, glow: true },
              { text: "FIRE.", at: at(5), color: COLORS.yellow, glow: true },
            ]}
            wordStyle={{ ...text, fontSize: 178 }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
