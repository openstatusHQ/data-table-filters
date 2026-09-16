import { describe, expect, it } from "vitest";
import { evaluateIntervalMs } from "../interval";

/**
 * The bucket-size ladder, pinned rung by rung.
 *
 * This function spent its whole life inlined in a demo route with no test at
 * any level: every chart the product has ever drawn picked its bucket here, and
 * a transposed digit would only have shown up as a chart that looked slightly
 * wrong. Now that it backs `DrizzleQueryScope.bucketMs` it is a published
 * contract, so every threshold is asserted from both sides.
 *
 * The ladder below is deliberately RESTATED rather than imported. Importing the
 * same table the implementation walks would only assert that a loop can read an
 * array; restating it means a change to either side has to be made twice, on
 * purpose.
 */
const LADDER: readonly { thresholdMinutes: number; intervalMs: number }[] = [
  { thresholdMinutes: 1, intervalMs: 1_000 },
  { thresholdMinutes: 5, intervalMs: 5_000 },
  { thresholdMinutes: 10, intervalMs: 10_000 },
  { thresholdMinutes: 30, intervalMs: 30_000 },
  { thresholdMinutes: 60, intervalMs: 60_000 },
  { thresholdMinutes: 120, intervalMs: 120_000 },
  { thresholdMinutes: 240, intervalMs: 240_000 },
  { thresholdMinutes: 480, intervalMs: 480_000 },
  { thresholdMinutes: 1_440, intervalMs: 1_440_000 },
  { thresholdMinutes: 2_880, intervalMs: 2_880_000 },
  { thresholdMinutes: 5_760, intervalMs: 5_760_000 },
  { thresholdMinutes: 11_520, intervalMs: 11_520_000 },
  { thresholdMinutes: 23_040, intervalMs: 23_040_000 },
];

/** The bucket for anything at or beyond the last threshold. */
const MAX_INTERVAL_MS = 46_080_000;

const MINUTE_MS = 60_000;

/** What the rung `i` threshold hands over to when the duration reaches it. */
function intervalAtOrAbove(index: number): number {
  return LADDER[index + 1]?.intervalMs ?? MAX_INTERVAL_MS;
}

