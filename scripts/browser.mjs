// Opens src/index.html in headless Chromium (Playwright) and returns the page, ready to render.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require("playwright");
  } catch {
    // fall back to a globally installed copy
    const globalRoot = execSync("npm root -g").toString().trim();
    return require(path.join(globalRoot, "playwright"));
  }
}

export async function openFilm() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on("pageerror", (e) => console.error("[page]", e.message));
  page.on("console", (m) => m.type() === "error" && console.error("[console]", m.text()));
  await page.goto(pathToFileURL(path.join(ROOT, "src/index.html")).href + "?render");
  await page.evaluate(() => window.ready);
  return { browser, page, ROOT };
}
