import { Composition } from "remotion";
import { BrandCheck } from "./BrandCheck";
import { Reel } from "./Reel";
import { TestFrame } from "./TestFrame";
import { VIDEO } from "./brand";
import { TOTAL } from "./timeline";
import { ReelV2, V2_TOTAL } from "./v2/ReelV2";
import { CoverV4, ReelV4, V4_FRAMES } from "./v4/ReelV4";
import { CoverV16, ReelV16, V16_FRAMES } from "./v16/ReelV16";
import { CoverV17, ReelV17, V17_FRAMES } from "./v17/ReelV17";
import { LogoCheckV17 } from "./v17/LogoCheck";
import { CoverV18, ReelV18, V18_FRAMES } from "./v18/ReelV18";
import { CoverV19, ReelV19, V19_FRAMES } from "./v19/ReelV19";
import { CoverV20, ReelV20, V20_FRAMES } from "./v20/ReelV20";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HungrillzReel" component={Reel} durationInFrames={TOTAL} {...VIDEO} />
    <Composition id="HungrillzReelV2A" component={ReelV2} durationInFrames={V2_TOTAL} {...VIDEO} defaultProps={{ variant: "A" as const }} />
    <Composition id="HungrillzReelV2B" component={ReelV2} durationInFrames={V2_TOTAL} {...VIDEO} defaultProps={{ variant: "B" as const }} />
    <Composition id="HungrillzV4A" component={ReelV4} durationInFrames={V4_FRAMES} {...VIDEO} defaultProps={{ hook: "A" as const }} />
    <Composition id="HungrillzV4B" component={ReelV4} durationInFrames={V4_FRAMES} {...VIDEO} defaultProps={{ hook: "B" as const }} />
    <Composition id="HungrillzV4C" component={ReelV4} durationInFrames={V4_FRAMES} {...VIDEO} defaultProps={{ hook: "C" as const }} />
    <Composition id="HungrillzV4Cover" component={CoverV4} durationInFrames={1} {...VIDEO} />
    <Composition id="HungrillzV16" component={ReelV16} durationInFrames={V16_FRAMES} {...VIDEO} />
    <Composition id="HungrillzV16Cover" component={CoverV16} durationInFrames={1} {...VIDEO} />
    <Composition id="HungrillzV17" component={ReelV17} durationInFrames={V17_FRAMES} {...VIDEO} />
    <Composition id="HungrillzV17Cover" component={CoverV17} durationInFrames={1} {...VIDEO} />
    <Composition id="HungrillzV18" component={ReelV18} durationInFrames={V18_FRAMES} {...VIDEO} />
    <Composition id="HungrillzV18Cover" component={CoverV18} durationInFrames={1} {...VIDEO} />
    <Composition id="HungrillzV19" component={ReelV19} durationInFrames={V19_FRAMES} {...VIDEO} />
    <Composition id="HungrillzV19Cover" component={CoverV19} durationInFrames={1} {...VIDEO} />
    <Composition id="HungrillzV20" component={ReelV20} durationInFrames={V20_FRAMES} {...VIDEO} />
    <Composition id="HungrillzV20Cover" component={CoverV20} durationInFrames={1} {...VIDEO} />
    <Composition id="LogoCheckV17" component={LogoCheckV17} durationInFrames={1} width={1200} height={900} fps={30} />
    <Composition id="TestFrame" component={TestFrame} durationInFrames={30} {...VIDEO} />
    <Composition id="BrandCheck" component={BrandCheck} durationInFrames={1} {...VIDEO} />
  </>
);
