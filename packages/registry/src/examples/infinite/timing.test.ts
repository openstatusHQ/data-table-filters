import { describe, expect, it } from "vitest";
import {
  getTimingPercentage,
  getTimingShare,
  pickTiming,
  TIMING_PHASES,
  type Timing,
} from "./timing";

const timing: Timing = {
  "timing.dns": 10,
  "timing.connection": 20,
  "timing.tls": 30,
  "timing.ttfb": 35,
  "timing.transfer": 5,
};

describe("getTimingShare", () => {
  it("is the phase's percentage of the latency", () => {
    expect(getTimingShare(timing, "timing.dns", 100)).toBe(10);
    expect(getTimingShare(timing, "timing.ttfb", 100)).toBe(35);
  });

  it("is 0 rather than NaN or Infinity when there is no latency", () => {
    // A bar's `width: NaN%` is invalid CSS; the browser drops the rule.
    expect(getTimingShare(timing, "timing.dns", 0)).toBe(0);
    expect(getTimingShare(timing, "timing.dns", -1)).toBe(0);
  });
});

describe("getTimingPercentage", () => {
  it("formats each phase's share to one decimal", () => {
    const out = getTimingPercentage(timing, 100);
    expect(out["timing.dns"]).toBe("10.0%");
    expect(out["timing.transfer"]).toBe("5.0%");
  });

  it("shows tiny shares as <1% rather than 0.x%", () => {
    expect(getTimingPercentage(timing, 10_000)["timing.transfer"]).toBe("<1%");
  });

  it("shows 0.0% for every phase when there is no latency", () => {
    const out = getTimingPercentage(timing, 0);
    for (const phase of TIMING_PHASES) expect(out[phase]).toBe("0.0%");
  });
});

describe("pickTiming", () => {
  it("reads the flat dotted keys and fills a missing phase with 0", () => {
    expect(pickTiming({ "timing.dns": 4 })).toEqual({
      "timing.dns": 4,
      "timing.connection": 0,
      "timing.tls": 0,
      "timing.ttfb": 0,
      "timing.transfer": 0,
    });
  });
});
