import { Config } from "@remotion/cli/config";
import fs from "node:fs";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setConcurrency(4);

// Use the preinstalled headless Chromium when present (no browser download needed).
const localShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (fs.existsSync(localShell)) Config.setBrowserExecutable(localShell);
