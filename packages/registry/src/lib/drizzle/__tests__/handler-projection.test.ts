import { defineFilters, type FilterSpec } from "@dtf/registry/lib/filters";
import { count, sql, type SQL } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it } from "vitest";
import { createDrizzleHandler } from "../handler";
import { evaluateIntervalMs } from "../interval";
import type { ColumnMapping } from "../types";
import { createPgliteDb, type PgliteDb } from "./pglite";

/**
 * `createDrizzleHandler` projects with `columnMapping`, against real Postgres.
 *
 * ## Why this suite exists, and why it is ungated
 *
 * Two consumers used to hand-write the inverse of `columnMapping` to turn
 * Drizzle's property-keyed rows (`timingDns`) back into schema-keyed ones
 * (`"timing.dns"`). The two copies had already drifted — the MCP one silently
 * dropped `headers`. Deleting both is only safe if something proves the
 * projection is faithful for *every* mapped key, which is what the first block
 * below does.
 *
 * The table here is built so the two name spaces genuinely differ: `"timing.dns"`
 * maps to the SQL column `timing_dns`, and the cursor key `"date"` maps to
 * `created_at`. A test whose keys happen to equal their column names cannot see
 * the bug class this file exists for.
 *
 * PGLite is Postgres compiled to WASM, so nothing here is skipped. The
 * node-postgres suites in `apps/web` remain tier 2 against a real server in CI.
 */

const events = pgTable("projection_events", {
  id: integer("id").primaryKey(),
  label: text("label").notNull(),
  // `text`, not a pg enum — the filter semantics under test are the same and a
  // real enum would reject "no such level" at the protocol level.
  level: text("level").notNull(),
  host: text("host").notNull(),
  status: integer("status").notNull(),
  latency: integer("latency").notNull(),
  regions: text("regions").array().notNull(),
  /** SQL name `created_at`, schema key `date`. The names must not coincide. */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  /** SQL name `timing_dns`, schema key `"timing.dns"`. */
  timingDns: integer("timing_dns").notNull(),
  headers: jsonb("headers").$type<Record<string, string>>().notNull(),
  message: text("message"),
});

/**
 * Every key is dotted, snake_cased, or both — deliberately.
 *
 * `label` is mapped but never filtered, which is legal and has to keep working:
 * the mapping is the projection, not the filter list.
 */
const columnMapping: ColumnMapping = {
  label: events.label,
  level: events.level,
  host: events.host,
  status: events.status,
  latency: events.latency,
  regions: events.regions,
  date: events.createdAt,
  "timing.dns": events.timingDns,
};

const specs: readonly FilterSpec[] = [
  { key: "level", type: "checkbox", kind: "enum" },
  { key: "status", type: "checkbox", kind: "number" },
  { key: "host", type: "input", kind: "string" },
  { key: "latency", type: "slider", kind: "number", min: 0, max: 5000 },
  { key: "regions", type: "checkbox", kind: "array", itemKind: "enum" },
  { key: "date", type: "timerange", kind: "timestamp" },
  { key: "timing.dns", type: "slider", kind: "number", min: 0, max: 5000 },
];

const filters = defineFilters(specs);

/** Fields outside `columnMapping` that the wire contract still needs. */
const extraSelect = {
  id: events.id,
  headers: events.headers,
  message: events.message,
};

type SeedRow = {
  id: number;
  label: string;
  level: string;
  host: string;
  status: number;
  latency: number;
  regions: string[];
  createdAt: Date;
  timingDns: number;
  headers: Record<string, string>;
  message: string | null;
};

const BASE_DATE = new Date("2025-01-15T12:00:00Z");
function hoursAgo(hours: number): Date {
  return new Date(BASE_DATE.getTime() - hours * 60 * 60 * 1000);
}

