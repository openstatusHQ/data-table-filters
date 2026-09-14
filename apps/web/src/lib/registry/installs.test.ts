import { describe, expect, it } from "vitest";
import {
  blockFromPath,
  classifyClient,
  installEvent,
  installSummary,
  KEYS,
  recentDays,
  recordInstall,
  runFingerprint,
  type CounterPipeline,
  type SummaryStore,
} from "./installs";

const at = new Date("2026-09-14T10:15:00Z");

describe("blockFromPath", () => {
  it("names the block behind a registry file", () => {
    expect(blockFromPath("/r/data-table.json")).toBe("data-table");
    expect(blockFromPath("/r/data-table-filter-command-ai.json")).toBe(
      "data-table-filter-command-ai",
    );
  });

  it("ignores the manifest, the index, and everything else", () => {
    expect(blockFromPath("/r/registry.json")).toBeNull();
    expect(blockFromPath("/r/index.md")).toBeNull();
    expect(blockFromPath("/r/")).toBeNull();
    expect(blockFromPath("/docs/quick-start")).toBeNull();
    expect(blockFromPath("/r/data-table.json/extra")).toBeNull();
  });
});

describe("classifyClient", () => {
  it("treats browsers as readers, everything else as installers", () => {
    expect(classifyClient("Mozilla/5.0 (Macintosh) Safari/605.1")).toBe(
      "browser",
    );
    expect(classifyClient("node")).toBe("cli");
    expect(classifyClient("undici")).toBe("cli");
    expect(classifyClient("curl/8.4.0")).toBe("cli");
    expect(classifyClient(null)).toBe("cli");
  });
});

describe("runFingerprint", () => {
  const base = { ip: "203.0.113.7", userAgent: "node", at };

  it("is stable for one address within the hour", () => {
    expect(runFingerprint(base)).toBe(
      runFingerprint({ ...base, at: new Date("2026-09-14T10:59:59Z") }),
    );
  });

  it("changes with the hour, the address, or the client", () => {
    const fingerprint = runFingerprint(base);
    expect(
      runFingerprint({ ...base, at: new Date("2026-09-14T11:00:00Z") }),
    ).not.toBe(fingerprint);
    expect(runFingerprint({ ...base, ip: "203.0.113.8" })).not.toBe(
      fingerprint,
    );
    expect(runFingerprint({ ...base, userAgent: "curl/8" })).not.toBe(
      fingerprint,
    );
  });

  it("is a truncated hash, not the address", () => {
    const fingerprint = runFingerprint(base);
    expect(fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprint).not.toContain("203");
  });
});

describe("installEvent", () => {
  it("describes a CLI fetch of a block", () => {
    expect(
      installEvent({
        pathname: "/r/data-table-schema.json",
        userAgent: "node",
        ip: "203.0.113.7",
        at,
      }),
    ).toEqual({
      block: "data-table-schema",
      client: "cli",
      day: "2026-09-14",
      fingerprint: runFingerprint({ ip: "203.0.113.7", userAgent: "node", at }),
    });
  });

  it("is null for anything that is not a block", () => {
    expect(
      installEvent({ pathname: "/r/index.md", userAgent: null, ip: "", at }),
    ).toBeNull();
  });
});

function fakePipeline() {
  const commands: string[] = [];
  const pipeline: CounterPipeline = {
    incr: (key) => commands.push(`INCR ${key}`),
    pfadd: (key, ...members) =>
      commands.push(`PFADD ${key} ${members.join(" ")}`),
    exec: async () => commands,
  };
  return { commands, store: { pipeline: () => pipeline } };
}

describe("recordInstall", () => {
  it("counts a CLI fetch per block, per day, and as a run", async () => {
    const { commands, store } = fakePipeline();

    await recordInstall(store, {
      block: "data-table",
      client: "cli",
      day: "2026-09-14",
      fingerprint: "abc123",
    });

    expect(commands).toEqual([
      "INCR installs:block:data-table:2026-09-14",
      "INCR installs:block:data-table",
      "INCR installs:client:cli:2026-09-14",
      "PFADD installs:runs:2026-09-14 abc123",
    ]);
  });

  it("counts a browser hit without calling it a run", async () => {
    const { commands, store } = fakePipeline();

    await recordInstall(store, {
      block: "data-table",
      client: "browser",
      day: "2026-09-14",
      fingerprint: "abc123",
    });

    expect(commands).not.toContainEqual(expect.stringContaining("PFADD"));
    expect(commands).toContain("INCR installs:client:browser:2026-09-14");
  });
});

describe("recentDays", () => {
  it("ends today and runs oldest first, across a month boundary", () => {
    expect(recentDays(new Date("2026-09-02T23:00:00Z"), 3)).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });
});

describe("installSummary", () => {
  it("assembles per-block series, totals, clients, and runs", async () => {
    const values: Record<string, unknown> = {
      [KEYS.block("data-table", "2026-09-13")]: "4",
      [KEYS.block("data-table", "2026-09-14")]: 6,
      [KEYS.block("data-table-schema", "2026-09-14")]: "2",
      [KEYS.blockTotal("data-table")]: "120",
      [KEYS.client("cli", "2026-09-14")]: "7",
      [KEYS.client("browser", "2026-09-13")]: "1",
    };
    const runs: Record<string, number> = {
      [KEYS.runs("2026-09-13")]: 3,
      [KEYS.runs("2026-09-14")]: 5,
    };
    const store: SummaryStore = {
      mget: async <T extends unknown[]>(...keys: string[]) =>
        keys.map((key) => values[key] ?? null) as T,
      pfcount: async (key: string) => runs[key] ?? 0,
    };

    const summary = await installSummary(store, {
      blocks: ["data-table", "data-table-schema"],
      today: at,
      days: 2,
    });

    expect(summary).toEqual({
      days: ["2026-09-13", "2026-09-14"],
      runs: [3, 5],
      clients: { cli: [0, 7], browser: [1, 0] },
      blocks: [
        { name: "data-table", total: 120, byDay: [4, 6], window: 10 },
        { name: "data-table-schema", total: 0, byDay: [0, 2], window: 2 },
      ],
    });
  });
});
