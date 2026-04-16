import { describe, expect, it } from "vitest";
import {
  getTimingColor,
  getTimingLabel,
  getTimingPercentage,
  type TimingPhase,
} from "./timing";

describe("getTimingColor", () => {
  it("returns emerald for DNS", () => {
    expect(getTimingColor("timing.dns")).toBe("bg-emerald-500");
  });

  it("returns cyan for connection", () => {
    expect(getTimingColor("timing.connection")).toBe("bg-cyan-500");
  });

  it("returns blue for TLS", () => {
    expect(getTimingColor("timing.tls")).toBe("bg-blue-500");
  });

  it("returns violet for TTFB", () => {
    expect(getTimingColor("timing.ttfb")).toBe("bg-violet-500");
  });

  it("returns purple for transfer", () => {
    expect(getTimingColor("timing.transfer")).toBe("bg-purple-500");
  });

  it("returns gray for unknown", () => {
    expect(getTimingColor("unknown" as TimingPhase)).toBe("bg-gray-500");
  });
});

describe("getTimingLabel", () => {
  it("maps dns to DNS", () => {
    expect(getTimingLabel("timing.dns")).toBe("DNS");
  });

  it("maps connection to Connection", () => {
    expect(getTimingLabel("timing.connection")).toBe("Connection");
  });

  it("maps tls to TLS", () => {
    expect(getTimingLabel("timing.tls")).toBe("TLS");
  });

  it("maps ttfb to TTFB", () => {
    expect(getTimingLabel("timing.ttfb")).toBe("TTFB");
  });

  it("maps transfer to Transfer", () => {
    expect(getTimingLabel("timing.transfer")).toBe("Transfer");
  });

  it("returns Unknown for unrecognized phase", () => {
    expect(getTimingLabel("unknown" as TimingPhase)).toBe("Unknown");
  });
});

describe("getTimingPercentage", () => {
  it("calculates percentages for each phase", () => {
    const timing = {
      "timing.dns": 10,
      "timing.connection": 20,
      "timing.tls": 30,
      "timing.ttfb": 40,
      "timing.transfer": 100,
    };
    const result = getTimingPercentage(timing, 200);
    expect(result["timing.dns"]).toBe("5.0%");
    expect(result["timing.connection"]).toBe("10.0%");
    expect(result["timing.transfer"]).toBe("50.0%");
  });

  it("returns '<1%' for very small values", () => {
    // pValue = Math.round((1 / 1000) * 1000) / 1000 = 0.001
    // regex /^0\.00[0-9]+/ matches "0.001" → "<1%"
    const timing = {
      "timing.dns": 1,
      "timing.connection": 0,
      "timing.tls": 0,
      "timing.ttfb": 0,
      "timing.transfer": 999,
    };
    const result = getTimingPercentage(timing, 1000);
    expect(result["timing.dns"]).toBe("<1%");
  });

  it("handles zero latency phases", () => {
    const timing = {
      "timing.dns": 0,
      "timing.connection": 0,
      "timing.tls": 0,
      "timing.ttfb": 100,
      "timing.transfer": 0,
    };
    const result = getTimingPercentage(timing, 100);
    expect(result["timing.dns"]).toBe("0.0%");
    expect(result["timing.ttfb"]).toBe("100.0%");
  });
});
