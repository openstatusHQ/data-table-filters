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
  type SummaryPipeline,
  type SummaryStore,
} from "./installs";

const at = new Date("2026-09-14T10:15:00Z");

const BLOCKS = new Set([
  "data-table",
  "data-table-schema",
  "data-table-filter-command-ai",
]);

describe("blockFromPath", () => {
  it("names the block behind a registry file", () => {
    expect(blockFromPath("/r/data-table.json", BLOCKS)).toBe("data-table");
    expect(blockFromPath("/r/data-table-filter-command-ai.json", BLOCKS)).toBe(
      "data-table-filter-command-ai",
    );
  });

  it("ignores the manifest, the index, and everything else", () => {
    expect(blockFromPath("/r/registry.json", BLOCKS)).toBeNull();
    expect(blockFromPath("/r/index.md", BLOCKS)).toBeNull();
    expect(blockFromPath("/r/", BLOCKS)).toBeNull();
    expect(blockFromPath("/docs/quick-start", BLOCKS)).toBeNull();
    expect(blockFromPath("/r/data-table.json/extra", BLOCKS)).toBeNull();
  });

  it("ignores a well-formed path that is not in the manifest", () => {
    // `/r/data-tabel.json` is a 404, and the proxy never sees the status.
    expect(blockFromPath("/r/data-tabel.json", BLOCKS)).toBeNull();
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
  const fetch = {
    method: "GET",
    pathname: "/r/data-table-schema.json",
    userAgent: "node",
    ip: "203.0.113.7",
    at,
    blocks: BLOCKS,
  };

  it("describes a CLI fetch of a block", () => {
    expect(installEvent(fetch)).toEqual({
      block: "data-table-schema",
      client: "cli",
      day: "2026-09-14",
      fingerprint: runFingerprint({ ip: "203.0.113.7", userAgent: "node", at }),
    });
  });

  it("is null for anything that is not a block", () => {
    expect(installEvent({ ...fetch, pathname: "/r/index.md" })).toBeNull();
    expect(installEvent({ ...fetch, pathname: "/r/nope.json" })).toBeNull();
  });

  it("is null for anything that is not a download", () => {
    expect(installEvent({ ...fetch, method: "HEAD" })).toBeNull();
    expect(installEvent({ ...fetch, method: "OPTIONS" })).toBeNull();
  });
});

function fakePipeline() {
  const commands: string[] = [];
  const executed: string[][] = [];
  const pipeline: CounterPipeline = {
    incr: (key) => commands.push(`INCR ${key}`),
    pfadd: (key, ...members) =>
      commands.push(`PFADD ${key} ${members.join(" ")}`),
    exec: async () => {
      executed.push([...commands]);
      return commands;
    },
  };
  return { commands, executed, store: { pipeline: () => pipeline } };
}

describe("recordInstall", () => {
  it("counts a CLI fetch per block, per day, and as a run", async () => {
    const { commands, executed, store } = fakePipeline();

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
    // Queued is not persisted: the pipeline has to be sent, once, in full.
    expect(executed).toEqual([commands]);
  });

  it("counts a browser hit without calling it a run", async () => {
    const { commands, executed, store } = fakePipeline();

    await recordInstall(store, {
      block: "data-table",
      client: "browser",
      day: "2026-09-14",
      fingerprint: "abc123",
    });

    expect(commands).not.toContainEqual(expect.stringContaining("PFADD"));
    expect(commands).toContain("INCR installs:client:browser:2026-09-14");
    expect(executed).toHaveLength(1);
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

/**
 * A store that answers from `values` (counters) and `runs` (HyperLogLogs),
 * and records how many round trips it took.
 */
function fakeSummaryStore(
  values: Record<string, unknown>,
  runs: Record<string, number>,
) {
  const roundTrips: string[][] = [];
  const store: SummaryStore = {
    pipeline: () => {
      const queued: (() => unknown)[] = [];
      const commands: string[] = [];
      const pipeline: SummaryPipeline = {
        mget: (...keys) => {
          commands.push(`MGET ${keys.join(" ")}`);
          queued.push(() => keys.map((key) => values[key] ?? null));
        },
        pfcount: (...keys) => {
          commands.push(`PFCOUNT ${keys.join(" ")}`);
          queued.push(() =>
            keys.reduce((sum, key) => sum + (runs[key] ?? 0), 0),
          );
        },
        exec: async () => {
          roundTrips.push(commands);
          return queued.map((answer) => answer());
        },
      };
      return pipeline;
    },
  };
  return { store, roundTrips };
}

describe("installSummary", () => {
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

  it("assembles per-block series, totals, clients, and runs", async () => {
    const { store } = fakeSummaryStore(values, runs);

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

  it("asks in one round trip, one PFCOUNT per day", async () => {
    const { store, roundTrips } = fakeSummaryStore(values, runs);

    await installSummary(store, {
      blocks: ["data-table"],
      today: at,
      days: 90,
    });

    expect(roundTrips).toHaveLength(1);
    const commands = roundTrips[0];
    expect(commands.filter((c) => c.startsWith("MGET"))).toHaveLength(3);
    expect(commands.filter((c) => c.startsWith("PFCOUNT"))).toHaveLength(90);
    // Per day, not the union: each PFCOUNT names exactly one key.
    expect(commands.filter((c) => c.startsWith("PFCOUNT"))).toEqual(
      recentDays(at, 90).map((day) => `PFCOUNT ${KEYS.runs(day)}`),
    );
  });

  it("asks nothing when there is nothing to ask for", async () => {
    const { store, roundTrips } = fakeSummaryStore(values, runs);

    expect(
      await installSummary(store, { blocks: [], today: at, days: 7 }),
    ).toEqual({
      days: recentDays(at, 7),
      runs: [],
      clients: { cli: [], browser: [] },
      blocks: [],
    });
    expect(roundTrips).toEqual([]);
  });
});
