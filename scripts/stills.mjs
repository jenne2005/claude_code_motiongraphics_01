// Render individual frames for review: node scripts/stills.mjs out/stills 1.5 4.2 9.8 ...
import fs from "node:fs";
import path from "node:path";
import { openFilm } from "./browser.mjs";

const [dir, ...times] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true });
const { browser, page } = await openFilm();
for (const t of times) {
  const url = await page.evaluate((t) => window.frameAt(t), +t);
  const file = path.join(dir, `t${(+t).toFixed(2).padStart(6, "0")}.png`);
  fs.writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
  console.log(file);
}
await browser.close();
