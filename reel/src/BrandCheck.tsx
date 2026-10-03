import { useEffect, useState } from "react";
import { AbsoluteFill, Img, continueRender, delayRender } from "remotion";
import { ASSETS, COLORS, FONTS, loadBrandFonts } from "./brand";
import { ITEM_COUNT, MENU, fromPrice, rupees } from "./data";

/** Still used to verify brand assets: fonts (incl. ₹ glyph), logo PNG, hexagon, palette, menu data. */
export const BrandCheck: React.FC = () => {
  const [handle] = useState(() => delayRender("brand fonts"));
  useEffect(() => {
    loadBrandFonts().then(() => continueRender(handle));
  }, [handle]);
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal, alignItems: "center", padding: 60, gap: 28 }}>
      <Img src={ASSETS.logo} style={{ width: 760 }} />
      <div style={{ fontFamily: FONTS.headline, fontSize: 120, color: COLORS.white, lineHeight: 1 }}>WHERE THERE'S FIRE</div>
      <div style={{ display: "flex", gap: 18 }}>
        {Object.entries(COLORS).map(([k, c]) => (
          <div key={k} style={{ width: 120, height: 120, background: c, borderRadius: 16, border: "3px solid #333" }} />
        ))}
      </div>
      {MENU.map((c) => (
        <div key={c.id} style={{ display: "flex", width: 900, justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: FONTS.headline, fontSize: 64, color: COLORS.flame, textTransform: "uppercase" }}>{c.title}</span>
          <span style={{ fontFamily: FONTS.price, fontWeight: 800, fontSize: 56, color: COLORS.yellow }}>from {rupees(fromPrice(c))}</span>
        </div>
      ))}
      <div style={{ fontFamily: FONTS.price, fontWeight: 500, fontSize: 36, color: COLORS.white }}>{ITEM_COUNT} menu items</div>
      <Img src={ASSETS.hexagon} style={{ width: 220 }} />
    </AbsoluteFill>
  );
};
