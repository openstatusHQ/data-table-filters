export function getTimingColor(
  timing: "dns" | "connection" | "tls" | "ttfb" | "transfer"
) {
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