const seedRows: readonly SeedRow[] = [
  {
    id: 1,
    label: "A",
    level: "success",
    host: "api.example.com",
    status: 200,
    latency: 50,
    regions: ["us-east-1", "eu-west-1"],
    createdAt: hoursAgo(1),
    timingDns: 5,
    headers: { "content-type": "application/json" },
    message: "OK",
  },
  {
    id: 2,
    label: "B",
    level: "success",
    host: "api.example.com",
    status: 201,
    latency: 120,
    regions: ["us-east-1"],
    createdAt: hoursAgo(2),
    timingDns: 6,
    headers: { "content-type": "application/json" },
    message: "Created",
  },
  {
    id: 3,
    label: "C",
    level: "warning",
    host: "cdn.example.com",
    status: 301,
    latency: 200,
    regions: ["eu-west-1", "ap-south-1"],
    createdAt: hoursAgo(3),
    timingDns: 10,
    headers: { "content-type": "text/html" },
    message: "Redirect",
  },
  {
    id: 4,
    label: "D",
    level: "error",
    host: "api.example.com",
    status: 500,
    latency: 900,
    regions: ["us-east-1"],
    createdAt: hoursAgo(4),
    timingDns: 25,
    headers: { "content-type": "application/json" },
    // Nullable, and left null: the deleted remaps coerced this to `undefined`,
    // so the projection has to be pinned on the value it actually returns.
    message: null,
  },
  {
    id: 5,
    label: "E",
    level: "error",
    host: "api.example.com",
    status: 404,
    latency: 450,
    regions: ["ap-south-1"],
    createdAt: hoursAgo(5),
    timingDns: 18,
    headers: { "content-type": "application/json" },
    message: "Not Found",
  },
  {
    id: 6,
    label: "F",
    level: "success",
    host: "web.example.com",
    status: 200,
    latency: 75,
    regions: ["eu-west-1"],
    createdAt: hoursAgo(6),
    timingDns: 7,
    headers: { "content-type": "application/json" },
    message: "OK",
  },
  {
    id: 7,
    label: "G",
    level: "error",
    host: "cdn.example.com",
    status: 429,
    latency: 300,
    regions: ["us-east-1", "ap-south-1"],
    createdAt: hoursAgo(7),
    timingDns: 15,
    headers: { "content-type": "text/html" },
    message: "Too Many Requests",
  },
  {
    id: 8,
    label: "H",
    level: "success",
    host: "api.example.com",
    status: 200,
    latency: 60,
    regions: ["eu-west-1"],
    createdAt: hoursAgo(8),
    timingDns: 4,
    headers: { "content-type": "application/json" },
    message: "OK",
  },
];

const CREATE_TABLE = sql`
  CREATE TABLE projection_events (
    id integer PRIMARY KEY,
    label text NOT NULL,
    level text NOT NULL,
    host text NOT NULL,
    status integer NOT NULL,
    latency integer NOT NULL,
    regions text[] NOT NULL,
    created_at timestamptz NOT NULL,
    timing_dns integer NOT NULL,
    headers jsonb NOT NULL,
    message text
  )
`;

/** A fresh, fully isolated database holding exactly `rows`. */
async function createSeededDb(rows: readonly SeedRow[]): Promise<PgliteDb> {
  const db = createPgliteDb();
  await db.execute(CREATE_TABLE);
  await db.insert(events).values(rows.map((row) => ({ ...row })));
  return db;
}

function createHandler(
  db: PgliteDb,
  overrides: Partial<Parameters<typeof createDrizzleHandler>[0]> = {},
) {
  return createDrizzleHandler({
    db,
    table: events,
    filters,
    columnMapping,
    cursorColumn: "date",
    select: extraSelect,
    ...overrides,
  });
}

/** Count rows matching a composed WHERE, straight from the database. */
async function countWhere(db: PgliteDb, where: SQL | undefined) {
  const result = await db.select({ total: count() }).from(events).where(where);
  return result[0]?.total ?? 0;
}

