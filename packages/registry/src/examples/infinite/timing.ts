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

/** Each phase's share of the latency, formatted for display (`"12.5%"`, `"<1%"`). */
export function getTimingPercentage(
  timing: Timing,
  latency: number,
): Record<TimingPhase, string> {
  const out = {} as Record<TimingPhase, string>;
  for (const phase of TIMING_PHASES) {
    const ratio = latency > 0 ? timing[phase] / latency : 0;
    out[phase] =
      ratio > 0 && ratio < 0.01 ? "<1%" : `${(ratio * 100).toFixed(1)}%`;
  }
  return out;
}

/** The phases of a row, read off its flat dotted keys. */
export function pickTiming(row: Partial<Record<TimingPhase, number>>): Timing {
  const out = {} as Timing;
  for (const phase of TIMING_PHASES) out[phase] = row[phase] ?? 0;
  return out;
}
