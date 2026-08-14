import { logs } from "@/db/drizzle/schema";
import {
  createDrizzleHandler,
  evaluateIntervalMs,
} from "@dtf/registry/lib/drizzle";
import type { ColumnMapping, DrizzleDB } from "@dtf/registry/lib/drizzle/types";
import { defineFilters } from "@dtf/registry/lib/filters";
import { col, createTableSchema } from "@dtf/registry/lib/table-schema";
import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  destroyTestDb,
  getDb,
  getTable,
  hasDatabase,
  seedRows,
  setupTestDb,
  testFilters,
  testMapping,
} from "./setup";

/**
 * Characterization tests for `createDrizzleHandler` — the orchestrator that
 * wires the three-pass filtering strategy, facets, counts and cursor
 * pagination together. These document CURRENT behavior.
 *
 * The config used to be a two-shape union: `schema:` when the caller could
 * import the table schema, and loose `sliderKeys`/`facetKeys`/`dateKeys`
 * string lists when it could not. It is now one field, `filters: Filters`,
 * and the pass groupings are derived from `filters.specs` — so the three key
 * lists can no longer drift out of agreement with the semantics they group.
 */

describe.skipIf(!hasDatabase)("createDrizzleHandler", () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 60_000);

  afterAll(async () => {
    await destroyTestDb();
  });

  function createHandler(
    overrides: Partial<Parameters<typeof createDrizzleHandler>[0]> = {},
  ) {
    return createDrizzleHandler({
      db: getDb(),
      table: getTable(),
      columnMapping: testMapping,
      cursorColumn: "date",
      defaultSize: 40,
      filters: testFilters,
      // The projection IS the mapping, and `uuid` is not in it — it is never
      // filtered or sorted, so the production routes add it through `select`
      // exactly like this. Without it, rows come back with no row identity and
      // the pagination assertions below compare `undefined` to `undefined`.
      select: { uuid: getTable().uuid },
      ...overrides,
    });
  }

  /** Seed rows newest-first, matching the handler's default date-desc order. */
  const seedByDateDesc = [...seedRows].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  describe("happy path (no filters)", () => {
    it("returns every seeded row, newest first, within the page size", async () => {
      const result = await createHandler().execute({
        size: 10,
        direction: "next",
      });

      expect(result.data.length).toBeLessThanOrEqual(10);
      expect(result.data.length).toBe(seedRows.length);

      const dates = result.data.map((row) => (row.date as Date).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
      expect(dates).toEqual(seedByDateDesc.map((row) => row.date.getTime()));
    });

    it("counts total and filtered rows identically when nothing is filtered", async () => {
      const result = await createHandler().execute({
        size: 10,
        direction: "next",
      });

      expect(result.totalRowCount).toBe(seedRows.length);
      expect(result.filterRowCount).toBe(result.totalRowCount);
    });

    it("derives nextCursor from the last row and prevCursor from the first", async () => {
      const result = await createHandler().execute({
        size: 10,
        direction: "next",
      });

      const first = result.data[0].date as Date;
      const last = result.data[result.data.length - 1].date as Date;

      expect(result.nextCursor).toBe(last.getTime());
      expect(result.prevCursor).toBe(first.getTime());
    });

    it("honors `size` and falls back to `defaultSize`", async () => {
      const sized = await createHandler().execute({ size: 3 });
      expect(sized.data.length).toBe(3);

      const defaulted = await createHandler({ defaultSize: 2 }).execute({});
      expect(defaulted.data.length).toBe(2);
    });
  });

  describe("three-pass filtering", () => {
    const errorRows = seedRows.filter((row) => row.level === "error");
    const errorLatencyMin = Math.min(...errorRows.map((row) => row.latency));
    const errorLatencyMax = Math.max(...errorRows.map((row) => row.latency));
    /** A latency window that deliberately excludes the slowest-to-slowest edge. */
    const latencyFilter = [errorLatencyMin + 1, errorLatencyMax];
    const matchingRows = errorRows.filter(
      (row) =>
        row.latency >= latencyFilter[0] && row.latency <= latencyFilter[1],
    );

    it("computes slider facets from pass 2 — ignoring the slider's own filter", async () => {
      const result = await createHandler().execute({
        level: ["error"],
        latency: latencyFilter,
        size: 10,
      });

      // Bounds span every `level=error` row, not just those inside the
      // latency window — that is what keeps the slider draggable.
      expect(result.facets.latency.min).toBe(errorLatencyMin);
      expect(result.facets.latency.max).toBe(errorLatencyMax);
      expect(result.facets.latency.total).toBe(errorRows.length);
    });

    it("computes non-slider facets from pass 3 — every filter applied", async () => {
      const result = await createHandler().execute({
        level: ["error"],
        latency: latencyFilter,
        size: 10,
      });

      expect(result.facets.level.rows).toEqual([
        { value: "error", total: matchingRows.length },
      ]);
      expect(result.facets.level.total).toBe(matchingRows.length);
    });

    it("counts filtered rows with all filters applied, total without any", async () => {
      const result = await createHandler().execute({
        level: ["error"],
        latency: latencyFilter,
        size: 10,
      });

      expect(result.data.length).toBe(matchingRows.length);
      expect(result.filterRowCount).toBe(matchingRows.length);
      expect(result.totalRowCount).toBe(seedRows.length);
    });

    it("exposes a scope carrying the composed WHERE of all three passes", async () => {
      const from = seedByDateDesc[4].date;
      const to = seedByDateDesc[0].date;
      const result = await createHandler().execute({
        date: [from, to],
        level: ["error"],
        latency: latencyFilter,
        size: 10,
      });

      const { scope } = result;
      expect(scope.where).toBeDefined();
      // The slider-bounds pass deliberately excludes the slider itself, so the
      // two WHEREs must not be the same object.
      expect(scope.whereWithoutSliders).not.toBe(scope.where);
      expect(scope.columns).toBe(testMapping);
      expect(scope.table).toBe(getTable());
    });

    it("resolves the scope range from an explicit date filter", async () => {
      const from = seedByDateDesc[4].date;
      const to = seedByDateDesc[0].date;
      const { scope } = await createHandler().execute({
        date: [from, to],
        size: 10,
      });

      expect(scope.range).not.toBeNull();
      expect(scope.range!.from.getTime()).toBe(from.getTime());
      expect(scope.range!.to.getTime()).toBe(to.getTime());
      // The interval ladder is applied, so callers never re-derive it.
      expect(scope.bucketMs).toBe(
        evaluateIntervalMs(to.getTime() - from.getTime()),
      );
    });

    it("discovers the scope range from MIN/MAX when no date filter is set", async () => {
      const { scope } = await createHandler().execute({ size: 10 });

      expect(scope.range).not.toBeNull();
      const oldest = seedByDateDesc[seedByDateDesc.length - 1].date;
      const newest = seedByDateDesc[0].date;
      expect(scope.range!.from.getTime()).toBe(oldest.getTime());
      expect(scope.range!.to.getTime()).toBe(newest.getTime());
    });
  });

  describe("cursor pagination", () => {
    it("pages forward without overlap when timestamps are distinct", async () => {
      const handler = createHandler();

      const page1 = await handler.execute({ size: 5, direction: "next" });
      const page2 = await handler.execute({
        size: 5,
        direction: "next",
        cursor: page1.nextCursor,
      });

      const page1Uuids = page1.data.map((row) => row.uuid as string);
      const page2Uuids = page2.data.map((row) => row.uuid as string);

      expect(page1Uuids.length).toBe(5);
      expect(page2Uuids.some((id) => page1Uuids.includes(id))).toBe(false);
      // All 8 seeded rows have distinct timestamps, so nothing is dropped here.
      expect(new Set([...page1Uuids, ...page2Uuids]).size).toBe(
        seedRows.length,
      );
    });

    it("projects the mapping only — an unmapped column needs `select`", async () => {
      // The contract the test helper above has to opt out of: rows carry the
      // mapped keys and nothing else, so a column the wire contract needs but
      // the filters do not has to be named in `select`.
      const result = await createHandler({ select: undefined }).execute({
        size: 1,
      });

      expect(result.data[0]).toHaveProperty("date");
      expect(result.data[0]).not.toHaveProperty("uuid");
    });

    it("direction prev returns newer rows, still ordered newest-first", async () => {
      const midCursor = seedByDateDesc[4].date;

      const result = await createHandler().execute({
        size: 10,
        direction: "prev",
        cursor: midCursor.getTime(),
      });

      const dates = result.data.map((row) => (row.date as Date).getTime());
      expect(dates.length).toBeGreaterThan(0);
      expect(dates.every((date) => date > midCursor.getTime())).toBe(true);
      // Rows are fetched ascending then reversed, so the caller still sees desc.
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });

    it("empty result → nextCursor null, prevCursor a fresh timestamp", async () => {
      const before = Date.now();
      const result = await createHandler().execute({
        host: "no-such-host.example.com",
        size: 10,
      });
      const after = Date.now();

      expect(result.data.length).toBe(0);
      expect(result.filterRowCount).toBe(0);
      expect(result.nextCursor).toBe(null);
      // Current behavior: with no first row, prevCursor is `Date.now()` rather
      // than null — documented, not endorsed.
      expect(result.prevCursor).toBeGreaterThanOrEqual(before);
      expect(result.prevCursor).toBeLessThanOrEqual(after);
    });
  });

  describe("sort", () => {
    it("subordinates the user sort to the cursor column", async () => {
      const result = await createHandler().execute({
        size: 10,
        sort: { id: "latency", desc: true },
      });

      const dates = result.data.map((row) => (row.date as Date).getTime());
      const latencies = result.data.map((row) => row.latency as number);

      // Current behavior: user sort is only a tiebreaker after the cursor
      // column (see plans/README.md, finding #10). Rows come back date-desc.
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
      expect(latencies).not.toEqual([...latencies].sort((a, b) => b - a));
    });

    it("ignores a sort on an unmapped column", async () => {
      const result = await createHandler().execute({
        size: 10,
        sort: { id: "not_a_column", desc: true },
      });

      expect(result.data.length).toBe(seedRows.length);
    });
  });
});

