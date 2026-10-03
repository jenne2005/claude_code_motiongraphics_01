import { Composition } from "remotion";
import { BrandCheck } from "./BrandCheck";
import { TestFrame } from "./TestFrame";
import { VIDEO } from "./brand";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="TestFrame" component={TestFrame} durationInFrames={30} {...VIDEO} />
    <Composition id="BrandCheck" component={BrandCheck} durationInFrames={1} {...VIDEO} />
  </>
);
