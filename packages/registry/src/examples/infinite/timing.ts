/**
 * The request's timing phases, in the order they happen. Each is a flat,
 * dotted column on the row (`"timing.dns"`), the shape the table schema,
 * the filters and the mock API all read.
 */
export const TIMING_PHASES = [
  "timing.dns",
  "timing.connection",
  "timing.tls",
  "timing.ttfb",
  "timing.transfer",
] as const;

export type TimingPhase = (typeof TIMING_PHASES)[number];

export type Timing = Record<TimingPhase, number>;

/**
 * What `timingPhasesColumn` and `SheetTimingPhases` read off a row: the
 * total, and whichever phases the row carries. Any row type with these keys
 * fits, which is how the docs site's own demos share the components.
 */
export type TimingRow = { latency: number } & Partial<
  Record<TimingPhase, number>
>;

const PHASES: Record<TimingPhase, { label: string; color: string }> = {
  "timing.dns": { label: "DNS", color: "bg-emerald-500" },
  "timing.connection": { label: "Connection", color: "bg-cyan-500" },
  "timing.tls": { label: "TLS", color: "bg-blue-500" },
  "timing.ttfb": { label: "TTFB", color: "bg-violet-500" },
  "timing.transfer": { label: "Transfer", color: "bg-purple-500" },
};

export function getTimingLabel(phase: TimingPhase): string {
  return PHASES[phase].label;
}

export function getTimingColor(phase: TimingPhase): string {
  return PHASES[phase].color;
}

/**
 * One phase's share of the latency, as a percentage for a bar's `width`.
 * A row with no latency has no shares, not `NaN` ones.
 */
export function getTimingShare(
  timing: Timing,
  phase: TimingPhase,
  latency: number,
): number {
  return latency > 0 ? (timing[phase] / latency) * 100 : 0;
}

/** Each phase's share of the latency, formatted for display (`"12.5%"`, `"<1%"`). */
export function getTimingPercentage(
  timing: Timing,
  latency: number,
): Record<TimingPhase, string> {
  const out = {} as Record<TimingPhase, string>;
  for (const phase of TIMING_PHASES) {
    const share = getTimingShare(timing, phase, latency);
    out[phase] = share > 0 && share < 1 ? "<1%" : `${share.toFixed(1)}%`;
  }
  return out;
}

/** The phases of a row, read off its flat dotted keys. */
export function pickTiming(row: Partial<Record<TimingPhase, number>>): Timing {
  const out = {} as Timing;
  for (const phase of TIMING_PHASES) out[phase] = row[phase] ?? 0;
  return out;
}
