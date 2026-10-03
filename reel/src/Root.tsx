import { Composition } from "remotion";
import { BrandCheck } from "./BrandCheck";
import { Reel } from "./Reel";
import { TestFrame } from "./TestFrame";
import { VIDEO } from "./brand";
import { TOTAL } from "./timeline";
import { ReelV2, V2_TOTAL } from "./v2/ReelV2";
import { CoverV4, ReelV4, V4_FRAMES } from "./v4/ReelV4";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HungrillzReel" component={Reel} durationInFrames={TOTAL} {...VIDEO} />
    <Composition id="HungrillzReelV2A" component={ReelV2} durationInFrames={V2_TOTAL} {...VIDEO} defaultProps={{ variant: "A" as const }} />
    <Composition id="HungrillzReelV2B" component={ReelV2} durationInFrames={V2_TOTAL} {...VIDEO} defaultProps={{ variant: "B" as const }} />
    <Composition id="HungrillzV4A" component={ReelV4} durationInFrames={V4_FRAMES} {...VIDEO} defaultProps={{ hook: "A" as const }} />
    <Composition id="HungrillzV4B" component={ReelV4} durationInFrames={V4_FRAMES} {...VIDEO} defaultProps={{ hook: "B" as const }} />
    <Composition id="HungrillzV4C" component={ReelV4} durationInFrames={V4_FRAMES} {...VIDEO} defaultProps={{ hook: "C" as const }} />
    <Composition id="HungrillzV4Cover" component={CoverV4} durationInFrames={1} {...VIDEO} />
    <Composition id="TestFrame" component={TestFrame} durationInFrames={30} {...VIDEO} />
    <Composition id="BrandCheck" component={BrandCheck} durationInFrames={1} {...VIDEO} />
  </>
);