/**
 * One database for the read-only suites over `seedRows`.
 *
 * Each PGLite instance boots a Postgres compiled to WASM, which costs seconds
 * on a CI runner. These suites only read, so they share one boot instead of
 * paying for four; the suite below that seeds `tieRows` still gets its own.
 */
let db: PgliteDb;
beforeAll(async () => {
  db = await createSeededDb(seedRows);
});

// ── 1. Projection identity ──────────────────────────────────────────────────

describe("projection identity — every mapped key survives the round trip", () => {
  /**
   * The schema key → seed field correspondence, written out by hand.
   *
   * This is the assertion, not a convenience: it is the same table the deleted
   * remaps encoded, restated once so a projection that silently renames or
   * drops a key has somewhere to fail.
   */
  const expectedFrom: Record<string, (row: SeedRow) => unknown> = {
    label: (row) => row.label,
    level: (row) => row.level,
    host: (row) => row.host,
    status: (row) => row.status,
    latency: (row) => row.latency,
    regions: (row) => row.regions,
    date: (row) => row.createdAt,
    "timing.dns": (row) => row.timingDns,
  };

  it("covers every key in columnMapping — a new mapped key fails here", () => {
    // Without this, adding a column to the mapping would silently go untested.
    expect(Object.keys(expectedFrom).sort()).toEqual(
      Object.keys(columnMapping).sort(),
    );
  });

  it("the mapping's key space genuinely differs from the SQL name space", () => {
    // The precondition for everything below. If these ever coincide, the suite
    // still passes but stops testing anything.
    expect(events.createdAt.name).toBe("created_at");
    expect(events.timingDns.name).toBe("timing_dns");
    expect(columnMapping.date.name).not.toBe("date");
    expect(columnMapping["timing.dns"].name).not.toBe("timing.dns");
  });

  it("returns each mapped key with the underlying column's value", async () => {
    const result = await createHandler(db).execute({ size: 50 });

    expect(result.data).toHaveLength(seedRows.length);

    for (const row of result.data) {
      const source = seedRows.find((seed) => seed.id === row.id);
      expect(source).toBeDefined();

      for (const [key, read] of Object.entries(expectedFrom)) {
        // `toHaveProperty` reads dots as a path, so `"timing.dns"` would look
        // for `row.timing.dns`. Own-key checks are the only honest form here.
        expect(Object.prototype.hasOwnProperty.call(row, key)).toBe(true);
        expect(row[key]).toEqual(read(source!));
      }
    }
  });

  it("keys a dotted schema key literally, not as a nested object", async () => {
    const result = await createHandler(db).execute({ size: 50 });
    const row = result.data[0];

    expect(Object.keys(row)).toContain("timing.dns");
    expect(row.timing).toBeUndefined();
    expect(typeof row["timing.dns"]).toBe("number");
  });

  it("never leaks a Drizzle property name into a row", async () => {
    const result = await createHandler(db).execute({ size: 50 });

    for (const row of result.data) {
      const keys = Object.keys(row);
      expect(keys).not.toContain("timingDns");
      expect(keys).not.toContain("createdAt");
      // …nor the raw SQL names.
      expect(keys).not.toContain("timing_dns");
      expect(keys).not.toContain("created_at");
    }
  });

  it("returns exactly the mapped keys plus the declared extras", async () => {
    const result = await createHandler(db).execute({ size: 50 });
    const expected = [
      ...Object.keys(columnMapping),
      ...Object.keys(extraSelect),
    ].sort();

    for (const row of result.data) {
      expect(Object.keys(row).sort()).toEqual(expected);
    }
  });

  it("preserves types Postgres round-trips — Date, array, jsonb, null", async () => {
    const result = await createHandler(db).execute({ size: 50 });
    const withNullMessage = result.data.find((row) => row.id === 4)!;
    const withTwoRegions = result.data.find((row) => row.id === 1)!;

    expect(withTwoRegions.date).toBeInstanceOf(Date);
    expect(withTwoRegions.regions).toEqual(["us-east-1", "eu-west-1"]);
    expect(withTwoRegions.headers).toEqual({
      "content-type": "application/json",
    });
    // The deleted remaps wrote `r.message ?? undefined`; the projection returns
    // the column's actual value.
    expect(withNullMessage.message).toBeNull();
  });

  it("projects the same keys on a filtered page as on an unfiltered one", async () => {
    const all = await createHandler(db).execute({ size: 50 });
    const filtered = await createHandler(db).execute({
      level: ["error"],
      size: 50,
    });

    expect(filtered.data.length).toBeGreaterThan(0);
    expect(filtered.data.length).toBeLessThan(all.data.length);
    expect(Object.keys(filtered.data[0]).sort()).toEqual(
      Object.keys(all.data[0]).sort(),
    );
  });
});

