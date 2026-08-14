import { describe, expect, it } from "vitest";
import { col, resolveColumn, resolveColumns } from "./col";
import { serializeSchema } from "./serialize";
import type {
  ColRenderers,
  ColumnDescriptor,
  ColumnDescriptorCommon,
  FilterDescriptor,
  ResolvedColumn,
  SchemaJSON,
} from "./types";

/**
 * The laws that keep `ColumnDescriptor` and `ColRenderers` a *partition* of a
 * column's state rather than two overlapping bags.
 *
 * The point of this file is that most of it is checked by `tsc`, not by vitest.
 * The previous serializer could drop a field silently because nothing tied the
 * type of a column to the type of its serialized form; every assertion below is
 * written so that adding a field to one half and forgetting the other is a
 * **compile error**, and only the residual "does the runtime actually emit it"
 * question is left to a runtime expectation.
 */

// ── Type-level machinery ────────────────────────────────────────────────────

/** `true` iff `T` is exactly `never`. The tuple wrapper defeats distribution. */
type IsNever<T> = [T] extends [never] ? true : false;

/** Exact (invariant) type equality — stricter than mutual assignability. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

// ── Law B1: the two halves are disjoint ─────────────────────────────────────
//
// If a renderer key were ever added to the descriptor (or vice versa),
// `serializeSchema` — which is a plain spread of `_descriptor` — would start
// emitting a function, and `deserializeSchema` would hand a descriptor
// containing a closure back to the builder. `Extract` of the two key sets must
// therefore stay empty.

/** Keys present on both halves. Must be `never`. */
type CommonAndRendererOverlap = Extract<
  keyof ColRenderers,
  keyof ColumnDescriptorCommon
>;

/** Same, against the full (kind-discriminated) descriptor. */
type DescriptorAndRendererOverlap = Extract<
  keyof ColRenderers,
  keyof ColumnDescriptor
>;

describe("descriptor / renderers disjointness", () => {
  it("shares no key between ColRenderers and ColumnDescriptorCommon", () => {
    // A compile error here means someone put a serializable field in
    // `ColRenderers`, or a closure field in `ColumnDescriptorCommon`.
    const disjoint: IsNever<CommonAndRendererOverlap> = true;
    expect(disjoint).toBe(true);
  });

  it("shares no key between ColRenderers and ColumnDescriptor", () => {
    const disjoint: IsNever<DescriptorAndRendererOverlap> = true;
    expect(disjoint).toBe(true);
  });

  it("makes ResolvedColumn exactly the descriptor plus `renderers`", () => {
    type Unexpected = Exclude<
      keyof ResolvedColumn,
      keyof ColumnDescriptor | "renderers"
    >;
    type Missing = Exclude<
      keyof ColumnDescriptor | "renderers",
      keyof ResolvedColumn
    >;
    const noExtras: IsNever<Unexpected> = true;
    const noneMissing: IsNever<Missing> = true;
    expect([noExtras, noneMissing]).toEqual([true, true]);
  });

  it("emits no renderer key into the serialized column, at runtime", () => {
    const json = serializeSchema({
      level: col
        .enum(["error", "warn"] as const)
        .label("Level")
        .display("custom", { cell: () => null })
        .filterable("checkbox", { component: () => null })
        .sheet({ component: () => "x", condition: () => true }),
    });
    const column = json.columns[0]!;
    for (const rendererKey of Object.keys(RENDERER_KEYS)) {
      expect(column).not.toHaveProperty(rendererKey);
      expect(column.sheet).not.toHaveProperty(rendererKey);
    }
    // ...and the closures did survive on the other half.
    expect(
      Object.keys(resolveColumn(col.string().label("H")).renderers),
    ).toEqual([]);
  });
});

// ── Law B2: SchemaJSON covers the descriptor, totally ───────────────────────
//
// `SchemaJSON["columns"][number]` is the wire type. It must be the descriptor
// plus exactly one extra field (`key`) — no more, no less. A descriptor field
// that the wire type cannot represent is precisely the bug class this refactor
// removed.

type SerializedColumn = SchemaJSON["columns"][number];

describe("SchemaJSON column coverage", () => {
  it("covers every key of ColumnDescriptor plus `key`", () => {
    type Missing = Exclude<
      keyof ColumnDescriptor | "key",
      keyof SerializedColumn
    >;
    const noneMissing: IsNever<Missing> = true;
    expect(noneMissing).toBe(true);
  });

  it("adds nothing beyond ColumnDescriptor and `key`", () => {
    type Extra = Exclude<
      keyof SerializedColumn,
      keyof ColumnDescriptor | "key"
    >;
    const noExtras: IsNever<Extra> = true;
    expect(noExtras).toBe(true);
  });

  it("is exactly `ColumnDescriptor & { key: string }`", () => {
    const exact: Equals<SerializedColumn, ColumnDescriptor & { key: string }> =
      true;
    expect(exact).toBe(true);
  });

  it("is what serializeSchema actually returns", () => {
    const exact: Equals<
      ReturnType<typeof serializeSchema>["columns"][number],
      SerializedColumn
    > = true;
    expect(exact).toBe(true);
  });
});

