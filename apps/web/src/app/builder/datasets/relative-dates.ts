const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Assign fresh ISO date strings to a date field on each item in the array.
 * Dates are spread evenly across [now - 60 days, now] in descending order
 * (index 0 = most recent, last index = oldest) with a small random jitter
 * so they look organic. The array is mutated in place.
 *
 * Uses a seeded pseudo-random so the jitter is stable across hot-reloads.
 * The reference timestamp is rounded to the nearest hour so that server
 * and client produce identical output during hydration.
 */
export function patchDates<T extends Record<string, unknown>>(
  data: T[],
  field: keyof T & string,
): void {
  const HOUR_MS = 3_600_000;
  const now = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  const step = TWO_MONTHS_MS / data.length;

  // Derive a per-field seed so different datasets get different jitter patterns
  let seed =
    Array.from(field).reduce((acc, c) => acc + c.charCodeAt(0), 0) * 2654435761;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = 0; i < data.length; i++) {
    const base = now - step * i;
    const jitter = rand() * step * 0.8; // up to 80% of one step
    (data[i] as Record<string, unknown>)[field] = new Date(
      base - jitter,
    ).toISOString();
  }
}
