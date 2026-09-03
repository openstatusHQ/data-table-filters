import { col } from "./col";
import { presets } from "./presets";
import type {
  ColBuilder,
  ColumnDescriptor,
  ColumnDescriptorCommon,
  DatePresetDescriptor,
  JsonValue,
  SchemaJSON,
} from "./types";

/**
 * Emit the `col.*` / `col.presets.*` factory call a descriptor came from, and
 * produce the descriptor that call yields on its own.
 *
 * Provenance is recorded at construction, so this reads it instead of
 * pattern-matching the descriptor's shape back into a guess at the preset.
 */
function factoryFor(c: ColumnDescriptor): {
  source: string;
  baseline: ColumnDescriptor;
} {
  if (c.provenance.source === "preset") {
    const factory = presets[c.provenance.preset as keyof typeof presets];
    if (typeof factory === "function") {
      const args = c.provenance.args;
      // Re-running the preset with its recorded arguments gives the exact
      // baseline the author started from, so the chain below emits only what
      // they actually changed.
      const builder = (
        factory as (...a: unknown[]) => ColBuilder<unknown, any>
      )(...args.map((a) => (a === null ? undefined : a)));
      return {
        source: `col.presets.${c.provenance.preset}(${args.map(emitValue).join(", ")})`,
        baseline: builder._descriptor,
      };
    }
    // Unknown preset name (schema written by a newer build) — fall through to
    // the primitive factory rather than emitting a call that will not compile.
  }

  if (c.kind === "enum") {
    return {
      source: `col.enum([${c.enumValues.map(emitValue).join(", ")}])`,
      baseline: col.enum(c.enumValues)._descriptor,
    };
  }

  if (c.kind === "array") {
    const item = factoryFor(c.arrayItem);
    const itemChain = chainFor(c.arrayItem, item.baseline);
    // `col.array()` requires an item builder — emitting a bare `col.array()`
    // is what used to produce code that did not compile.
    const itemSource = item.source + itemChain.join("");
    return {
      source: `col.array(${itemSource})`,
      baseline: col.array(rebuild(c.arrayItem))._descriptor,
    };
  }

  const factory = col[c.kind] as () => ColBuilder<unknown, any>;
  return { source: `col.${c.kind}()`, baseline: factory()._descriptor };
}

/** Rebuild a builder from a descriptor — used to seed `col.array`'s baseline. */
function rebuild(c: ColumnDescriptor): ColBuilder<unknown, any> {
  if (c.kind === "enum") return col.enum(c.enumValues);
  if (c.kind === "array") return col.array(rebuild(c.arrayItem));
  return (col[c.kind] as () => ColBuilder<unknown, any>)();
}

function emitValue(value: JsonValue | readonly string[] | undefined): string {
  if (value === undefined || value === null) return "undefined";
  // Arrays are spaced by hand so preset args (`logLevel(["a", "b"])`) match the
  // per-value assembly used elsewhere (`col.enum(["a", "b"])`) — bare
  // `JSON.stringify` would emit one of them without spaces.
  if (Array.isArray(value)) {
    return `[${value.map((v) => emitValue(v as JsonValue)).join(", ")}]`;
  }
  return JSON.stringify(value);
}

/**
 * Emit a timerange preset.
 *
 * The descriptor stores `from`/`to` as ISO strings so they survive JSON, but
 * `.filterable("timerange", { presets })` takes `DatePreset`s holding real
 * `Date`s — printing the descriptor verbatim produced code that threw
 * `preset.from.toISOString is not a function` on the first run.
 */
function emitDatePreset(preset: DatePresetDescriptor): string {
  return (
    `{ label: ${JSON.stringify(preset.label)}, ` +
    `shortcut: ${JSON.stringify(preset.shortcut)}, ` +
    `from: new Date(${JSON.stringify(preset.from)}), ` +
    `to: new Date(${JSON.stringify(preset.to)}) }`
  );
}

/** Emit an object literal with unquoted keys, matching the docs' house style. */
function emitObject(entries: Record<string, unknown>): string {
  const parts = Object.entries(entries)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `{ ${parts.join(", ")} }`;
}

