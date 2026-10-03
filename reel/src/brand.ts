import { Easing, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";

/**
 * Hungrillz brand tokens.
 * Colours are the exact fills in the official "Hungrillz Logo - Final-01" vector file
 * (Hungrillz Logo - Final.pdf, page 1, sRGB). The logo uses only four colours:
 * flame orange, flame yellow, logo black and white. Everything else here is derived from those.
 */
export const COLORS = {
  /** Flame body, wordmark shadow, grill stripes: rgb(94.5%, 35.3%, 16.1%) */
  flame: "#F15A29",
  /** Flame licks and the star: rgb(100%, 94.9%, 0%) */
  yellow: "#FFF200",
  /** Darker shade of the flame orange for depth and pressed states (derived, not in the logo) */
  accent: "#C9401A",
  /** Matte background for food heroes and scenes (production choice) */
  charcoal: "#111111",
  /** Badge fill and letter keylines in the logo: rgb(2.7%, 2.7%, 2.7%) */
  logoBlack: "#070707",
  white: "#FFFFFF",
  /** FSSAI vegetarian mark, used exactly as printed on the menu */
  veg: "#1FA34A",
} as const;

export const FONTS = {
  headline: "Anton",
  price: "Inter",
  /** The logo's own display face, packaged with the brand files */
  brand: "One Slice",
} as const;

/** House easing: cubic-bezier(0.16, 1, 0.3, 1) (fast out, long soft settle). */
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";

export const VIDEO = { width: 1080, height: 1920, fps: 30 } as const;

export const ASSETS = {
  logo: staticFile("brand/logo.png"),
  hexagon: staticFile("brand/hexagon.svg"),
} as const;

let fontsPromise: Promise<unknown> | null = null;
/** Load every brand font once. Call from a component with delayRender/continueRender. */
export function loadBrandFonts() {
  fontsPromise ??= Promise.all([
    loadFont({ family: FONTS.headline, url: staticFile("fonts/anton-latin.woff2"), unicodeRange: "U+0000-00FF, U+2000-206F" }),
    loadFont({ family: FONTS.headline, url: staticFile("fonts/anton-latin-ext.woff2"), unicodeRange: "U+0100-024F, U+20A0-20CF" }),
    loadFont({ family: FONTS.price, url: staticFile("fonts/inter-latin.woff2"), weight: "100 900", unicodeRange: "U+0000-00FF, U+2000-206F" }),
    loadFont({ family: FONTS.price, url: staticFile("fonts/inter-latin-ext.woff2"), weight: "100 900", unicodeRange: "U+0100-024F, U+20A0-20CF" }),
    loadFont({ family: FONTS.brand, url: staticFile("fonts/OneSlice.otf"), format: "opentype" }),
  ]);
  return fontsPromise;
}
