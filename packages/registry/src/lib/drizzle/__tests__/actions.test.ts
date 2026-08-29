import { defineFilters, type FilterSpec } from "@dtf/registry/lib/filters";
import { count, eq, sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ActionHandlerError,
  createActionHandler,
  isSerializationFailure,
  type ActionAuditEvent,
  type ActionContext,
  type ActionHandlerConfig,
  type DrizzleActionDefinition,
} from "../actions";
import { createDrizzleHandler } from "../handler";
import type { ColumnMapping } from "../types";
import { createPgliteDb, type PgliteDb } from "./pglite";

/**
 * `createActionHandler` against real Postgres.
 *
 * The contract under test: the handler's WHERE is the id set (or filter)
 * intersected with the action's `when` guard, the whole request is one
 * transaction, and a filter-scoped request compiles through the same
 * `buildWhereConditions` the list endpoint uses. Every table name here differs
 * from its schema key on purpose (`created_at` ↔ `date`), for the same reason
 * as `handler-projection.test.ts`.
 */

const outbox = pgTable("actions_outbox", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull(),
  attempt: integer("attempt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

const columnMapping: ColumnMapping = {
  id: outbox.id,
  event_type: outbox.eventType,
  status: outbox.status,
  attempt: outbox.attempt,
  date: outbox.createdAt,
};

const specs: readonly FilterSpec[] = [
  { key: "event_type", type: "input", kind: "string" },
  {
    key: "status",
    type: "checkbox",
    kind: "enum",
    options: ["pending", "dead", "delivered"],
  },
  { key: "attempt", type: "slider", kind: "number", min: 0, max: 10 },
  { key: "date", type: "timerange", kind: "timestamp" },
];

const filters = defineFilters(specs);

type Seed = {
  id: string;
  eventType: string;
  status: string;
  attempt: number;
  createdAt: Date;
};

const BASE = new Date("2025-01-15T12:00:00Z");
const hoursAgo = (h: number) => new Date(BASE.getTime() - h * 3600_000);

const seed: readonly Seed[] = [
  {
    id: "m1",
    eventType: "invoice",
    status: "dead",
    attempt: 5,
    createdAt: hoursAgo(1),
  },
  {
    id: "m2",
    eventType: "invoice",
    status: "delivered",
    attempt: 1,
    createdAt: hoursAgo(2),
  },
  {
    id: "m3",
    eventType: "refund",
    status: "dead",
    attempt: 2,
    createdAt: hoursAgo(3),
  },
  {
    id: "m4",
    eventType: "refund",
    status: "pending",
    attempt: 0,
    createdAt: hoursAgo(4),
  },
  {
    id: "m5",
    eventType: "invoice",
    status: "dead",
    attempt: 9,
    createdAt: hoursAgo(30),
  },
];

const CREATE_TABLE = sql`
  CREATE TABLE actions_outbox (
    id text PRIMARY KEY,
    event_type text NOT NULL,
    status text NOT NULL,
    attempt integer NOT NULL,
    created_at timestamptz NOT NULL
  )
`;

async function createSeededDb(): Promise<PgliteDb> {
  const db = createPgliteDb();
  await db.execute(CREATE_TABLE);
  await db.insert(outbox).values(seed.map((row) => ({ ...row })));
  return db;
}

/** The replay recipe from the docs, verbatim. */
const replay: DrizzleActionDefinition = {
  label: "Replay",
  scope: ["row", "bulk", "filter"],
  when: { status: ["dead"] },
  handler: async (ctx, tx) => {
    const rows = await tx
      .update(outbox)
      .set({ status: "pending", attempt: 0 })
      .where(ctx.where)
      .returning({ id: outbox.id });
    return rows.length;
  },
};

async function statusOf(db: PgliteDb, id: string): Promise<string> {
  const [row] = await db
    .select({ status: outbox.status })
    .from(outbox)
    .where(eq(outbox.id, id));
  return row!.status;
}

async function total(db: PgliteDb): Promise<number> {
  const [row] = await db.select({ n: count() }).from(outbox);
  return Number(row!.n);
}

function createHandler(
  db: PgliteDb,
  overrides: Partial<ActionHandlerConfig> = {},
) {
  return createActionHandler({
    db,
    table: outbox,
    filters,
    columnMapping,
    idColumn: "id",
    basePath: "/api/actions",
    actions: { replay },
    ...overrides,
  });
}

async function expectError(
  promise: Promise<unknown>,
  code: ActionHandlerError["code"],
): Promise<ActionHandlerError> {
  const error = await promise.then(
    () => {
      throw new Error("expected rejection");
    },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ActionHandlerError);
  expect((error as ActionHandlerError).code).toBe(code);
  return error as ActionHandlerError;
}

describe("createActionHandler", () => {
  let db: PgliteDb;
  beforeEach(async () => {
    db = await createSeededDb();
  });

  describe("construction", () => {
    it("throws when idColumn is not mapped", () => {
      expect(() => createHandler(db, { idColumn: "uuid" })).toThrow(
        /idColumn "uuid" not found in columnMapping/,
      );
    });

    it("throws when a filterable column is missing from the mapping — a `when` on it would guard nothing", () => {
      const { status: _status, ...withoutStatus } = columnMapping;
      expect(() => createHandler(db, { columnMapping: withoutStatus })).toThrow(
        /missing from columnMapping:\n\s+- status/,
      );
    });

    it("exposes the public descriptors with the composed href and the id limit", () => {
      expect(createHandler(db).descriptors).toEqual([
        {
          id: "replay",
          label: "Replay",
          scope: ["row", "bulk", "filter"],
          href: "/api/actions/replay",
          maxIds: 1000,
        },
      ]);
      expect(createHandler(db, { maxIds: 25 }).descriptors[0]!.maxIds).toBe(25);
    });
  });

  describe("scope: ids", () => {
    it("applies to the eligible ids and skips the rest — `_actions` is a hint, the WHERE is the authority", async () => {
      const handler = createHandler(db);
      // m2 is delivered: a stale client may still send it.
      const result = await handler.execute("replay", {
        scope: "ids",
        ids: ["m1", "m2", "m3"],
        cmd_id: "cmd_1",
      });
      expect(result).toEqual({ applied: 2 });
      expect(await statusOf(db, "m1")).toBe("pending");
      expect(await statusOf(db, "m3")).toBe("pending");
      expect(await statusOf(db, "m2")).toBe("delivered");
      // Untouched dead row outside the id set.
      expect(await statusOf(db, "m5")).toBe("dead");
    });

    it("annotate agrees with what execute would apply to", async () => {
      const handler = createHandler(db);
      const list = createDrizzleHandler({
        db,
        table: outbox,
        filters,
        columnMapping,
        cursorColumn: "date",
      });
      const { data } = await list.execute({ size: 50 });
      const eligible = handler
        .annotate(data)
        .filter((row) => row._actions.includes("replay"))
        .map((row) => row.id as string)
        .sort();
      expect(eligible).toEqual(["m1", "m3", "m5"]);

      const result = await handler.execute("replay", {
        scope: "ids",
        ids: data.map((row) => row.id as string),
        cmd_id: "cmd_2",
      });
      expect(result.applied).toBe(eligible.length);
    });

    it("de-duplicates ids before applying", async () => {
      const seen: string[][] = [];
      const spy = createHandler(db, {
        actions: {
          replay: {
            ...replay,
            handler: async (ctx, tx) => {
              seen.push(ctx.ids!);
              return replay.handler(ctx, tx);
            },
          },
        },
      });
      await spy.execute("replay", {
        scope: "ids",
        ids: ["m1", "m1", "m3"],
        cmd_id: "c",
      });
      expect(seen[0]).toEqual(["m1", "m3"]);
    });

    it("rejects more ids than maxIds", async () => {
      const handler = createHandler(db, { maxIds: 2 });
      await expectError(
        handler.execute("replay", {
          scope: "ids",
          ids: ["m1", "m3", "m5"],
          cmd_id: "c",
        }),
        "invalid_request",
      );
      expect(await statusOf(db, "m1")).toBe("dead");
    });

    it("rejects ids that fail `idSchema` before they reach the database", async () => {
      // The demo's shape: a `uuid` column. "m1" would be a cast error — a 500.
      const strict = createHandler(db, { idSchema: z.uuid() });
      const error = await expectError(
        strict.execute("replay", { scope: "ids", ids: ["m1"], cmd_id: "c" }),
        "invalid_request",
      );
      expect(error.status).toBe(400);
      expect(await statusOf(db, "m1")).toBe("dead");

      const lenient = createHandler(db, {
        idSchema: z.string().regex(/^m\d$/),
      });
      await expectError(
        lenient.execute("replay", {
          scope: "ids",
          ids: ["m1", "m1; drop table"],
          cmd_id: "c",
        }),
        "invalid_request",
      );
      await expect(
        lenient.execute("replay", { scope: "ids", ids: ["m1"], cmd_id: "c" }),
      ).resolves.toEqual({ applied: 1 });
    });

    it("accepts exactly one id for a row-only action", async () => {
      const handler = createHandler(db, {
        actions: { replay: { ...replay, scope: ["row"] } },
      });
      await expectError(
        handler.execute("replay", {
          scope: "ids",
          ids: ["m1", "m3"],
          cmd_id: "c",
        }),
        "scope_not_allowed",
      );
      expect(await statusOf(db, "m1")).toBe("dead");
      await expect(
        handler.execute("replay", { scope: "ids", ids: ["m1"], cmd_id: "c" }),
      ).resolves.toEqual({ applied: 1 });
    });

    it("refuses ids for a filter-only action", async () => {
      const handler = createHandler(db, {
        actions: { purge: { ...replay, scope: ["filter"] } },
      });
      await expectError(
        handler.execute("purge", { scope: "ids", ids: ["m1"], cmd_id: "c" }),
        "scope_not_allowed",
      );
    });
  });

  describe("scope: filter", () => {
    it("compiles the filter with the same semantics as the list endpoint", async () => {
      const handler = createHandler(db);
      const list = createDrizzleHandler({
        db,
        table: outbox,
        filters,
        columnMapping,
        cursorColumn: "date",
      });
      const filter = { event_type: "inv", attempt: [3, 10] };
      // What the user saw: dead ∩ invoice ∩ attempt ∈ [3,10] — only via
      // `when` for the status part.
      const { filterRowCount } = await list.execute({
        ...filter,
        status: ["dead"],
        size: 50,
      });
      expect(filterRowCount).toBe(2); // m1, m5

      const result = await handler.execute("replay", {
        scope: "filter",
        filter,
        cmd_id: "c",
      });
      expect(result.applied).toBe(filterRowCount);
      expect(await statusOf(db, "m1")).toBe("pending");
      expect(await statusOf(db, "m5")).toBe("pending");
      expect(await statusOf(db, "m3")).toBe("dead"); // refund
    });

    it("applies expected_count as an optimistic check inside the transaction", async () => {
      const handler = createHandler(db);
      const error = await expectError(
        handler.execute("replay", {
          scope: "filter",
          filter: { event_type: "inv" },
          expected_count: 2,
          cmd_id: "c",
        }),
        "count_mismatch",
      );
      // Three invoices — what the list endpoint would have shown.
      expect(error.actual).toBe(3);
      expect(error.status).toBe(409);
      expect(error.toJSON()).toEqual({ error: "count_mismatch", actual: 3 });
      // Nothing moved.
      expect(await statusOf(db, "m1")).toBe("dead");

      const ok = await handler.execute("replay", {
        scope: "filter",
        filter: { event_type: "inv" },
        expected_count: 3,
        cmd_id: "c",
      });
      // Two of the three invoices are dead: the guard, not drift.
      expect(ok).toEqual({ applied: 2 });
    });

    it("pins one snapshot for the count and the mutation when a count is promised", async () => {
      const levels: string[] = [];
      const handler = createHandler(db, {
        actions: {
          replay: {
            ...replay,
            handler: async (ctx, tx) => {
              const result = await tx.execute<{ level: string }>(
                sql`select current_setting('transaction_isolation') as level`,
              );
              levels.push(result.rows[0]!.level);
              return replay.handler(ctx, tx);
            },
          },
        },
      });
      await handler.execute("replay", {
        scope: "filter",
        filter: {},
        expected_count: seed.length,
        cmd_id: "c",
      });
      // Without a count there is nothing to keep consistent — the default.
      await handler.execute("replay", {
        scope: "ids",
        ids: ["m1"],
        cmd_id: "c",
      });
      expect(levels).toEqual(["repeatable read", "read committed"]);
    });

    it("retries a serialization failure against a fresh snapshot, then gives up", async () => {
      const serialization = () =>
        Object.assign(new Error("could not serialize access"), {
          code: "40001",
        });
      let calls = 0;
      const flaky = createHandler(db, {
        actions: {
          replay: {
            ...replay,
            handler: async (ctx, tx) => {
              calls += 1;
              if (calls === 1) throw serialization();
              return replay.handler(ctx, tx);
            },
          },
        },
      });
      await expect(
        flaky.execute("replay", {
          scope: "filter",
          filter: {},
          expected_count: seed.length,
          cmd_id: "c",
        }),
      ).resolves.toEqual({ applied: 3 });
      expect(calls).toBe(2);

      calls = 0;
      const hopeless = createHandler(db, {
        actions: {
          replay: {
            ...replay,
            handler: async () => {
              calls += 1;
              // Wrapped the way Drizzle reports a driver error.
              throw new Error("query failed", { cause: serialization() });
            },
          },
        },
      });
      await expect(
        hopeless.execute("replay", { scope: "ids", ids: ["m4"], cmd_id: "c" }),
      ).rejects.toThrow("query failed");
      expect(calls).toBe(3);
      expect(await statusOf(db, "m4")).toBe("pending");
    });

    it("measures drift on the set the client saw, before the `when` guard", async () => {
      const handler = createHandler(db);
      const list = createDrizzleHandler({
        db,
        table: outbox,
        filters,
        columnMapping,
        cursorColumn: "date",
      });
      // No filters: the client shows every row and sends that count.
      const { filterRowCount } = await list.execute({ size: 50 });
      expect(filterRowCount).toBe(seed.length);

      const ok = await handler.execute("replay", {
        scope: "filter",
        filter: {},
        expected_count: filterRowCount,
        cmd_id: "c",
      });
      // Only the dead rows are replayed — and that is not a mismatch.
      expect(ok).toEqual({ applied: 3 });
    });

    it("an empty filter is 'every row the guard allows', never 'nothing'", async () => {
      const handler = createHandler(db);
      const result = await handler.execute("replay", {
        scope: "filter",
        filter: {},
        cmd_id: "c",
      });
      expect(result.applied).toBe(3);
    });

    it("with no `when` and an empty filter the handler still receives a real SQL", async () => {
      let received: ActionContext | undefined;
      const handler = createHandler(db, {
        actions: {
          touch: {
            label: "Touch",
            scope: ["filter"],
            handler: async (ctx) => {
              received = ctx;
              return 0;
            },
          },
        },
      });
      await handler.execute("touch", {
        scope: "filter",
        filter: {},
        cmd_id: "c",
      });
      expect(received?.where).toBeDefined();
      const [row] = await db
        .select({ n: count() })
        .from(outbox)
        .where(received!.where);
      expect(Number(row!.n)).toBe(seed.length);
    });

    it("drops unknown filter keys and reads the rest exactly as the list endpoint does", async () => {
      let received: ActionContext | undefined;
      const handler = createHandler(db, {
        actions: {
          replay: {
            ...replay,
            handler: async (ctx, tx) => {
              received = ctx;
              return replay.handler(ctx, tx);
            },
          },
        },
      });
      const result = await handler.execute("replay", {
        scope: "filter",
        filter: {
          status: ["dead", "not-a-status"],
          attempt: [-50, 99999],
          nonsense: "ignored",
        },
        cmd_id: "c",
      });
      // Not `filters.coerce`: values are neither clamped nor pruned, so the
      // recorded filter is what the client asked for, minus keys the schema
      // has never heard of.
      expect(received?.filter).toEqual({
        status: ["dead", "not-a-status"],
        attempt: [-50, 99999],
      });
      expect(result.applied).toBe(3);
    });

    it("does not clamp a range to the declared slider bounds — the user saw those rows", async () => {
      // `attempt` is declared { min: 0, max: 10 }; the data does not care.
      await db.insert(outbox).values({
        id: "m6",
        eventType: "invoice",
        status: "dead",
        attempt: 15,
        createdAt: hoursAgo(40),
      });
      const handler = createHandler(db);
      const result = await handler.execute("replay", {
        scope: "filter",
        filter: { attempt: [12, 20] },
        cmd_id: "c",
      });
      // Clamped to [10, 10] this would have matched nothing.
      expect(result).toEqual({ applied: 1 });
      expect(await statusOf(db, "m6")).toBe("pending");
      expect(await statusOf(db, "m5")).toBe("dead");
    });

    it("refuses a filter for a row/bulk-only action", async () => {
      const handler = createHandler(db, {
        actions: { replay: { ...replay, scope: ["row", "bulk"] } },
      });
      await expectError(
        handler.execute("replay", { scope: "filter", filter: {}, cmd_id: "c" }),
        "scope_not_allowed",
      );
    });
  });

  describe("failure modes", () => {
    it("unknown action", async () => {
      const error = await expectError(
        createHandler(db).execute("nope", {
          scope: "ids",
          ids: ["m1"],
          cmd_id: "c",
        }),
        "unknown_action",
      );
      expect(error.status).toBe(404);
    });

    it.each([
      ["no body", undefined],
      ["empty ids", { scope: "ids", ids: [], cmd_id: "c" }],
      ["missing cmd_id", { scope: "ids", ids: ["m1"] }],
      ["unknown scope", { scope: "all", cmd_id: "c" }],
      [
        "negative expected_count",
        { scope: "filter", filter: {}, expected_count: -1, cmd_id: "c" },
      ],
      ["non-string id", { scope: "ids", ids: [1], cmd_id: "c" }],
    ])("invalid request: %s", async (_, body) => {
      const error = await expectError(
        createHandler(db).execute("replay", body),
        "invalid_request",
      );
      expect(error.status).toBe(400);
    });

    it("rolls back everything when the handler throws", async () => {
      const handler = createHandler(db, {
        actions: {
          replay: {
            ...replay,
            handler: async (ctx, tx) => {
              await replay.handler(ctx, tx);
              throw new Error("boom");
            },
          },
        },
      });
      await expect(
        handler.execute("replay", { scope: "ids", ids: ["m1"], cmd_id: "c" }),
      ).rejects.toThrow("boom");
      expect(await statusOf(db, "m1")).toBe("dead");
      expect(await total(db)).toBe(seed.length);
    });

    it.each([
      ["undefined", undefined],
      ["a negative number", -1],
      ["a fraction", 1.5],
      ["NaN", Number.NaN],
      ["a string", "2"],
    ])(
      "rolls back when the handler returns %s instead of a count",
      async (_, returned) => {
        const handler = createHandler(db, {
          actions: {
            replay: {
              ...replay,
              handler: async (ctx, tx) => {
                await replay.handler(ctx, tx);
                return returned as unknown as number;
              },
            },
          },
        });
        await expect(
          handler.execute("replay", {
            scope: "ids",
            ids: ["m1"],
            cmd_id: "c",
          }),
        ).rejects.toThrow(/must return the applied row count/);
        expect(await statusOf(db, "m1")).toBe("dead");
      },
    );

    it("recognises SQLSTATE 40001 anywhere in the cause chain, and nothing else", () => {
      const failure = Object.assign(new Error("x"), { code: "40001" });
      expect(isSerializationFailure(failure)).toBe(true);
      expect(
        isSerializationFailure(new Error("wrapped", { cause: failure })),
      ).toBe(true);
      expect(isSerializationFailure(new Error("plain"))).toBe(false);
      expect(
        isSerializationFailure(
          Object.assign(new Error("x"), { code: "23505" }),
        ),
      ).toBe(false);
      expect(isSerializationFailure(null)).toBe(false);
      expect(isSerializationFailure("40001")).toBe(false);
    });
  });

  describe("context and audit", () => {
    it("hands the handler ids, cmdId and the route-supplied actor — never a body field", async () => {
      let received: ActionContext | undefined;
      const handler = createHandler(db, {
        actions: {
          replay: {
            ...replay,
            handler: async (ctx, tx) => {
              received = ctx;
              return replay.handler(ctx, tx);
            },
          },
        },
      });
      await handler.execute(
        "replay",
        { scope: "ids", ids: ["m1"], cmd_id: "cmd_9", actor: "mallory" },
        { actor: "max@example.com" },
      );
      expect(received).toMatchObject({
        ids: ["m1"],
        cmdId: "cmd_9",
        actor: "max@example.com",
      });
      expect(received).not.toHaveProperty("filter");
    });

    it("calls audit once, after commit, with the applied count", async () => {
      const events: ActionAuditEvent[] = [];
      const audit = vi.fn(async (event: ActionAuditEvent) => {
        // The write is visible from a fresh connection by now.
        expect(await statusOf(db, "m1")).toBe("pending");
        events.push(event);
      });
      const handler = createHandler(db, { audit });
      await handler.execute(
        "replay",
        { scope: "ids", ids: ["m1", "m2"], cmd_id: "cmd_a" },
        { actor: "max" },
      );
      expect(audit).toHaveBeenCalledTimes(1);
      expect(events[0]).toMatchObject({
        action: "replay",
        actor: "max",
        cmdId: "cmd_a",
        scope: "ids",
        ids: ["m1", "m2"],
        applied: 1,
      });
      expect(events[0]!.at).toBeInstanceOf(Date);
    });

    it("does not call audit when the request fails", async () => {
      const audit = vi.fn();
      const handler = createHandler(db, { audit });
      await expectError(
        handler.execute("replay", {
          scope: "filter",
          filter: {},
          expected_count: 0,
          cmd_id: "c",
        }),
        "count_mismatch",
      );
      await expectError(
        handler.execute("nope", { scope: "ids", ids: ["m1"], cmd_id: "c" }),
        "unknown_action",
      );
      expect(audit).not.toHaveBeenCalled();
    });

    it("records the sanitized filter for filter-scoped commands", async () => {
      const audit = vi.fn();
      const handler = createHandler(db, { audit });
      await handler.execute("replay", {
        scope: "filter",
        filter: { event_type: "inv", junk: 1 },
        cmd_id: "c",
      });
      expect(audit.mock.calls[0]![0]).toMatchObject({
        scope: "filter",
        filter: { event_type: "inv" },
        applied: 2,
      });
      expect(audit.mock.calls[0]![0]).not.toHaveProperty("ids");
    });
  });
});
