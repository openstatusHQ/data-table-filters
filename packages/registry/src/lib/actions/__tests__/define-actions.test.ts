import {
  defineFilters,
  type FilterSpec,
  type FilterValues,
} from "@dtf/registry/lib/filters";
import {
  col,
  type TableSchemaDefinition,
} from "@dtf/registry/lib/table-schema";
import { describe, expect, it } from "vitest";
import { defineActions, type ActionDefinitionBase } from "../define-actions";
import { ROW_ACTIONS_KEY, type ActionDescriptor } from "../types";

/**
 * `defineActions` is the boundary between what the server knows about an
 * action and what it publishes. The suite pins three things:
 *
 * 1. The projection is a pick-list. A handler, a `when` clause, or any extra
 *    key on a definition must never reach `descriptors`.
 * 2. `when` is validated at construction — a typo must throw, not match every
 *    row.
 * 3. `annotate` agrees with the filter semantics the SQL engine will use.
 */

const specs: readonly FilterSpec[] = [
  {
    key: "status",
    type: "checkbox",
    kind: "enum",
    options: ["pending", "dead", "delivered"],
  },
  { key: "attempt", type: "slider", kind: "number", min: 0, max: 10 },
  { key: "event_type", type: "input", kind: "string" },
];

const filters = defineFilters(specs);

type Row = {
  id: string;
  status: string;
  attempt: number;
  event_type: string;
  /** Not filterable — only `available` can see it. */
  locked: boolean;
};

const rows: Row[] = [
  { id: "a", status: "dead", attempt: 5, event_type: "invoice", locked: false },
  {
    id: "b",
    status: "delivered",
    attempt: 1,
    event_type: "invoice",
    locked: false,
  },
  { id: "c", status: "dead", attempt: 2, event_type: "refund", locked: true },
  {
    id: "d",
    status: "pending",
    attempt: 0,
    event_type: "refund",
    locked: false,
  },
];

/** A definition with everything a server might attach — none of it public. */
type ServerDefinition = ActionDefinitionBase<Row> & {
  handler: () => Promise<number>;
  webhookSecret?: string;
};

const handler = async () => 0;

describe("descriptors — the pick-list projection", () => {
  it("publishes exactly the ActionDescriptor keys, and nothing attached to the definition", () => {
    const { descriptors } = defineActions<ServerDefinition>(
      filters,
      {
        replay: {
          label: "Replay",
          scope: ["row", "bulk"],
          when: { status: ["dead"] },
          available: (row) => !row.locked,
          handler,
          webhookSecret: "hunter2",
        },
      },
      { basePath: "/api/actions" },
    );

    expect(descriptors).toEqual([
      {
        id: "replay",
        label: "Replay",
        scope: ["row", "bulk"],
        href: "/api/actions/replay",
      },
    ]);

    // Belt and braces: the key set, not just deep equality.
    const published = Object.keys(descriptors[0]!).sort();
    const allowed: Array<keyof ActionDescriptor> = [
      "id",
      "label",
      "scope",
      "variant",
      "confirm",
      "href",
    ];
    for (const key of published) {
      expect(allowed as string[]).toContain(key);
    }
    expect(JSON.stringify(descriptors)).not.toContain("hunter2");
    expect(JSON.stringify(descriptors)).not.toContain("when");
  });

  it("carries optional keys only when set", () => {
    const { descriptors } = defineActions<ServerDefinition>(
      filters,
      {
        discard: {
          label: "Discard",
          variant: "destructive",
          confirm: "Discard {count} messages?",
          handler,
        },
      },
      { basePath: "/api/actions/" },
    );

    expect(descriptors[0]).toEqual({
      id: "discard",
      label: "Discard",
      scope: ["row", "bulk"],
      variant: "destructive",
      confirm: "Discard {count} messages?",
      href: "/api/actions/discard",
    });
    expect(
      Object.prototype.hasOwnProperty.call(descriptors[0], "variant"),
    ).toBe(true);
  });

  it("defaults scope to row + bulk and de-duplicates", () => {
    const { definitions, descriptors } = defineActions<ServerDefinition>(
      filters,
      {
        a: { label: "A", handler },
        b: { label: "B", scope: ["filter", "filter", "row"], handler },
      },
      { basePath: "/x" },
    );
    expect(definitions.get("a")!.scope).toEqual(["row", "bulk"]);
    expect(descriptors[1]!.scope).toEqual(["filter", "row"]);
  });

  it("preserves declaration order", () => {
    const { descriptors } = defineActions<ServerDefinition>(
      filters,
      {
        zeta: { label: "Z", handler },
        alpha: { label: "A", handler },
      },
      { basePath: "/x" },
    );
    expect(descriptors.map((d) => d.id)).toEqual(["zeta", "alpha"]);
  });

  it("publishes `maxIds` on bulk descriptors only", () => {
    const { descriptors } = defineActions<ServerDefinition>(
      filters,
      {
        replay: { label: "R", scope: ["row", "bulk"], handler },
        open: { label: "O", scope: ["row"], handler },
        purge: { label: "P", scope: ["filter"], handler },
      },
      { basePath: "/x", maxIds: 250 },
    );
    expect(descriptors.map((d) => d.maxIds)).toEqual([
      250,
      undefined,
      undefined,
    ]);
    expect(Object.hasOwn(descriptors[1]!, "maxIds")).toBe(false);
  });

  it("omits `maxIds` when the transport publishes none, and rejects a bad one", () => {
    const { descriptors } = defineActions<ServerDefinition>(
      filters,
      { replay: { label: "R", handler } },
      { basePath: "/x" },
    );
    expect(Object.hasOwn(descriptors[0]!, "maxIds")).toBe(false);
    for (const maxIds of [0, -1, 1.5, Number.NaN]) {
      expect(() =>
        defineActions<ServerDefinition>(
          filters,
          { replay: { label: "R", handler } },
          { basePath: "/x", maxIds },
        ),
      ).toThrow(/maxIds must be a positive integer/);
    }
  });

  it("survives JSON round-tripping unchanged", () => {
    const { descriptors } = defineActions<ServerDefinition>(
      filters,
      { replay: { label: "Replay", confirm: "Go?", handler } },
      { basePath: "/x" },
    );
    expect(JSON.parse(JSON.stringify(descriptors))).toEqual(descriptors);
  });
});

