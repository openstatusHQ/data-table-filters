function formatMilliseconds(ms: number): string {
  if (ms >= 1000) {
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(ms / 1000) + "s"
    );
  }

  return (
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(ms) +
    "ms"
  );
}
