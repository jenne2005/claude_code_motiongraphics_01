import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { ASSETS, COLORS, FONTS } from "../brand";
import { HEX_PATH } from "../hexagon-path";
import { EmberParticles, KineticCaption, LightSweep, RimGlow, clamp01, ease, lerp } from "../components";
import { Scene, WIPE, f } from "../timeline";
import { Ember } from "./Hook";

const headline = { fontFamily: FONTS.brand, fontSize: 124, lineHeight: 1.04, color: COLORS.white, letterSpacing: 2 };

export const Cheat: React.FC<{ s: Scene }> = ({ s }) => {
  const seq = useCurrentFrame();
  const frame = seq - WIPE;
  const at = (i: number) => WIPE + s.voAt + f(s.vo.words[i].start);
  const push = lerp(1, 1.06, clamp01((frame + WIPE) / (s.length + WIPE)));
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <RimGlow x={540} y={980} w={1200} h={1100} opacity={0.35} />
      <EmberParticles count={40} seed="cheat" />
      <AbsoluteFill style={{ transform: `scale(${push})`, justifyContent: "center" }}>
        <div style={{ position: "absolute", left: 150, right: 150, top: 560, display: "flex", flexDirection: "column", gap: 14 }}>
          <KineticCaption words={[{ text: "FINALLY,", at: at(0) }]} wordStyle={headline} />
          <KineticCaption words={[{ text: "A", at: at(1) }, { text: "CHEAT", at: at(2) }, { text: "MEAL", at: at(3) }]} wordStyle={headline} />
          <KineticCaption words={[{ text: "THAT", at: at(4) }, { text: "ISN'T", at: at(5) }]} wordStyle={headline} />
          <KineticCaption words={[{ text: "CHEATING.", at: at(6), color: COLORS.yellow, glow: true }]} wordStyle={{ ...headline, fontSize: 150 }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Logo PNG geometry: rendered at 10 px per logo unit, cropped with its origin at (508, 189).
const PNG_W = 1868;
const PNG_H = 1625;
const LOGO_W = 800;
const K = LOGO_W / PNG_W;
const LOGO_CX = 540;
const LOGO_CY = 900;
const LOGO_LEFT = LOGO_CX - LOGO_W / 2;
const LOGO_TOP = LOGO_CY - (PNG_H * K) / 2;
/** logo units -> screen px for the settled logo */
const U = (ux: number, uy: number) => [LOGO_LEFT + (ux * 10 - 508) * K, LOGO_TOP + (uy * 10 - 189) * K];

export const LogoEnd: React.FC<{ s: Scene; total: number }> = ({ s }) => {
  const seq = useCurrentFrame();
  const frame = seq - WIPE;
  const land = s.voAt + 2; // the logo lands on "Hungrillz"
  const lp = ease(frame, land - 16, 18);
  const ringDraw = ease(frame, -WIPE + 2, 20);
  const ringFade = ease(frame, land, 10);
  const end = s.length; // scene end (frames from scene start)
  const out = ease(frame, end - 20, 14); // logo + text fade back to the lone ember
  const at = (i: number) => WIPE + s.voAt + f(s.vo.words[i].start);
  const [ox, oy] = U(0, 0);
  const sLogo = lerp(1.45, 1, lp) * lerp(1, 0.96, out);
  const glow = lerp(0, 1, ease(frame, land, 20)) * (1 - out);
  return (
    <AbsoluteFill style={{ background: COLORS.logoBlack }}>
      <AbsoluteFill style={{ opacity: 1 - out }}>
        <RimGlow x={540} y={760} w={1250} h={1150} opacity={0.42 * glow + 0.1} />
        <EmberParticles count={40} seed="logo" />
        {/* the hexagon the logo settles into */}
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: 1 - ringFade }}>
          <g transform={`translate(${ox} ${oy}) scale(${10 * K})`}>
            <path
              d={HEX_PATH}
              fill="none"
              stroke={COLORS.flame}
              strokeWidth={2.4}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - ringDraw}
              style={{ filter: "drop-shadow(0 0 6px rgba(241,90,41,0.9))" }}
            />
          </g>
        </svg>
        <div
          style={{
            position: "absolute",
            left: LOGO_LEFT,
            top: LOGO_TOP,
            width: LOGO_W,
            height: PNG_H * K,
            transform: `scale(${sLogo})`,
            transformOrigin: `${LOGO_W / 2}px ${(PNG_H * K) / 2}px`,
            opacity: clamp01(lp * 1.6),
            filter: `blur(${(1 - lp) * 14}px) drop-shadow(0 0 ${36 * glow}px rgba(241,90,41,0.5))`,
          }}
        >
          <Img src={ASSETS.logo} style={{ width: LOGO_W, height: PNG_H * K }} />
          <div style={{ position: "absolute", inset: 0, WebkitMaskImage: `url(${ASSETS.logo})`, WebkitMaskSize: "100% 100%", maskImage: `url(${ASSETS.logo})`, maskSize: "100% 100%" }}>
            <LightSweep start={WIPE + land + 10} dur={26} opacity={0.5} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 150, right: 150, top: 1360 }}>
          <KineticCaption
            words={[
              { text: "CRAVE.", at: at(1) },
              { text: "GRILL.", at: at(2) },
              { text: "REPEAT.", at: at(3), color: COLORS.yellow, glow: true },
            ]}
            wordStyle={{ fontFamily: FONTS.brand, fontSize: 92, color: COLORS.white, letterSpacing: 3 }}
          />
        </div>
      </AbsoluteFill>
      {/* the lone ember returns so the last frame matches the first */}
      <Ember intensity={out} tFrame={frame - end} />
    </AbsoluteFill>
  );
};
