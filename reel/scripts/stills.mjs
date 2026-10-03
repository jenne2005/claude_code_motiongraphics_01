// Render QA stills in one bundle: node scripts/stills.mjs <outDir> <scale> frame1 frame2 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const [outDir, scale, ...frames] = process.argv.slice(2);
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "HungrillzReel", browserExecutable });
for (const fr of frames) {
  const output = path.join(outDir, `f${String(fr).padStart(4, "0")}.png`);
  await renderStill({ serveUrl, composition, frame: +fr, output, scale: +scale, browserExecutable });
  console.log(output);
}