// ── 2. `select` extras ──────────────────────────────────────────────────────

describe("select extras", () => {
  it("merges extras into every row without requiring a mapping entry", async () => {
    for (const key of Object.keys(extraSelect)) {
      expect(columnMapping[key]).toBeUndefined();
    }

    const result = await createHandler(db).execute({ size: 50 });

    for (const row of result.data) {
      const source = seedRows.find((seed) => seed.id === row.id)!;
      expect(row.headers).toEqual(source.headers);
      expect(row.message).toEqual(source.message);
    }
  });

  it("accepts aliased SQL, not just columns", async () => {
    const result = await createHandler(db, {
      select: {
        ...extraSelect,
        // `Column | SQL.Aliased` — a computed field with no column behind it.
        latencyDoubled: sql<number>`(${events.latency} * 2)::int`.as(
          "latency_doubled",
        ),
      },
    }).execute({ size: 50 });

    for (const row of result.data) {
      const source = seedRows.find((seed) => seed.id === row.id)!;
      expect(row.latencyDoubled).toBe(source.latency * 2);
    }
  });

  it("is optional — omitting it yields exactly the mapped keys", async () => {
    const result = await createDrizzleHandler({
      db,
      table: events,
      filters,
      columnMapping,
      cursorColumn: "date",
    }).execute({ size: 50 });

    expect(result.data.length).toBe(seedRows.length);
    for (const row of result.data) {
      expect(Object.keys(row).sort()).toEqual(
        Object.keys(columnMapping).sort(),
      );
    }
  });

  it("lets an extra override a mapped key of the same name", async () => {
    // Documented consequence of `{...columnMapping, ...select}`: the extras win.
    // Worth pinning so a future reordering is a deliberate decision.
    const result = await createHandler(db, {
      select: { ...extraSelect, label: events.host },
    }).execute({ size: 50 });

    for (const row of result.data) {
      const source = seedRows.find((seed) => seed.id === row.id)!;
      expect(row.label).toBe(source.host);
    }
  });
});

// ── 3. Unmapped-key loudness ────────────────────────────────────────────────

