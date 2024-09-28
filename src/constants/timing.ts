type TimingPhase = "dns" | "connection" | "tls" | "ttfb" | "transfer";

export function getTimingColor(timing: TimingPhase) {
  switch (timing) {
    case "dns":
      return "bg-emerald-500";
    case "connection":
      return "bg-cyan-500";
    case "tls":
      return "bg-blue-500";
    case "ttfb":
      return "bg-violet-500";
    case "transfer":
      return "bg-purple-500";
    default:
      return "bg-gray-500";
  }
}

export function getTimingPercentage(
  timing: Record<TimingPhase, number>,
  latency: number
): Record<TimingPhase, number | string> {
  // const total = Object.values(timing).reduce((acc, curr) => acc + curr, 0);
  const percentage: Record<TimingPhase, number | string> = { ...timing };
  Object.entries(timing).forEach(([key, value]) => {
    const pValue = Math.round((value / latency) * 1000) / 1000;
    percentage[key as keyof typeof timing] = /^0\.00[0-9]+/.test(
      pValue.toString()
    )
      ? "<1%"
      : `${(pValue * 100).toFixed(1)}%`;
  });
  return percentage;
}
