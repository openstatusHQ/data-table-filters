import {
  AbsoluteFill,
  Freeze,
  interpolate,
  OffthreadVideo,
  staticFile,
  useVideoConfig,
} from "remotion";
import { cameraTransform, type Shot } from "./camera";
import { colors, radius } from "./theme";
import { Pill, Scene, useSeconds } from "./ui";

type Box = [x: number, y: number, w: number, h: number];
export type Marks = {
  viewport: { width: number; height: number };
  duration: number;
  marks: Record<string, { t: number; box: Box }>;
};

// Seconds of stage before the recording starts playing, and after it ends.
export const LEAD = 0.8;
export const TAIL = 1.2;
export const recordingDuration = (marks: Marks) => LEAD + marks.duration + TAIL;

// A shot or caption, by mark: `offset` seconds from when the mark happened.
type Cue =
  | { kind: "overview"; mark?: string; offset: number }
  | { kind: "focus"; mark: string; offset: number; zoom: number; box?: Box };
type Caption = { mark?: string; offset: number; text: string };

const CUES: Cue[] = [
  { kind: "overview", offset: 0 },
  { kind: "focus", mark: "endpoint", offset: -0.8, zoom: 2 },
  { kind: "overview", mark: "endpoint", offset: 2.4 },
  { kind: "focus", mark: "level", offset: -0.9, zoom: 2.2 },
  { kind: "overview", mark: "level", offset: 2.2 },
  { kind: "focus", mark: "actions", offset: -0.4, zoom: 2 },
  { kind: "overview", mark: "actions", offset: 4.2 },
  // The sheet is the full height: frame its top half, where the fields are.
  {
    kind: "focus",
    mark: "sheet",
    offset: -0.2,
    zoom: 1.7,
    box: [992, 0, 448, 420],
  },
  { kind: "overview", mark: "sheet", offset: 3.8 },
  { kind: "focus", mark: "endpoint-edit", offset: -0.6, zoom: 2 },
  { kind: "overview", mark: "orders", offset: -1.2 },
];

const CAPTIONS: Caption[] = [
  { offset: 0, text: "One input: the manifest URL" },
  {
    mark: "level",
    offset: -1,
    text: "Filters and facets come from the schema",
  },
  {
    mark: "select",
    offset: -0.8,
    text: "Row actions: only what the server allows",
  },
  { mark: "row", offset: -0.8, text: "Row details, titled by the manifest" },
  {
    mark: "endpoint-edit",
    offset: -0.8,
    text: "Another endpoint. The same component.",
  },
];

export function RecordingScene({ marks }: { marks: Marks }) {
  const t = useSeconds();
  const { width, height, fps } = useVideoConfig();
  const duration = recordingDuration(marks);
  const { viewport } = marks;

  // The recording in a window on the stage.
  const scale = Math.min(
    (width * 0.9) / viewport.width,
    (height * 0.86) / viewport.height,
  );
  const winW = viewport.width * scale;
  const winH = viewport.height * scale;
  const winX = (width - winW) / 2;
  const winY = (height - winH) / 2;

  const videoFrame = Math.round(
    Math.min(Math.max(t - LEAD, 0), marks.duration - 1 / fps) * fps,
  );

  const timeOf = (mark: string | undefined, offset: number) =>
    LEAD + (mark ? marks.marks[mark].t : 0) + offset;

  const shots: Shot[] = CUES.map((cue) => {
    const at = timeOf(cue.mark, cue.offset);
    if (cue.kind === "overview")
      return { at, x: width / 2, y: height / 2, zoom: 1 };
    const [x, y, w, h] = cue.box ?? marks.marks[cue.mark].box;
    const zoom = Math.max(
      1,
      Math.min(
        cue.zoom,
        (0.8 * width) / (w * scale),
        (0.75 * height) / (h * scale),
      ),
    );
    return {
      at,
      x: winX + (x + w / 2) * scale,
      y: winY + (y + h / 2) * scale,
      zoom,
    };
  });

  const captions = CAPTIONS.map((c) => ({
    ...c,
    at: timeOf(c.mark, c.offset),
  }));
  const index = captions.findLastIndex((c) => c.at <= t);
  const caption = captions[index];
  const until = captions[index + 1]?.at ?? duration - 0.6;
  const pill = caption
    ? interpolate(
        t,
        [caption.at, caption.at + 0.4, until - 0.4, until],
        [0, 1, 1, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      )
    : 0;

  return (
    <Scene duration={duration}>
      <AbsoluteFill
        style={{
          transformOrigin: "0 0",
          transform: cameraTransform(shots, t, width, height),
        }}
      >
        <div
          style={{
            position: "absolute",
            left: winX,
            top: winY,
            width: winW,
            height: winH,
            borderRadius: radius,
            border: `2px solid ${colors.border}`,
            overflow: "hidden",
            boxShadow: "0 40px 100px -20px rgb(0 0 0 / 0.7)",
          }}
        >
          {/* Holds the first frame through the lead-in, the last through the tail. */}
          <Freeze frame={videoFrame}>
            <OffthreadVideo
              src={staticFile("recording/video.mp4")}
              style={{ width: "100%", height: "100%" }}
            />
          </Freeze>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 56,
        }}
      >
        <div
          style={{
            opacity: pill,
            transform: `translateY(${(1 - pill) * 12}px)`,
          }}
        >
          {caption ? <Pill>{caption.text}</Pill> : null}
        </div>
      </AbsoluteFill>
    </Scene>
  );
}