describe("unmapped filter keys fail at construction", () => {
  const stubDb = createPgliteDb();

  /** Build a handler whose filters declare keys the mapping does not have. */
  function constructWithUnmapped(extra: readonly FilterSpec[]) {
    return () =>
      createDrizzleHandler({
        db: stubDb,
        table: events,
        filters: defineFilters([...specs, ...extra]),
        columnMapping,
        cursorColumn: "date",
        select: extraSelect,
      });
  }

  it("throws rather than silently not filtering", () => {
    // `buildWhereConditions` skips a key it cannot map, so before this check a
    // typo turned a filter into a no-op with no error and no failing test.
    expect(
      constructWithUnmapped([
        { key: "pathname", type: "input", kind: "string" },
      ]),
    ).toThrow(/pathname/);
  });

  it("names every missing key, and only the missing ones", () => {
    let message = "";
    try {
      constructWithUnmapped([
        { key: "pathname", type: "input", kind: "string" },
        { key: "timing.tls", type: "slider", kind: "number" },
      ])();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toBe("");
    expect(message).toContain("pathname");
    expect(message).toContain("timing.tls");
    // Mapped keys must not appear, or the message stops pointing anywhere.
    expect(message).not.toContain("latency");
    expect(message).not.toContain("regions");
  });

  it("is actionable — it says where to fix it and shows the line to add", () => {
    let message = "";
    try {
      constructWithUnmapped([
        { key: "timing.tls", type: "slider", kind: "number" },
      ])();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    // The name of the thing to edit…
    expect(message).toContain("columnMapping");
    // …and a paste-able line, with the dotted key already camel-cased.
    expect(message).toContain(`"timing.tls": table.timingTls,`);
    expect(message).toContain("createDrizzleHandler");
  });

  it("constructs cleanly when every filterable key is mapped", () => {
    expect(() =>
      createDrizzleHandler({
        db: stubDb,
        table: events,
        filters,
        columnMapping,
        cursorColumn: "date",
        select: extraSelect,
      }),
    ).not.toThrow();
  });

  it("still allows mapped keys that are not filterable", () => {
    // `label` is in the mapping and in no spec. The check runs specs → mapping,
    // never the reverse, because the mapping is also the projection.
    expect(filters.spec("label")).toBeUndefined();
    expect(columnMapping.label).toBeDefined();
    expect(() =>
      createDrizzleHandler({
        db: stubDb,
        table: events,
        filters,
        columnMapping,
        cursorColumn: "date",
      }),
    ).not.toThrow();
  });
});

// ── 4. Pagination when the cursor column's SQL name differs from its key ─────

/**
 * THE regression this file exists for.
 *
 * `getCursorValue` read `row[cursorCol.name]` — the SQL column name — while the
 * projection keys rows by schema key. For the demo table those coincide
 * (`date`/`date`), so nothing caught it. For any table where they differ, the
 * lookup returned `undefined`: `boundaryValue` was null, the whole tie-snapping
 * block was skipped, the `size + 1` probe row was returned as part of the page,
 * and `nextCursor` came back null — ending pagination after one page while
 * quietly dropping every remaining row.
 */
describe("cursor pagination with a renamed cursor column", () => {
  /** Walk forward until exhausted, recording each page. */
  async function pageThrough(size: number) {
    const handler = createHandler(db);
    const pages: string[][] = [];
    let cursor: number | null = null;

    for (let guard = 0; guard < 20; guard++) {
      const page = await handler.execute({
        size,
        direction: "next",
        ...(cursor === null ? {} : { cursor }),
      });
      if (page.data.length === 0) break;
      pages.push(page.data.map((row) => row.label as string));
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }

    return pages;
  }

  it("reads the cursor by schema key, not by SQL column name", async () => {
    const first = await createHandler(db).execute({ size: 3 });

    // Both symptoms of the old lookup, asserted directly:
    // the probe row leaked into the page, and the cursor was null.
    expect(first.data).toHaveLength(3);
    expect(first.nextCursor).not.toBeNull();
    expect(first.nextCursor).toBe(hoursAgo(3).getTime());
    expect(first.prevCursor).toBe(hoursAgo(1).getTime());
  });

  it("returns every row across pages, with no overlap and no loss", async () => {
    const pages = await pageThrough(3);

    const labels = pages.flat();
    expect(pages.length).toBeGreaterThan(1);
    expect(labels).toHaveLength(seedRows.length);
    expect(new Set(labels).size).toBe(seedRows.length);
    expect([...labels].sort()).toEqual(seedRows.map((row) => row.label).sort());
    // Newest-first, and the page boundaries do not reorder anything.
    expect(labels).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(3);
    }
  });

  it("loses nothing at any page size", async () => {
    for (const size of [1, 2, 3, 4, 7, 8]) {
      const labels = (await pageThrough(size)).flat();
      expect(new Set(labels).size).toBe(seedRows.length);
    }
  });

  it("keeps filters applied across every page", async () => {
    const handler = createHandler(db);
    const collected: string[] = [];
    let cursor: number | null = null;

    for (let guard = 0; guard < 20; guard++) {
      const page = await handler.execute({
        level: ["error", "success"],
        size: 2,
        direction: "next",
        ...(cursor === null ? {} : { cursor }),
      });
      if (page.data.length === 0) break;
      collected.push(...page.data.map((row) => row.label as string));
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }

    // Everything but C, the lone warning.
    expect(collected.sort()).toEqual(["A", "B", "D", "E", "F", "G", "H"]);
  });
});

// ── 5. Tie snapping, with a projected select ────────────────────────────────

/**
 * The ungated twin of the tied-cursor block in
 * `apps/web/src/lib/drizzle/__tests__/handler.test.ts`, which needs a real
 * server. The addition here is that the select is projected and the cursor
 * column is renamed, so tie snapping is exercised through the same lookup that
 * step 4 pins.
 */
describe("tied cursor values with a projected select", () => {
  const T1 = hoursAgo(1);
  const T2 = hoursAgo(2);
  const T3 = hoursAgo(3);

  /** B and C share T2, straddling the page-1 boundary at size 2. */
  const tieRows: readonly SeedRow[] = [
    { ...seedRows[0], id: 1, label: "A", createdAt: T1 },
    { ...seedRows[0], id: 2, label: "B", createdAt: T2 },
    { ...seedRows[0], id: 3, label: "C", createdAt: T2 },
    { ...seedRows[0], id: 4, label: "D", createdAt: T3 },
  ];

  let tieDb: PgliteDb;
  beforeAll(async () => {
    tieDb = await createSeededDb(tieRows);
  });

  async function pageThrough(size: number) {
    const handler = createHandler(tieDb);
    const labels: string[] = [];
    const pageSizes: number[] = [];
    let cursor: number | null = null;

    for (let guard = 0; guard < 20; guard++) {
      const page = await handler.execute({
        size,
        direction: "next",
        ...(cursor === null ? {} : { cursor }),
      });
      if (page.data.length === 0) break;
      labels.push(...page.data.map((row) => row.label as string));
      pageSizes.push(page.data.length);
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }

    return { labels, pageSizes };
  }

  it("ends the page before a tied group rather than splitting it", async () => {
    const page1 = await createHandler(tieDb).execute({
      size: 2,
      direction: "next",
    });

    expect(page1.data.map((row) => row.label)).toEqual(["A"]);
    expect(page1.nextCursor).toBe(T1.getTime());

    const page2 = await createHandler(tieDb).execute({
      size: 2,
      direction: "next",
      cursor: page1.nextCursor,
    });

    expect(page2.data.map((row) => row.label as string).sort()).toEqual([
      "B",
      "C",
    ]);
  });

  it("pages through tied rows without dropping any", async () => {
    const { labels } = await pageThrough(2);

    expect([...labels].sort()).toEqual(["A", "B", "C", "D"]);
    expect(new Set(labels).size).toBe(tieRows.length);
  });

  it("overflows the page when one cursor value fills it entirely", async () => {
    const { labels, pageSizes } = await pageThrough(1);

    expect([...labels].sort()).toEqual(["A", "B", "C", "D"]);
    // Retreating would leave an empty page, so the whole tied group comes back.
    expect(Math.max(...pageSizes)).toBe(2);
  });

  it("projects the full row shape on the overflow re-query too", async () => {
    // The degenerate branch issues a SECOND select; it has to use the same
    // projection, or a page would come back keyed differently from its siblings.
    const handler = createHandler(tieDb);
    const page1 = await handler.execute({ size: 1, direction: "next" });
    const page2 = await handler.execute({
      size: 1,
      direction: "next",
      cursor: page1.nextCursor,
    });

    expect(page2.data.length).toBe(2);
    const expected = [
      ...Object.keys(columnMapping),
      ...Object.keys(extraSelect),
    ].sort();
    for (const row of page2.data) {
      expect(Object.keys(row).sort()).toEqual(expected);
      expect(row.date).toBeInstanceOf(Date);
    }
  });

  it("pages backwards through tied rows without dropping any", async () => {
    const handler = createHandler(tieDb);
    const first = await handler.execute({
      size: 2,
      direction: "prev",
      cursor: T3.getTime(),
    });

    const labels = [...first.data.map((row) => row.label as string)];
    let cursor = first.prevCursor;

    for (let guard = 0; guard < 20 && cursor !== null; guard++) {
      const page = await handler.execute({
        size: 2,
        direction: "prev",
        cursor,
      });
      if (page.data.length === 0) break;
      labels.push(...page.data.map((row) => row.label as string));
      cursor = page.prevCursor;
    }

    // D is the cursor itself, so `>` excludes it.
    expect([...labels].sort()).toEqual(["A", "B", "C"]);
    expect(new Set(labels).size).toBe(3);
  });
});

// ── 6. Scope ────────────────────────────────────────────────────────────────

describe("scope", () => {
  const errorRows = seedRows.filter((row) => row.level === "error");
  /** A window that keeps E (450) and G (300) but drops D (900). */
  const latencyWindow = [300, 500];

  it("hands back the same db, table and mapping the handler queried", async () => {
    const { scope } = await createHandler(db).execute({ size: 50 });

    expect(scope.db).toBe(db);
    expect(scope.table).toBe(events);
    expect(scope.columns).toBe(columnMapping);
  });

  it("composes `where` from every pass and `whereWithoutSliders` from all but the sliders", async () => {
    const { scope, filterRowCount } = await createHandler(db).execute({
      level: ["error"],
      latency: latencyWindow,
      size: 50,
    });

    expect(scope.where).toBeDefined();
    expect(scope.whereWithoutSliders).toBeDefined();
    expect(scope.whereWithoutSliders).not.toBe(scope.where);

    // Run both against the database rather than comparing SQL objects: the
    // slider pass has to exclude the slider, and nothing else.
    const matching = seedRows.filter(
      (row) =>
        row.level === "error" &&
        row.latency >= latencyWindow[0] &&
        row.latency <= latencyWindow[1],
    );
    expect(await countWhere(db, scope.where)).toBe(matching.length);
    expect(await countWhere(db, scope.whereWithoutSliders)).toBe(
      errorRows.length,
    );
    expect(matching.length).toBeLessThan(errorRows.length);
    expect(filterRowCount).toBe(matching.length);
  });

  it("leaves `whereWithoutSliders` undefined when only a slider is set", async () => {
    const { scope } = await createHandler(db).execute({
      latency: latencyWindow,
      size: 50,
    });

    expect(scope.where).toBeDefined();
    expect(scope.whereWithoutSliders).toBeUndefined();
    expect(await countWhere(db, scope.where)).toBe(
      seedRows.filter(
        (row) =>
          row.latency >= latencyWindow[0] && row.latency <= latencyWindow[1],
      ).length,
    );
    expect(await countWhere(db, scope.whereWithoutSliders)).toBe(
      seedRows.length,
    );
  });

  it("leaves both undefined when nothing is filtered", async () => {
    const { scope } = await createHandler(db).execute({ size: 50 });

    expect(scope.where).toBeUndefined();
    expect(scope.whereWithoutSliders).toBeUndefined();
  });

  it("keeps the date pass in both WHEREs", async () => {
    // Dates are pass 1, so they belong to the slider-bounds set as well —
    // otherwise a slider facet would be computed over the wrong time window.
    const from = hoursAgo(5);
    const to = hoursAgo(2);
    const { scope } = await createHandler(db).execute({
      date: [from, to],
      latency: latencyWindow,
      size: 50,
    });

    const inWindow = seedRows.filter(
      (row) =>
        row.createdAt.getTime() >= from.getTime() &&
        row.createdAt.getTime() <= to.getTime(),
    );
    expect(await countWhere(db, scope.whereWithoutSliders)).toBe(
      inWindow.length,
    );
  });

  it("resolves `range` from an explicit date filter", async () => {
    const from = hoursAgo(5);
    const to = hoursAgo(2);
    const { scope } = await createHandler(db).execute({
      date: [from, to],
      size: 50,
    });

    expect(scope.range).not.toBeNull();
    expect(scope.range!.from.getTime()).toBe(from.getTime());
    expect(scope.range!.to.getTime()).toBe(to.getTime());
    // Explicit wins over MIN/MAX: no seeded row sits at either bound edge that
    // discovery would have returned instead.
    expect(scope.range!.from.getTime()).not.toBe(hoursAgo(8).getTime());
    expect(scope.range!.to.getTime()).not.toBe(hoursAgo(1).getTime());
  });

  it("normalizes a reversed explicit range the same way the WHERE does", async () => {
    const { scope } = await createHandler(db).execute({
      date: [hoursAgo(2), hoursAgo(5)],
      size: 50,
    });

    expect(scope.range!.from.getTime()).toBe(hoursAgo(5).getTime());
    expect(scope.range!.to.getTime()).toBe(hoursAgo(2).getTime());
  });

  it("discovers `range` by MIN/MAX over the filtered set when no date filter is given", async () => {
    const unfiltered = await createHandler(db).execute({ size: 50 });
    expect(unfiltered.scope.range!.from.getTime()).toBe(hoursAgo(8).getTime());
    expect(unfiltered.scope.range!.to.getTime()).toBe(hoursAgo(1).getTime());

    // …and it is the FILTERED set, not the table.
    const filtered = await createHandler(db).execute({
      level: ["error"],
      size: 50,
    });
    const errorDates = errorRows.map((row) => row.createdAt.getTime());
    expect(filtered.scope.range!.from.getTime()).toBe(Math.min(...errorDates));
    expect(filtered.scope.range!.to.getTime()).toBe(Math.max(...errorDates));
  });

  it("discovers a degenerate range when one row matches", async () => {
    const { scope } = await createHandler(db).execute({
      status: [301],
      size: 50,
    });

    expect(scope.range!.from.getTime()).toBe(hoursAgo(3).getTime());
    expect(scope.range!.to.getTime()).toBe(hoursAgo(3).getTime());
    expect(scope.bucketMs).toBe(evaluateIntervalMs(0));
  });

  it("returns a null range when nothing matches", async () => {
    const { scope, filterRowCount } = await createHandler(db).execute({
      host: "no-such-host.example.com",
      size: 50,
    });

    expect(filterRowCount).toBe(0);
    expect(scope.range).toBeNull();
    // A null range still yields a bucket, computed from a zero duration.
    expect(scope.bucketMs).toBe(evaluateIntervalMs(0));
  });

  it("applies the interval ladder to the resolved range", async () => {
    const from = hoursAgo(5);
    const to = hoursAgo(2);
    const explicit = await createHandler(db).execute({
      date: [from, to],
      size: 50,
    });
    expect(explicit.scope.bucketMs).toBe(
      evaluateIntervalMs(to.getTime() - from.getTime()),
    );
    // 3 hours = 180 min, below the 240-min rung.
    expect(explicit.scope.bucketMs).toBe(240_000);

    const discovered = await createHandler(db).execute({ size: 50 });
    const { range } = discovered.scope;
    expect(discovered.scope.bucketMs).toBe(
      evaluateIntervalMs(range!.to.getTime() - range!.from.getTime()),
    );
  });
});
