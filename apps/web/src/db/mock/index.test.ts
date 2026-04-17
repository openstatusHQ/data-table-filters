import { REGIONS } from "@/constants/region";
import { describe, expect, it } from "vitest";
import { createMockLogs } from "./index";

describe("createMockLogs", () => {
  it("returns 6 rows (one per region)", () => {
    const rows = createMockLogs({ minutes: 0 });
    expect(rows).toHaveLength(6);
  });

  it("produces one row per region", () => {
    const rows = createMockLogs({ minutes: 0 });
    const regions = rows.map((r) => r.regions[0]);
    expect(regions).toEqual(expect.arrayContaining([...REGIONS]));
    expect(new Set(regions).size).toBe(6);
  });

  it("all rows share the same date", () => {
    const rows = createMockLogs({ minutes: 0 });
    const dates = rows.map((r) => r.date.getTime());
    expect(new Set(dates).size).toBe(1);
  });

  it("all rows share the same method/host/pathname", () => {
    const rows = createMockLogs({ minutes: 0 });
    expect(new Set(rows.map((r) => r.method)).size).toBe(1);
    expect(new Set(rows.map((r) => r.host)).size).toBe(1);
    expect(new Set(rows.map((r) => r.pathname)).size).toBe(1);
  });

  it("each row has a unique uuid", () => {
    const rows = createMockLogs({ minutes: 0 });
    const uuids = rows.map((r) => r.uuid);
    expect(new Set(uuids).size).toBe(6);
  });

  it("status is one of 200, 400, 404, 500", () => {
    const rows = createMockLogs({ minutes: 0 });
    for (const row of rows) {
      expect([200, 400, 404, 500]).toContain(row.status);
    }
  });

  it("level matches status code", () => {
    const rows = createMockLogs({ minutes: 0 });
    for (const row of rows) {
      if (row.status === 200) expect(row.level).toBe("success");
      else if (row.status === 400 || row.status === 404)
        expect(row.level).toBe("warning");
      else expect(row.level).toBe("error");
    }
  });

  it("message is set only for 500 status", () => {
    const rows = createMockLogs({ minutes: 0 });
    for (const row of rows) {
      if (row.status === 500) {
        expect(row.message).toBeDefined();
      } else {
        expect(row.message).toBeUndefined();
      }
    }
  });

  it("timing values sum approximately to latency", () => {
    const rows = createMockLogs({ minutes: 0 });
    for (const row of rows) {
      const sum =
        row["timing.dns"] +
        row["timing.connection"] +
        row["timing.tls"] +
        row["timing.ttfb"] +
        row["timing.transfer"];
      // Allow ±5 for rounding
      expect(Math.abs(sum - row.latency)).toBeLessThanOrEqual(5);
    }
  });

  it("date is in the past when minutes > 0", () => {
    const before = Date.now();
    const rows = createMockLogs({ minutes: 10 });
    expect(rows[0].date.getTime()).toBeLessThan(before);
  });

  it("method is GET or POST", () => {
    const rows = createMockLogs({ minutes: 0 });
    expect(["GET", "POST"]).toContain(rows[0].method);
  });
});