describe("construction-time validation", () => {
  it("rejects ids that cannot be URL segments", () => {
    for (const id of ["Replay", "re play", "re/play", "", "-x", "ré"]) {
      expect(() =>
        defineActions<ServerDefinition>(
          filters,
          { [id]: { label: "x", handler } },
          { basePath: "/x" },
        ),
      ).toThrow(/must match/);
    }
  });

  it("rejects integer-like ids — `Object.entries` would reorder them", () => {
    for (const id of ["1", "42", "0"]) {
      expect(() =>
        defineActions<ServerDefinition>(
          filters,
          { [id]: { label: "x", handler } },
          { basePath: "/x" },
        ),
      ).toThrow(/must match/);
    }
  });

  it("accepts snake_case and kebab-case ids", () => {
    expect(() =>
      defineActions<ServerDefinition>(
        filters,
        {
          mark_read: { label: "x", handler },
          "re-queue2": { label: "x", handler },
        },
        { basePath: "/x" },
      ),
    ).not.toThrow();
  });

  it("requires a label and a non-empty scope", () => {
    expect(() =>
      defineActions<ServerDefinition>(
        filters,
        { a: { label: "", handler } },
        { basePath: "/x" },
      ),
    ).toThrow(/needs a label/);
    expect(() =>
      defineActions<ServerDefinition>(
        filters,
        { a: { label: "A", scope: [], handler } },
        { basePath: "/x" },
      ),
    ).toThrow(/empty scope/);
  });

  it("requires a non-empty basePath", () => {
    expect(() =>
      defineActions<ServerDefinition>(
        filters,
        { a: { label: "A", handler } },
        { basePath: "/" },
      ),
    ).toThrow(/basePath/);
  });

  it("throws on a `when` key that is not a filterable column", () => {
    expect(() =>
      defineActions<ServerDefinition>(
        filters,
        { a: { label: "A", when: { staus: ["dead"] }, handler } },
        { basePath: "/x" },
      ),
    ).toThrow(/when."staus" is not a filterable column/);
  });

  it("throws on a `when` value that would not plan to an op", () => {
    // An empty checkbox is "inactive" for search params — and would be
    // "everything" for a guard.
    expect(() =>
      defineActions<ServerDefinition>(
        filters,
        { a: { label: "A", when: { status: [] }, handler } },
        { basePath: "/x" },
      ),
    ).toThrow(/not an active filter value/);
    expect(() =>
      defineActions<ServerDefinition>(
        filters,
        { a: { label: "A", when: { status: null }, handler } },
        { basePath: "/x" },
      ),
    ).toThrow(/not an active filter value/);
  });
});