/**
 * The duplicate-timestamp case needs rows that share a cursor value, which the
 * shared `logs` seed deliberately does not have. Inserting them into `logs`
 * would race with the other DB test files, so this block uses its own table.
 */
describe.skipIf(!hasDatabase)(
  "createDrizzleHandler — tied cursor values",
  () => {
    const tieTable = pgTable("handler_cursor_tie_test", {
      uuid: uuid("uuid").defaultRandom().primaryKey(),
      label: text("label").notNull(),
      latency: integer("latency").notNull(),
      date: timestamp("date", { withTimezone: true }).notNull(),
    });

    const tieMapping: ColumnMapping = {
      label: tieTable.label,
      latency: tieTable.latency,
      date: tieTable.date,
    };

    const T1 = new Date("2025-01-15T12:00:00Z");
    const T2 = new Date("2025-01-15T11:00:00Z");
    const T3 = new Date("2025-01-15T10:00:00Z");

    /** B and C share T2, straddling the page-1 boundary at size 2. */
    const tieRows = [
      { label: "A", latency: 10, date: T1 },
      { label: "B", latency: 20, date: T2 },
      { label: "C", latency: 30, date: T2 },
      { label: "D", latency: 40, date: T3 },
    ];

    beforeAll(async () => {
      await setupTestDb();
      await getDb().execute(sql`
      CREATE TABLE IF NOT EXISTS handler_cursor_tie_test (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        label text NOT NULL,
        latency integer NOT NULL,
        date timestamptz NOT NULL
      )
    `);
      await getDb().execute(sql`TRUNCATE handler_cursor_tie_test`);
      await getDb().insert(tieTable).values(tieRows);
    }, 60_000);

    afterAll(async () => {
      await getDb().execute(sql`DROP TABLE IF EXISTS handler_cursor_tie_test`);
      await destroyTestDb();
    });

    const tieFilters = defineFilters([
      { key: "label", type: "checkbox", kind: "string" },
      { key: "latency", type: "slider", kind: "number" },
      { key: "date", type: "timerange", kind: "timestamp" },
    ]);

    function createTieHandler() {
      return createDrizzleHandler({
        db: getDb(),
        table: tieTable,
        columnMapping: tieMapping,
        cursorColumn: "date",
        filters: tieFilters,
      });
    }

    /** Page forward until exhausted, collecting labels in order. */
    async function pageThrough(size: number) {
      const handler = createTieHandler();
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

    it("pages through tied rows without dropping any", async () => {
      const { labels } = await pageThrough(2);

      // Every row is returned exactly once, even though B and C share T2 and
      // the page-1 boundary falls between them.
      expect([...labels].sort()).toEqual(["A", "B", "C", "D"]);
      expect(new Set(labels).size).toBe(tieRows.length);
    });

    it("ends the page before a tied group rather than splitting it", async () => {
      const page1 = await createTieHandler().execute({
        size: 2,
        direction: "next",
      });

      // A alone: B would have split the T2 group, so it starts page 2 instead.
      expect(page1.data.map((row) => row.label as string)).toEqual(["A"]);
      expect(page1.data.length).toBeLessThan(2);
      expect(page1.nextCursor).toBe(T1.getTime());

      const page2 = await createTieHandler().execute({
        size: 2,
        direction: "next",
        cursor: page1.nextCursor,
      });

      expect(page2.data.map((row) => row.label as string).sort()).toEqual([
        "B",
        "C",
      ]);
    });

    it("overflows the page when one cursor value fills it entirely", async () => {
      // size 1 cannot hold the two rows at T2, and retreating would leave an
      // empty page — so the whole tied group comes back at once.
      const { labels, pageSizes } = await pageThrough(1);

      expect([...labels].sort()).toEqual(["A", "B", "C", "D"]);
      expect(Math.max(...pageSizes)).toBe(2);
    });

    it("pages backwards through tied rows without dropping any", async () => {
      const handler = createTieHandler();

      // Start from the oldest row and walk newer, the way live mode prepends.
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

      expect([...labels].sort()).toEqual(["A", "B", "C"]);
      expect(new Set(labels).size).toBe(3);
    });

    it("returns rows newest-first regardless of page boundaries", async () => {
      const result = await createTieHandler().execute({
        size: 10,
        direction: "next",
      });

      const dates = result.data.map((row) => (row.date as Date).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
      expect(result.data.map((row) => row.label as string).sort()).toEqual([
        "A",
        "B",
        "C",
        "D",
      ]);
      expect(result.totalRowCount).toBe(tieRows.length);
    });
  },
);

/**
 * Config handling needs no database — these run in every local test pass.
 */
describe("createDrizzleHandler (config)", () => {
  const stubDb = {} as DrizzleDB;

  it("throws when the cursor column is missing from the column mapping", () => {
    expect(() =>
      createDrizzleHandler({
        db: stubDb,
        table: logs,
        columnMapping: { level: logs.level },
        cursorColumn: "nonexistent",
        filters: defineFilters([]),
      }),
    ).toThrow('cursorColumn "nonexistent" not found in columnMapping');
  });

  it("derives key lists from explicit filter specs", () => {
    const handler = createDrizzleHandler({
      db: stubDb,
      table: logs,
      columnMapping: testMapping,
      cursorColumn: "date",
      filters: defineFilters([
        { key: "level", type: "checkbox", kind: "enum" },
        { key: "latency", type: "slider", kind: "number" },
        { key: "date", type: "timerange", kind: "timestamp" },
      ]),
    });

    expect(handler.sliderKeys).toEqual(["latency"]);
    expect(handler.facetKeys).toEqual(["level", "latency"]);
    expect(handler.dateKeys).toEqual(["date"]);
  });

  it("derives key lists from a tableSchema definition", () => {
    const schema = createTableSchema({
      level: col.enum(["success", "error"]).label("Level"),
      host: col.string().label("Host").filterable("input"),
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 1000 }),
      date: col.timestamp().label("Date"),
      uuid: col.string().label("Uuid").notFilterable(),
    });

    const handler = createDrizzleHandler({
      db: stubDb,
      table: logs,
      columnMapping: testMapping,
      cursorColumn: "date",
      filters: defineFilters(schema.definition),
    });

    expect(handler.sliderKeys).toEqual(["latency"]);
    // Sliders are facets too, in schema declaration order.
    expect(handler.facetKeys).toEqual(["level", "host", "latency"]);
    expect(handler.dateKeys).toEqual(["date"]);
  });

  it("derives the same key lists from a schema and from its JSON", () => {
    // `defineFilters` accepts `SchemaJSON` so the declaration can cross the
    // `"use client"` boundary as data — that is what removed the need for the
    // loose-string-list config shape in the first place. The two paths have to
    // agree, or the boundary reintroduces the drift it was meant to remove.
    const schema = createTableSchema({
      level: col.enum(["success", "error"]).label("Level"),
      host: col.string().label("Host").filterable("input"),
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 1000 }),
      date: col.timestamp().label("Date"),
    });

    const fromDefinition = defineFilters(schema.definition);
    const fromJSON = defineFilters(schema.toJSON());

    expect(fromJSON.specs).toEqual(fromDefinition.specs);
  });

  it("passes the same handler config shape as the live route", () => {
    // `apps/web/src/app/drizzle/api/route.ts` builds its handler with exactly
    // this one field; a second config shape reappearing would fail here.
    const handler = createDrizzleHandler({
      db: stubDb,
      table: logs,
      columnMapping: testMapping,
      cursorColumn: "date",
      filters: testFilters,
    });

    expect(handler.dateKeys).toEqual(["date"]);
    expect(handler.sliderKeys).toEqual([
      "latency",
      "timing.dns",
      "timing.connection",
      "timing.tls",
      "timing.ttfb",
      "timing.transfer",
    ]);
    expect(handler.facetKeys).toEqual([
      "level",
      "status",
      "method",
      "host",
      "pathname",
      "latency",
      "regions",
      "timing.dns",
      "timing.connection",
      "timing.tls",
      "timing.ttfb",
      "timing.transfer",
    ]);
  });
});
