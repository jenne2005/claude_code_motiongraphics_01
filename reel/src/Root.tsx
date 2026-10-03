import { Composition } from "remotion";
import { BrandCheck } from "./BrandCheck";
import { Reel } from "./Reel";
import { TestFrame } from "./TestFrame";
import { VIDEO } from "./brand";
import { TOTAL } from "./timeline";
import { ReelV2, V2_TOTAL } from "./v2/ReelV2";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HungrillzReel" component={Reel} durationInFrames={TOTAL} {...VIDEO} />
    <Composition id="HungrillzReelV2A" component={ReelV2} durationInFrames={V2_TOTAL} {...VIDEO} defaultProps={{ variant: "A" as const }} />
    <Composition id="HungrillzReelV2B" component={ReelV2} durationInFrames={V2_TOTAL} {...VIDEO} defaultProps={{ variant: "B" as const }} />
    <Composition id="TestFrame" component={TestFrame} durationInFrames={30} {...VIDEO} />
    <Composition id="BrandCheck" component={BrandCheck} durationInFrames={1} {...VIDEO} />
  </>
);
