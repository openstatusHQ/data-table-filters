import { Composition, staticFile } from "remotion";
import type { Marks } from "./recording";
import { totalFrames, Video, type VideoProps } from "./video";

const FPS = 30;

export function RemotionRoot() {
  return (
    <Composition
      id="Headless"
      component={Video}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{ marks: null } satisfies VideoProps}
      calculateMetadata={async ({ props }) => {
        // Written by scripts/record.mjs next to the video it describes.
        const res = await fetch(staticFile("recording/marks.json"));
        const marks = (await res.json()) as Marks;
        return {
          durationInFrames: totalFrames(marks, FPS),
          props: { ...props, marks },
        };
      }}
    />
  );
}
