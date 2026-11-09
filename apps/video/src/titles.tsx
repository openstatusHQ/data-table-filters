import { AbsoluteFill, useVideoConfig } from "remotion";
import { cameraTransform } from "./camera";
import { colors, fonts, radius, SITE } from "./theme";
import {
  Command,
  Eyebrow,
  Reveal,
  Scene,
  Subtitle,
  Title,
  useSeconds,
} from "./ui";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 28,
        textAlign: "center",
        padding: "0 160px",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

export function Intro({ duration }: { duration: number }) {
  return (
    <Scene duration={duration}>
      <Centered>
        <Reveal delay={0.3}>
          <Eyebrow>data-table-filters</Eyebrow>
        </Reveal>
        <Reveal delay={0.6}>
          <Title size={120}>Headless data tables</Title>
        </Reveal>
        <Reveal delay={1}>
          <Subtitle>
            Point the table at an endpoint. It renders what the endpoint
            describes.
          </Subtitle>
        </Reveal>
      </Centered>
    </Scene>
  );
}

const MANIFEST = "https://api.example.com/logs/schema";

// The /headless endpoint bar, drawn: GET, the manifest URL, Load.
export function UrlScene({ duration }: { duration: number }) {
  const t = useSeconds();
  const { width, height } = useVideoConfig();
  const typed = MANIFEST.slice(0, Math.max(0, Math.floor((t - 1.6) * 18)));
  const caret = Math.floor(t * 2) % 2 === 0 && typed.length < MANIFEST.length;
  const shots = [
    { at: 0, x: width / 2, y: height / 2, zoom: 1 },
    { at: 1.2, x: width / 2, y: 600, zoom: 1.25 },
    { at: duration - 2, x: width / 2, y: height / 2, zoom: 1 },
  ];
  return (
    <Scene duration={duration}>
      <AbsoluteFill
        style={{
          transformOrigin: "0 0",
          transform: cameraTransform(shots, t, width, height),
        }}
      >
        <Centered>
          <Reveal delay={0.3}>
            <Eyebrow>new: {SITE}/headless</Eyebrow>
          </Reveal>
          <Reveal delay={0.5}>
            <Title size={72}>Paste a manifest URL. Get a table.</Title>
          </Reveal>
          <Reveal delay={0.8} style={{ marginTop: 40 }}>
            <div style={{ display: "flex", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: 1040,
                  height: 84,
                  border: `2px solid ${colors.input}`,
                  borderRadius: radius,
                  background: colors.background,
                  fontFamily: fonts.mono,
                  fontSize: 30,
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    padding: "0 20px 0 28px",
                    fontSize: 24,
                    color: colors.mutedForeground,
                  }}
                >
                  GET
                </span>
                <span style={{ color: colors.foreground }}>{typed}</span>
                <span
                  style={{
                    width: 3,
                    height: 36,
                    marginLeft: 2,
                    background: caret ? colors.foreground : "transparent",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 32px",
                  border: `2px solid ${colors.input}`,
                  borderRadius: radius,
                  fontFamily: fonts.sans,
                  fontWeight: 500,
                  fontSize: 30,
                  color: colors.foreground,
                }}
              >
                Load
              </div>
            </div>
          </Reveal>
          <Reveal delay={1.2}>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 26,
                color: colors.mutedForeground,
              }}
            >
              {SITE}/headless?manifest=
              <span style={{ color: colors.foreground }}>{typed}</span>
            </div>
          </Reveal>
        </Centered>
      </AbsoluteFill>
    </Scene>
  );
}

export function Outro({ duration }: { duration: number }) {
  return (
    <Scene duration={duration}>
      <Centered>
        <Reveal delay={0.3}>
          <Title size={96}>Build a solid data table.</Title>
        </Reveal>
        <Reveal delay={0.6}>
          <Subtitle>
            Filters, sorting, infinite scroll and row actions, from one
            manifest.
          </Subtitle>
        </Reveal>
        <Reveal delay={1} style={{ marginTop: 32 }}>
          <Command>
            npx shadcn@latest add @data-table-filters/data-table-remote
          </Command>
        </Reveal>
        <Reveal delay={1.4} style={{ marginTop: 16 }}>
          <Eyebrow>{SITE}/headless</Eyebrow>
        </Reveal>
      </Centered>
    </Scene>
  );
}
