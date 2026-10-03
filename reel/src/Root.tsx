import { Composition } from "remotion";
import { BrandCheck } from "./BrandCheck";
import { Reel } from "./Reel";
import { TestFrame } from "./TestFrame";
import { VIDEO } from "./brand";
import { TOTAL } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HungrillzReel" component={Reel} durationInFrames={TOTAL} {...VIDEO} />
    <Composition id="TestFrame" component={TestFrame} durationInFrames={30} {...VIDEO} />
    <Composition id="BrandCheck" component={BrandCheck} durationInFrames={1} {...VIDEO} />
  </>
);