describe("evaluateIntervalMs", () => {
  it("has thirteen rungs — a rung added or dropped fails here first", () => {
    expect(LADDER).toHaveLength(13);
  });

  describe("rung boundaries", () => {
    // The comparison is `durationMinutes < thresholdMinutes`, so the threshold
    // itself belongs to the NEXT rung. That off-by-one is the only thing that
    // can silently go wrong in a ladder, so both sides of all thirteen edges
    // are asserted.
    it.each(LADDER)(
      "just below $thresholdMinutes min → $intervalMs ms",
      ({ thresholdMinutes, intervalMs }) => {
        expect(evaluateIntervalMs(thresholdMinutes * MINUTE_MS - 1)).toBe(
          intervalMs,
        );
      },
    );

    it.each(LADDER.map((rung, index) => ({ ...rung, index })))(
      "exactly at $thresholdMinutes min → the next rung up",
      ({ thresholdMinutes, index }) => {
        expect(evaluateIntervalMs(thresholdMinutes * MINUTE_MS)).toBe(
          intervalAtOrAbove(index),
        );
      },
    );

    it("a threshold is exclusive on its own rung and inclusive on the next", () => {
      // Spelled out once concretely, so the parameterized cases above cannot
      // both be wrong in the same direction and still agree with each other.
      expect(evaluateIntervalMs(59_999)).toBe(1_000); // just under 1 min
      expect(evaluateIntervalMs(60_000)).toBe(5_000); // exactly 1 min
      expect(evaluateIntervalMs(60_001)).toBe(5_000);
    });
  });

  describe("fall-through above the last rung", () => {
    it("returns the max bucket at and beyond the final threshold", () => {
      const last = LADDER[LADDER.length - 1];
      expect(evaluateIntervalMs(last.thresholdMinutes * MINUTE_MS - 1)).toBe(
        last.intervalMs,
      );
      expect(evaluateIntervalMs(last.thresholdMinutes * MINUTE_MS)).toBe(
        MAX_INTERVAL_MS,
      );
      // 16 days, a year, a decade — all one bucket size.
      expect(evaluateIntervalMs(16 * 24 * 60 * MINUTE_MS)).toBe(
        MAX_INTERVAL_MS,
      );
      expect(evaluateIntervalMs(365 * 24 * 60 * MINUTE_MS)).toBe(
        MAX_INTERVAL_MS,
      );
      expect(evaluateIntervalMs(Number.MAX_SAFE_INTEGER)).toBe(MAX_INTERVAL_MS);
    });
  });

  describe("negative durations use the absolute value", () => {
    // `scope.bucketMs` is computed as `to - from`; a caller that hands the
    // bounds over reversed gets the same bucket rather than the max one.
    it.each(LADDER)(
      "−(just below $thresholdMinutes min) → $intervalMs ms",
      ({ thresholdMinutes, intervalMs }) => {
        expect(evaluateIntervalMs(-(thresholdMinutes * MINUTE_MS - 1))).toBe(
          intervalMs,
        );
      },
    );

    it("agrees with the positive duration across the whole ladder", () => {
      for (const { thresholdMinutes } of LADDER) {
        for (const offset of [-1, 0, 1]) {
          const ms = thresholdMinutes * MINUTE_MS + offset;
          expect(evaluateIntervalMs(-ms)).toBe(evaluateIntervalMs(ms));
        }
      }
    });

    it("treats −0 as 0", () => {
      expect(evaluateIntervalMs(-0)).toBe(1_000);
    });
  });

  describe("degenerate inputs", () => {
    it("zero picks the smallest bucket", () => {
      // A range whose bounds coincide — a single-row filtered set, which is
      // exactly what MIN/MAX discovery returns for one row.
      expect(evaluateIntervalMs(0)).toBe(1_000);
    });

    it("a sub-second duration still picks the smallest bucket", () => {
      expect(evaluateIntervalMs(1)).toBe(1_000);
      expect(evaluateIntervalMs(999)).toBe(1_000);
    });

    it("non-finite input falls through to the max bucket", () => {
      // `scope.range` is null-checked before subtraction, but a caller doing
      // its own arithmetic can produce NaN from an invalid Date. NaN loses
      // every `<` comparison, so without the guard the loop would fall through
      // anyway — this pins that the answer is deliberate, not incidental.
      expect(evaluateIntervalMs(Number.NaN)).toBe(MAX_INTERVAL_MS);
      expect(evaluateIntervalMs(Number.POSITIVE_INFINITY)).toBe(
        MAX_INTERVAL_MS,
      );
      expect(evaluateIntervalMs(Number.NEGATIVE_INFINITY)).toBe(
        MAX_INTERVAL_MS,
      );
    });
  });

  describe("shape of the function", () => {
    it("never decreases as the duration grows", () => {
      // Monotonicity is the property a chart depends on: a longer range must
      // never produce a finer bucket, or the point count explodes.
      const samples: number[] = [];
      for (const { thresholdMinutes } of LADDER) {
        for (const offset of [-1, 0, 1]) {
          samples.push(thresholdMinutes * MINUTE_MS + offset);
        }
      }
      samples.push(Number.MAX_SAFE_INTEGER);

      const results = samples.map(evaluateIntervalMs);
      expect(results).toEqual([...results].sort((a, b) => a - b));
    });

    it("returns a whole number of seconds for every rung", () => {
      // The chart route does `Math.floor(bucketMs / 1000)` to build a Postgres
      // interval; a bucket that is not a whole second would be truncated.
      const everyBucket = [
        ...LADDER.map((rung) => rung.intervalMs),
        MAX_INTERVAL_MS,
      ];
      for (const bucket of everyBucket) {
        expect(bucket % 1_000).toBe(0);
      }
    });
  });
});