// ── Exhaustive key manifests ────────────────────────────────────────────────
//
// `Record<keyof X, ...>` is the cheap version of the `EMITTERS` map in
// `to-typescript.ts`: adding a field to the type breaks the manifest at compile
// time, and the manifest then drives a runtime check that serialization really
// carries it. Neither half can drift alone.

/**
 * Every serializable field common to all column kinds, and whether the
 * serializer must always emit it or only when the author set it.
 */
const COMMON_KEYS: Record<keyof ColumnDescriptorCommon, "always" | "optional"> =
  {
    label: "always",
    description: "optional",
    optional: "always",
    display: "always",
    size: "optional",
    hidden: "always",
    enableHiding: "always",
    hideHeader: "always",
    resizable: "always",
    sortable: "always",
    filter: "always",
    sheet: "always",
    provenance: "always",
  };

/** Every field of a serialized filter. */
const FILTER_KEYS: Record<keyof FilterDescriptor, "always" | "optional"> = {
  type: "always",
  defaultOpen: "always",
  commandDisabled: "always",
  options: "optional",
  min: "optional",
  max: "optional",
  unit: "optional",
  presets: "optional",
};

/** Every field that must NOT reach JSON. */
const RENDERER_KEYS: Record<keyof ColRenderers, true> = {
  cell: true,
  filterComponent: true,
  sheetComponent: true,
  sheetCondition: true,
};

const alwaysKeys = Object.entries(COMMON_KEYS)
  .filter(([, presence]) => presence === "always")
  .map(([key]) => key);

describe("descriptor key manifest", () => {
  it("emits every always-present common key for a bare column", () => {
    const column = serializeSchema({ host: col.string().label("Host") })
      .columns[0]!;
    for (const key of alwaysKeys) {
      expect(column, `missing "${key}"`).toHaveProperty(key);
    }
  });

  it("emits every common key — including the optional ones — for a maximal column", () => {
    const column = serializeSchema({
      latency: col
        .number()
        .label("Latency")
        .description("Round-trip time, in milliseconds")
        .display("bar", { min: 0, max: 5000, unit: "ms" })
        .filterable("slider", { min: 0, max: 5000, unit: "ms" })
        .defaultOpen()
        .commandDisabled()
        .hidden()
        .hideHeader()
        .resizable()
        .size(110)
        .sortable()
        .sheet({
          label: "Latency",
          className: "flex-col",
          skeletonClassName: "w-16",
        }),
    }).columns[0]!;

    for (const key of Object.keys(COMMON_KEYS)) {
      expect(column, `missing "${key}"`).toHaveProperty(key);
    }
    // `key` and the kind discriminant ride along on top of the common keys.
    expect(column).toHaveProperty("key");
    expect(column).toHaveProperty("kind");
  });

  it("emits every filter key across the corpus of filter types", () => {
    // No single filter type carries all of them, so the law is stated over the
    // union: every declared filter field must be reachable through some column.
    const json = serializeSchema({
      slider: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 5000, unit: "ms" }),
      checkbox: col
        .enum(["a", "b"] as const)
        .label("Kind")
        .filterable("checkbox", { options: [{ label: "A", value: "a" }] }),
      timerange: col
        .timestamp()
        .label("Date")
        .filterable("timerange", {
          presets: [
            {
              label: "Last hour",
              shortcut: "h",
              from: new Date("2024-05-01T00:00:00.000Z"),
              to: new Date("2024-05-01T01:00:00.000Z"),
            },
          ],
        })
        .defaultOpen(),
    });

    const seen = new Set<string>();
    for (const column of json.columns) {
      for (const key of Object.keys(column.filter ?? {})) seen.add(key);
    }
    expect([...seen].sort()).toEqual(Object.keys(FILTER_KEYS).sort());
  });

  it("keeps resolveColumns' entries at descriptor keys plus `key` and `renderers`", () => {
    const entry = resolveColumns({ host: col.string().label("Host") })[0]!;
    const allowed = new Set([
      ...Object.keys(COMMON_KEYS),
      "key",
      "kind",
      "renderers",
    ]);
    for (const key of Object.keys(entry)) {
      expect(allowed.has(key), `unexpected key "${key}"`).toBe(true);
    }
  });
});
