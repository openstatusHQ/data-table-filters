import { describe, expect, it } from "vitest";
import {
  formatCompactNumber,
  formatDate,
  formatLatency,
  formatMilliseconds,
} from "./format";

// ── formatLatency ─────────────────────────────────────────────────────────────

describe("formatLatency", () => {
  it("formats values below 1000ms with 'ms' suffix", () => {
    expect(formatLatency(500)).toBe("500ms");
    expect(formatLatency(0)).toBe("0ms");
    expect(formatLatency(999)).toBe("999ms");
  });

  it("formats fractional ms values up to 3 decimal places", () => {
    expect(formatLatency(0.5)).toBe("0.5ms");
    expect(formatLatency(1.234)).toBe("1.234ms");
  });

  it("formats values >= 1000ms as seconds with exactly one decimal place", () => {
    expect(formatLatency(1000)).toBe("1.0s");
    expect(formatLatency(1500)).toBe("1.5s");
    expect(formatLatency(2000)).toBe("2.0s");
    expect(formatLatency(10000)).toBe("10.0s");
  });

  it("formats values just at the 1000ms boundary", () => {
    expect(formatLatency(1000)).toBe("1.0s");
  });
});

// ── formatMilliseconds ────────────────────────────────────────────────────────

describe("formatMilliseconds", () => {
  it("formats zero", () => {
    expect(formatMilliseconds(0)).toBe("0");
  });

  it("formats whole numbers with thousands separator", () => {
    expect(formatMilliseconds(1000)).toBe("1,000");
    expect(formatMilliseconds(10000)).toBe("10,000");
  });

  it("formats fractional values up to 3 decimal places", () => {
    expect(formatMilliseconds(1.5)).toBe("1.5");
    expect(formatMilliseconds(1.234)).toBe("1.234");
  });

  it("drops trailing zeros beyond the significant digits", () => {
    expect(formatMilliseconds(1.1)).toBe("1.1");
  });
});

// ── formatDate ────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a Date object as 'MMM dd, yyyy HH:mm'", () => {
    // Use constructor with local-time args to avoid timezone-dependent parsing
    const date = new Date(2024, 0, 15, 14, 30); // Jan 15 2024 14:30 local time
    expect(formatDate(date)).toBe("Jan 15, 2024 14:30");
  });

  it("pads single-digit day with a leading zero", () => {
    const date = new Date(2024, 5, 5, 9, 5); // Jun 05 2024 09:05 local time
    expect(formatDate(date)).toBe("Jun 05, 2024 09:05");
  });

  it("accepts a date string without explicit timezone (parsed as local time)", () => {
    // ISO string without timezone → parsed as local time → formatted as local time
    const result = formatDate("2024-03-20T08:00:00");
    expect(result).toBe("Mar 20, 2024 08:00");
  });
});

// ── formatCompactNumber ───────────────────────────────────────────────────────

describe("formatCompactNumber", () => {
  it("returns the value as a string for numbers below 100", () => {
    expect(formatCompactNumber(0)).toBe("0");
    expect(formatCompactNumber(1)).toBe("1");
    expect(formatCompactNumber(99)).toBe("99");
  });

  it("returns the value as a string for numbers in the hundreds (100–999)", () => {
    expect(formatCompactNumber(100)).toBe("100");
    expect(formatCompactNumber(500)).toBe("500");
    expect(formatCompactNumber(999)).toBe("999");
  });

  it("formats thousands with a 'k' suffix rounded to one decimal", () => {
    expect(formatCompactNumber(1000)).toBe("1.0k");
    expect(formatCompactNumber(1500)).toBe("1.5k");
    expect(formatCompactNumber(5000)).toBe("5.0k");
    expect(formatCompactNumber(250000)).toBe("250.0k");
  });

  it("formats millions with an 'M' suffix rounded to one decimal", () => {
    expect(formatCompactNumber(1000000)).toBe("1.0M");
    expect(formatCompactNumber(2500000)).toBe("2.5M");
    expect(formatCompactNumber(10000000)).toBe("10.0M");
  });
});
