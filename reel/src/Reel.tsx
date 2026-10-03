import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, loadBrandFonts } from "./brand";
import { byId } from "./data";
import { GrainOverlay, HexWipe, Vignette } from "./components";
import { FoodScene, foodBeats } from "./scenes/FoodScene";
import { Fries, friesCuts } from "./scenes/Fries";
import { Hook } from "./scenes/Hook";
import { Kebabs, kebabRowAt } from "./scenes/Kebabs";
import { Cheat, LogoEnd } from "./scenes/Outro";
import { SCENES, Scene, TOTAL, WIPE, f, scene } from "./timeline";

const render = (s: Scene): React.ReactNode => {
  switch (s.id) {
    case "hook":
      return <Hook s={s} />;
    case "shawarma":
    case "burgers":
    case "sandwiches":
      return <FoodScene s={s} cat={byId(s.id)} />;
    case "kebabs":
      return <Kebabs s={s} cat={byId("kebabs")} />;
    case "fries":
      return <Fries s={s} cat={byId("fries")} />;
    case "cheat":
      return <Cheat s={s} />;
    case "logo":
      return <LogoEnd s={s} total={TOTAL} />;
  }
};

/** Each scene after the hook enters through a HexWipe that overlaps the previous scene by WIPE frames. */
const SceneLayer: React.FC<{ s: Scene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const content = render(s);
  if (s.id === "hook") return <>{content}</>;
  return <HexWipe progress={frame / WIPE}>{content}</HexWipe>;
};

// ---------------------------------------------------------------- sound design cues (absolute frames)
type Cue = { at: number; src: string; vol: number };
const SFX = (n: string) => staticFile(`audio/sfx/${n}.wav`);

const cues: Cue[] = (() => {
  const c: Cue[] = [];
  const hook = scene("hook");
  c.push({ at: 0, src: SFX("bass-hit"), vol: 0.9 });
  c.push({ at: hook.start + hook.voAt + f(hook.vo.words[4].start) - 8, src: SFX("flame-whoosh"), vol: 0.9 }); // "on fire"
  for (const s of SCENES) {
    if (s.id !== "hook") c.push({ at: s.start - WIPE - 4, src: SFX("flame-whoosh"), vol: 0.7 });
  }
  for (const id of ["shawarma", "burgers", "sandwiches"] as const) {
    const s = scene(id);
    const b = foodBeats(s, byId(id).items.length);
    byId(id).items.forEach((_, i) => c.push({ at: s.start + b.flavourStart + i * b.step, src: SFX("text-tick"), vol: 0.35 }));
    c.push({ at: s.start + b.badge, src: SFX("bass-hit"), vol: 0.85 });
    c.push({ at: s.start + b.meal, src: SFX("text-tick"), vol: 0.5 });
  }
  const k = scene("kebabs");
  for (let r = 0; r <= 6; r++) c.push({ at: k.start + kebabRowAt(r) + (r === 6 ? f(0.25) : 0), src: SFX("text-tick"), vol: 0.4 });
  const fr = scene("fries");
  friesCuts(fr).forEach((at, i) => c.push({ at: fr.start + at + (i === 0 ? f(0.2) : 3), src: SFX("text-tick"), vol: 0.5 }));
  const logo = scene("logo");
  c.push({ at: logo.start + logo.voAt + 2, src: SFX("bass-hit"), vol: 1 });
  return c;
})();

/** VO intervals (absolute frames) for music ducking. */
const voSpans = SCENES.map((s) => [s.start + s.voAt, s.start + s.voAt + f(s.vo.duration)] as const);

const musicVolume = (frame: number) => {
  const base = 0.6; // music bed under everything
  let duck = 0; // 0..1, 1 = ducked by 6 dB
  for (const [a, b] of voSpans) duck = Math.max(duck, interpolate(frame, [a - 5, a, b, b + 8], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const fade = interpolate(frame, [0, 6, TOTAL - 24, TOTAL - 4], [0.4, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return base * (1 - duck * 0.5) * fade;
};

export const Reel: React.FC = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    loadBrandFonts().then(() => continueRender(handle));
  }, [handle]);
  const food0 = scene("shawarma");
  const fries = scene("fries");
  const cheat = scene("cheat");
  return (
    <AbsoluteFill style={{ background: COLORS.logoBlack }}>
      {SCENES.map((s) => (
        <Sequence key={s.id} from={s.id === "hook" ? 0 : s.start - WIPE} durationInFrames={s.length + (s.id === "hook" ? 0 : WIPE)} name={s.id}>
          <SceneLayer s={s} />
        </Sequence>
      ))}
      <Vignette strength={0.55} />
      <GrainOverlay opacity={0.05} />

      {/* ---- audio ---- */}
      <Audio src={staticFile("audio/music/music-loop-100bpm.wav")} loop volume={musicVolume} />
      {SCENES.map((s) => (
        <Sequence key={`vo-${s.id}`} from={s.start + s.voAt} durationInFrames={f(s.vo.duration) + 4} name={`vo-${s.vo.id}`}>
          <Audio src={staticFile(s.vo.file)} volume={1} />
        </Sequence>
      ))}
      <Sequence from={food0.start - WIPE} durationInFrames={fries.start + fries.length - (food0.start - WIPE)} name="sizzle">
        <Audio src={staticFile("audio/sfx/sizzle-bed.wav")} loop volume={(fr) => interpolate(fr, [0, 12, fries.start + fries.length - (food0.start - WIPE) - 12, fries.start + fries.length - (food0.start - WIPE)], [0, 0.9, 0.9, 0], { extrapolateRight: "clamp" })} />
      </Sequence>
      <Sequence from={0} durationInFrames={food0.start} name="crackle-hook">
        <Audio src={staticFile("audio/sfx/ember-crackle.wav")} loop volume={0.6} />
      </Sequence>
      <Sequence from={cheat.start - WIPE} durationInFrames={TOTAL - (cheat.start - WIPE)} name="crackle-outro">
        <Audio src={staticFile("audio/sfx/ember-crackle.wav")} loop volume={0.5} />
      </Sequence>
      {cues.map((c, i) => (
        <Sequence key={i} from={Math.max(0, c.at)} durationInFrames={f(2)} name={`sfx-${i}`}>
          <Audio src={c.src} volume={c.vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
