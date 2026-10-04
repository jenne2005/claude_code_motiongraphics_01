import { AbsoluteFill, Img, staticFile } from "remotion";

/** Renders the original logo at 100 % scale so its pixels can be compared with assets/logo-original.png. */
export const LogoCheckV17: React.FC = () => (
  <AbsoluteFill style={{ background: "#070707" }}>
    <Img src={staticFile("brand/logo-original.png")} style={{ width: 1200, height: 900 }} />
  </AbsoluteFill>
);
