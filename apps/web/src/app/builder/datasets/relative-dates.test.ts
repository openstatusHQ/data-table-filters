import { describe, expect, it } from "vitest";
import { patchDates } from "./relative-dates";

describe("patchDates", () => {
  it("assigns ISO date strings to the specified field", () => {
    const data = [
      { id: 1, ts: "" },
      { id: 2, ts: "" },
    ];
    patchDates(data, "ts");
    for (const item of data) {
      expect(typeof item.ts).toBe("string");
      expect(new Date(item.ts).toISOString()).toBe(item.ts);
    }
  });

  it("produces dates in descending order (newest first)", () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ i, d: "" }));
    patchDates(data, "d");
    for (let i = 1; i < data.length; i++) {
      expect(new Date(data[i - 1].d).getTime()).toBeGreaterThan(
        new Date(data[i].d).getTime(),
      );
    }
  });

  it("produces dates within the last ~60 days", () => {
    const data = Array.from({ length: 10 }, () => ({ d: "" }));
    const before = Date.now();
    patchDates(data, "d");

    const sixtyOneDaysMs = 61 * 24 * 60 * 60 * 1000;
    for (const item of data) {
      const ts = new Date(item.d).getTime();
      expect(ts).toBeLessThanOrEqual(before);
      expect(ts).toBeGreaterThan(before - sixtyOneDaysMs);
    }
  });

  it("does not produce future dates", () => {
    const data = Array.from({ length: 100 }, () => ({ d: "" }));
    patchDates(data, "d");
    const now = Date.now();
    for (const item of data) {
      expect(new Date(item.d).getTime()).toBeLessThanOrEqual(now);
    }
  });

  it("is deterministic (same output for same input)", () => {
    const a = Array.from({ length: 5 }, () => ({ d: "" }));
    const b = Array.from({ length: 5 }, () => ({ d: "" }));
    patchDates(a, "d");
    patchDates(b, "d");
    for (let i = 0; i < a.length; i++) {
      expect(a[i].d).toBe(b[i].d);
    }
  });

  it("produces different jitter for different field names", () => {
    const a = Array.from({ length: 5 }, () => ({ a: "", b: "" }));
    const b = Array.from({ length: 5 }, () => ({ a: "", b: "" }));
    patchDates(a, "a");
    patchDates(b, "b");
    // At least one date should differ (different seed per field name)
    const aDates = a.map((x) => x.a);
    const bDates = b.map((x) => x.b);
    expect(aDates).not.toEqual(bDates);
  });

  it("handles empty array without error", () => {
    const data: { d: string }[] = [];
    expect(() => patchDates(data, "d")).not.toThrow();
  });

  it("handles single-element array", () => {
    const data = [{ d: "" }];
    patchDates(data, "d");
    expect(new Date(data[0].d).toISOString()).toBe(data[0].d);
    expect(new Date(data[0].d).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
