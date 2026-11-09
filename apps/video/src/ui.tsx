import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, fonts, radius } from "./theme";

export const FADE = 0.5;

export function useSeconds() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Every scene fades in from and out to the background.
export function Scene({
  duration,
  children,
}: {
  duration: number;
  children: ReactNode;
}) {
  const t = useSeconds();
  const opacity = interpolate(
    t,
    [0, FADE, duration - FADE, duration],
    [0, 1, 1, 0],
    clamp,
  );
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

// A line rises into place `delay` seconds into the scene.
export function Reveal({
  delay,
  children,
  style,
}: {
  delay: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const t = useSeconds();
  const p = interpolate(t - delay, [0, 0.7], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${(1 - p) * 16}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: fonts.mono,
        fontSize: 26,
        color: colors.mutedForeground,
      }}
    >
      {children}
    </div>
  );
}

export function Title({
  children,
  size = 64,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <div
      style={{
        fontFamily: fonts.sans,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: "-0.035em",
        lineHeight: 1.1,
        color: colors.foreground,
      }}
    >
      {children}
    </div>
  );
}

export function Subtitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: fonts.sans,
        fontSize: 34,
        lineHeight: 1.4,
        color: colors.mutedForeground,
      }}
    >
      {children}
    </div>
  );
}

// Eyebrow and title over the top of a scene; content scrolls under it.
export const HEADER = 210;
export function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <AbsoluteFill
      style={{
        height: HEADER,
        padding: "64px 120px 0",
        gap: 12,
        background: `linear-gradient(${colors.background} 75%, transparent)`,
      }}
    >
      <Reveal delay={0.2}>
        <Eyebrow>{eyebrow}</Eyebrow>
      </Reveal>
      <Reveal delay={0.35}>
        <Title size={56}>{title}</Title>
      </Reveal>
    </AbsoluteFill>
  );
}

// A caption pill over footage, like the site's floating bar.
export function Pill({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: fonts.sans,
        fontSize: 34,
        fontWeight: 500,
        color: colors.foreground,
        background: colors.card,
        border: `2px solid ${colors.border}`,
        borderRadius: radius,
        padding: "18px 30px",
        boxShadow: "0 20px 60px -10px rgb(0 0 0 / 0.6)",
      }}
    >
      {children}
    </div>
  );
}

// The site's copy-command box: "$ <command>".
export function Command({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        fontFamily: fonts.mono,
        fontSize: 30,
        color: colors.foreground,
        background: colors.background,
        border: `2px solid ${colors.input}`,
        borderRadius: radius,
        padding: "20px 28px",
      }}
    >
      <span style={{ color: colors.mutedForeground }}>$</span>
      {children}
    </div>
  );
}