describe("annotate — per-row availability", () => {
  it("stamps every row with `_actions` under the exported key", () => {
    const { annotate } = defineActions<ServerDefinition>(
      filters,
      { noop: { label: "Noop", handler } },
      { basePath: "/x" },
    );
    const annotated = annotate(rows);
    expect(annotated).toHaveLength(rows.length);
    for (const row of annotated) {
      expect(row[ROW_ACTIONS_KEY]).toEqual(["noop"]);
      expect(row._actions).toEqual(["noop"]);
    }
    // Input rows are untouched.
    expect("_actions" in rows[0]!).toBe(false);
  });

  it("evaluates `when` with the shared filter semantics", () => {
    const { annotate } = defineActions<ServerDefinition>(
      filters,
      {
        replay: { label: "Replay", when: { status: ["dead"] }, handler },
        escalate: {
          label: "Escalate",
          when: { status: ["dead"], attempt: [3, 10] },
          handler,
        },
        rename: { label: "Rename", when: { event_type: "inv" }, handler },
      },
      { basePath: "/x" },
    );
    const byId = Object.fromEntries(
      annotate(rows).map((row) => [row.id, row._actions]),
    );
    expect(byId).toEqual({
      a: ["replay", "escalate", "rename"],
      b: ["rename"],
      c: ["replay"],
      d: [],
    });
  });

  it("agrees with filters.apply for every `when` — same engine, same answer", () => {
    const when = { status: ["dead"], attempt: [3, 10] };
    const { annotate } = defineActions<ServerDefinition>(
      filters,
      { x: { label: "X", when, handler } },
      { basePath: "/x" },
    );
    const viaAnnotate = annotate(rows)
      .filter((row) => row._actions.includes("x"))
      .map((row) => row.id);
    const viaApply = filters.apply(rows, when).map((row) => row.id);
    expect(viaAnnotate).toEqual(viaApply);
  });

  it("intersects `when` with `available`", () => {
    const { annotate, actionsFor } = defineActions<ServerDefinition>(
      filters,
      {
        replay: {
          label: "Replay",
          when: { status: ["dead"] },
          available: (row) => !row.locked,
          handler,
        },
        unlock: { label: "Unlock", available: (row) => row.locked, handler },
      },
      { basePath: "/x" },
    );
    const byId = Object.fromEntries(
      annotate(rows).map((row) => [row.id, row._actions]),
    );
    expect(byId).toEqual({
      a: ["replay"],
      b: [],
      c: ["unlock"],
      d: [],
    });
    expect(actionsFor(rows[2])).toEqual(["unlock"]);
  });

  it("reads dotted keys the way the projection emits them", () => {
    const dotted = defineFilters([
      { key: "timing.dns", type: "slider", kind: "number", min: 0, max: 100 },
    ]);
    const { actionsFor } = defineActions<ServerDefinition>(
      dotted,
      { slow: { label: "Slow", when: { "timing.dns": [50, 100] }, handler } },
      { basePath: "/x" },
    );
    // Flat key, as `createDrizzleHandler` projects it.
    expect(actionsFor({ "timing.dns": 75 })).toEqual(["slow"]);
    expect(actionsFor({ "timing.dns": 5 })).toEqual([]);
    // Nested, as a hand-built row might carry it.
    expect(actionsFor({ timing: { dns: 75 } })).toEqual(["slow"]);
  });
});

describe("when — typed by the schema the filters were built from", () => {
  const LEVELS = ["error", "warn", "info"] as const;
  const definition = {
    level: col.enum(LEVELS).label("Level"),
    latency: col
      .number()
      .label("Latency")
      .filterable("slider", { min: 0, max: 5000 }),
    // `.notFilterable()` drops the key from `FilterValues` entirely.
    id: col.string().label("Id").notFilterable(),
  } satisfies TableSchemaDefinition;
  const typed = defineFilters(definition);
  type Def = ActionDefinitionBase<Row, FilterValues<typeof definition>>;

  it("accepts values the column can filter on, and evaluates them", () => {
    const { actionsFor } = defineActions(
      typed,
      {
        escalate: {
          label: "Escalate",
          when: { level: ["error"], latency: [1000, 5000] },
        },
      },
      { basePath: "/api/actions" },
    );
    expect(actionsFor({ level: "error", latency: 2000 })).toEqual(["escalate"]);
    expect(actionsFor({ level: "error", latency: 10 })).toEqual([]);
    expect(actionsFor({ level: "info", latency: 2000 })).toEqual([]);
  });

  it("rejects, at compile time, what `assertWhen` would reject at runtime", () => {
    // Each of these is also a runtime throw or a silent "every row"; the point
    // is that the definition never gets that far.
    // @ts-expect-error — `levl` is not a column
    const typo: Def = { label: "A", when: { levl: ["error"] } };
    // @ts-expect-error — `id` is `.notFilterable()`
    const unfilterable: Def = { label: "A", when: { id: "x" } };
    // @ts-expect-error — "fatal" is not a member of LEVELS
    const member: Def = { label: "A", when: { level: ["fatal"] } };
    // @ts-expect-error — a slider takes numbers, not a string
    const shape: Def = { label: "A", when: { latency: "slow" } };
    void [typo, unfilterable, member, shape];

    // Through inference from `filters`, not just the annotated type.
    expect(() =>
      defineActions(
        typed,
        // @ts-expect-error — `levl` is not a column
        { a: { label: "A", when: { levl: ["error"] } } },
        { basePath: "/x" },
      ),
    ).toThrow(/when."levl" is not a filterable column/);
  });

  it("stays untyped when the filters came from specs or SchemaJSON", () => {
    // `filters` above is spec-built: any key, any value, checked at runtime.
    const loose: ActionDefinitionBase = { label: "A", when: { anything: 1 } };
    expect(() =>
      defineActions(filters, { a: loose }, { basePath: "/x" }),
    ).toThrow(/not a filterable column/);
  });
});
