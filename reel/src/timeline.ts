import vo from "../public/audio/vo/vo-timings.json";
import { VIDEO } from "./brand";

/** Scene lengths are driven by the voiceover: lead-in + VO duration + tail (seconds). */
export const FPS = VIDEO.fps;
export const WIPE = 14; // frames of overlap for a HexWipe into the next scene
export const f = (sec: number) => Math.round(sec * FPS);

export type Word = { word: string; start: number; end: number };
export type VoLine = { id: number; file: string; text: string; duration: number; words: Word[] };
export const VO = vo.lines as VoLine[];

export type SceneId = "hook" | "shawarma" | "burgers" | "sandwiches" | "kebabs" | "fries" | "cheat" | "logo";

// [scene, VO line id, lead-in, tail]
const PLAN: [SceneId, number, number, number][] = [
  ["hook", 1, 0.5, 0.8],
  ["shawarma", 2, 0.3, 2.2],
  ["burgers", 3, 0.3, 2.3],
  ["sandwiches", 4, 0.3, 2.1],
  ["kebabs", 5, 0.3, 1.6],
  ["fries", 6, 0.25, 0.95],
  ["cheat", 7, 0.3, 1.2], // 1.2 s hold after the line
  ["logo", 8, 0.35, 1.25],
];

export type Scene = {
  id: SceneId;
  vo: VoLine;
  /** first frame of the scene (wipe overlap happens before this) */
  start: number;
  length: number;
  /** VO start, in frames from scene start */
  voAt: number;
};

export const SCENES: Scene[] = (() => {
  let t = 0;
  return PLAN.map(([id, line, lead, tail]) => {
    const v = VO.find((l) => l.id === line)!;
    const length = f(lead + v.duration + tail);
    const s = { id, vo: v, start: t, length, voAt: f(lead) };
    t += length;
    return s;
  });
})();

export const TOTAL = SCENES.reduce((s, x) => s + x.length, 0);
export const scene = (id: SceneId) => SCENES.find((s) => s.id === id)!;
/** Absolute frame of a word in a scene's VO line. */
export const wordAt = (s: Scene, i: number) => s.start + s.voAt + f(s.vo.words[i].start);