function sameJSON(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * One emitter per serializable descriptor field.
 *
 * The `-?` plus full key coverage means adding a field to
 * `ColumnDescriptorCommon` without adding an emitter here is a **compile
 * error**, not a silently dropped chain step.
 */
type Emitter<K extends keyof ColumnDescriptorCommon> = (
  value: ColumnDescriptorCommon[K],
  baseline: ColumnDescriptor,
  descriptor: ColumnDescriptor,
) => string[];

type EmitterMap = { [K in keyof ColumnDescriptorCommon]-?: Emitter<K> };

const EMITTERS: EmitterMap = {
  label: (value) => [`.label(${JSON.stringify(value)})`],

  description: (value) =>
    value === undefined ? [] : [`.description(${JSON.stringify(value)})`],

  display: (value) => {
    const { type, ...options } = value as { type: string } & Record<
      string,
      unknown
    >;
    const hasOptions = Object.values(options).some((v) => v !== undefined);
    return [
      hasOptions
        ? `.display(${JSON.stringify(type)}, ${emitObject(options)})`
        : `.display(${JSON.stringify(type)})`,
    ];
  },

  filter: (value) => {
    if (value === null) return [".notFilterable()"];
    const parts: string[] = [];
    const { type, defaultOpen, commandDisabled, options, presets, ...rest } =
      value;

    if (type === "checkbox") {
      parts.push(
        options
          ? `.filterable("checkbox", { options: [${options
              .map((o) => emitObject({ label: o.label, value: o.value }))
              .join(", ")}] })`
          : `.filterable("checkbox")`,
      );
    } else if (type === "slider") {
      parts.push(`.filterable("slider", ${emitObject(rest)})`);
    } else if (type === "timerange") {
      parts.push(
        presets
          ? `.filterable("timerange", { presets: [${presets
              .map(emitDatePreset)
              .join(", ")}] })`
          : `.filterable("timerange")`,
      );
    } else {
      parts.push(`.filterable("input")`);
    }

    if (defaultOpen) parts.push(".defaultOpen()");
    if (commandDisabled) parts.push(".commandDisabled()");
    return parts;
  },

  sheet: (value) => {
    if (value === null) return [];
    const args = emitObject(value as Record<string, unknown>);
    return [args === "{  }" ? ".sheet()" : `.sheet(${args})`];
  },

  size: (value) => (value === undefined ? [] : [`.size(${value})`]),
  minSize: (value) => (value === undefined ? [] : [`.minSize(${value})`]),
  hidden: (value) => (value ? [".hidden()"] : []),
  hideHeader: (value) => (value ? [".hideHeader()"] : []),
  resizable: (value) => (value ? [".resizable()"] : []),
  sortable: (value) => (value ? [".sortable()"] : []),
  optional: (value) => (value ? [".optional()"] : []),

  // `enableHiding: false` together with `hidden` is exactly `.sheetOnly()`;
  // on its own it is only reachable via `col.select()`, whose baseline already
  // has it, so nothing needs emitting.
  enableHiding: (value, _baseline, descriptor) =>
    value === false && descriptor.hidden ? [".sheetOnly()"] : [],

  // Not a chain step — provenance is how the factory call was chosen.
  provenance: () => [],
};

/**
 * The order chain steps are emitted in. Listed explicitly because `.sheetOnly()`
 * clears the filter and must come after `.filterable()` would have set it.
 */
export const EMIT_ORDER: (keyof ColumnDescriptorCommon)[] = [
  "label",
  "description",
  "display",
  "filter",
  "enableHiding",
  "sortable",
  "hidden",
  "hideHeader",
  "resizable",
  "optional",
  "size",
  "minSize",
  "sheet",
];

/** Emit only the steps where the descriptor differs from the factory baseline. */
function chainFor(c: ColumnDescriptor, baseline: ColumnDescriptor): string[] {
  const parts: string[] = [];
  for (const key of EMIT_ORDER) {
    const value = c[key];
    if (sameJSON(value, baseline[key])) continue;
    // `.sheetOnly()` already implies `.hidden()` and `.notFilterable()`.
    //
    // The `filter === null` check is the whole reason this branch is safe:
    // without it, any descriptor shaped like a sheet-only column had its
    // filter dropped from the emitted source, silently. `validateSchema`
    // rejects that combination, so it can only arrive here through a raw
    // `SchemaJSON` that never went through a schema — and then the filter is
    // emitted rather than swallowed.
    if (
      c.enableHiding === false &&
      c.hidden &&
      c.filter === null &&
      baseline.enableHiding !== false &&
      (key === "hidden" || key === "filter")
    ) {
      continue;
    }
    const emit = EMITTERS[key] as Emitter<typeof key>;
    parts.push(...emit(value as never, baseline, c));
  }
  return parts;
}

/**
 * Convert a `SchemaJSON` descriptor to a `createTableSchema(...)` TypeScript
 * source code string.
 *
 * The output is ready to copy-paste into a project that imports from
 * `@/lib/table-schema`. Custom cell renderers are not serialized, so the
 * emitted chain uses the descriptor's fallback display for those columns.
 *
 * @example
 * ```ts
 * const ts = schemaToTypeScript(tableSchema.toJSON());
 * // → 'import { createTableSchema, col } from "@dtf/registry/lib/table-schema"; ...'
 * ```
 */
export function schemaToTypeScript(json: SchemaJSON): string {
  const lines: string[] = [
    'import { createTableSchema, col } from "@dtf/registry/lib/table-schema";',
    "",
    "export const schema = createTableSchema({",
  ];

  for (const { key, ...descriptor } of json.columns) {
    const c = descriptor as ColumnDescriptor;
    const { source, baseline } = factoryFor(c);
    const chain = [source, ...chainFor(c, baseline)].join("\n    ");
    lines.push(`  ${key}: ${chain},`);
  }

  lines.push("});");
  return lines.join("\n");
}
