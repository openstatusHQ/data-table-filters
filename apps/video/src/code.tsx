import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import { cameraTransform, type Shot } from "./camera";
import { colors, fonts, radius } from "./theme";
import { HEADER, Header, Scene, useSeconds } from "./ui";

const FONT = 27;
const LINE = 42;
const PAD = 32;
const BAR = 64;
const CARD_WIDTH = 1680;

// The camera moves to a line range at `at`; no `lines` means the whole card.
export type Focus = { at: number; lines?: [first: number, last: number] };

const KEYWORDS =
  /^(import|from|export|const|function|return|await|async|true|false|null)$/;
const TOKEN =
  /(\/\/.*$)|("(?:[^"\\]|\\.)*")|([A-Za-z_$][\w$.]*)|(\d+)|(\s+)|(.)/g;

// Two tones and a dim one, as the site sets code: identifiers and strings in
// the foreground, syntax and keywords muted, comments dimmer still.
function Line({ text }: { text: string }) {
  const parts: { s: string; color: string }[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const [s, comment, , word, , space, punct] = m;
    const color = comment
      ? colors.chart2
      : (word && KEYWORDS.test(word)) || punct
        ? colors.mutedForeground
        : space
          ? "inherit"
          : colors.foreground;
    parts.push({ s, color });
  }
  return (
    <div style={{ height: LINE, whiteSpace: "pre" }}>
      {parts.map((p, i) => (
        <span key={i} style={{ color: p.color }}>
          {p.s}
        </span>
      ))}
    </div>
  );
}

export function CodeScene({
  duration,
  eyebrow,
  title,
  file,
  code,
  focus,
}: {
  duration: number;
  eyebrow: string;
  title: string;
  file: string;
  code: string;
  focus: Focus[];
}) {
  const t = useSeconds();
  const { width, height } = useVideoConfig();
  const lines = code.trim().split("\n");
  const cardHeight = BAR + PAD * 2 + lines.length * LINE;
  const left = (width - CARD_WIDTH) / 2;
  const top = HEADER + (height - HEADER - cardHeight) / 2;
  const lineY = (i: number) => top + BAR + PAD + (i - 1) * LINE + LINE / 2;

  const shots: Shot[] = focus.map(({ at, lines: range }) => {
    if (!range) return { at, x: width / 2, y: height / 2, zoom: 1 };
    // Geist Mono advances 0.6em, so the widest focused line must fit the frame.
    const widest = Math.max(
      ...lines.slice(range[0] - 1, range[1]).map((l) => l.length),
    );
    const zoom = Math.min(
      1.6,
      (0.55 * height) / ((range[1] - range[0] + 1) * LINE),
      (0.92 * width) / (widest * FONT * 0.6 + PAD * 2),
    );
    // Keep the start of the lines in view, not the middle of the card.
    const x = left + width / (2 * zoom) - 20;
    return { at, x, y: (lineY(range[0]) + lineY(range[1])) / 2, zoom };
  });

  // Lines outside the current range dim, and come back when it clears.
  const active = focus.filter((f) => f.at <= t).at(-1);
  const since = active ? t - active.at : 0;
  const opacityOf = (i: number) => {
    const inRange =
      !active?.lines || (i >= active.lines[0] && i <= active.lines[1]);
    const prev = focus[focus.indexOf(active!) - 1];
    const wasIn = !prev?.lines || (i >= prev.lines[0] && i <= prev.lines[1]);
    const from = wasIn ? 1 : 0.3;
    const to = inRange ? 1 : 0.3;
    return interpolate(since, [0, 0.6], [from, to], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

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
            left,
            top,
            width: CARD_WIDTH,
            height: cardHeight,
            background: colors.card,
            border: `2px solid ${colors.border}`,
            borderRadius: radius,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: BAR,
              display: "flex",
              alignItems: "center",
              padding: `0 ${PAD}px`,
              borderBottom: `2px solid ${colors.border}`,
              fontFamily: fonts.mono,
              fontSize: 22,
              color: colors.mutedForeground,
              background: colors.background,
            }}
          >
            {file}
          </div>
          <div
            style={{
              padding: PAD,
              fontFamily: fonts.mono,
              fontSize: FONT,
            }}
          >
            {lines.map((text, i) => (
              <div key={i} style={{ opacity: opacityOf(i + 1) }}>
                <Line text={text} />
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
      <Header eyebrow={eyebrow} title={title} />
    </Scene>
  );
}
