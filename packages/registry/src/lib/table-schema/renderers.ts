import { createColBuilder } from "./col";
import { isSafeColumnKey } from "./manifest";
import type {
  ColRenderers,
  ColumnDescriptor,
  TableSchemaDefinition,
} from "./types";

/**
 * Attaching renderers to a schema that came over the wire.
 *
 * `serialize.ts` is explicit that the four renderers — the display cell, the
 * filter component, the sheet component and its condition — are closures and
 * cannot be serialized. A deserialized column therefore falls back to whatever
 * named display its descriptor carries, which is why the descriptor keeps a
 * real display type even when a custom renderer was originally supplied.
 *
 * The named displays (`badge`, `bar`, `status-code`, `level-indicator`, …)
 * already cover most of what a table needs, and they travel as data. This
 * module is the escape hatch for the rest: an app pointed at a remote schema
 * supplies the handful of columns it wants to draw itself, by key, and keeps
 * every other column's declarative rendering.
 *
 * @example
 * ```ts
 * const { definition } = createTableSchema.fromJSON(manifest.schema);
 * const withRenderers = applyRenderers(definition, {
 *   pathname: { cell: (value) => <PathnameCell value={String(value)} /> },
 *   timing: { sheetComponent: (row) => <TimingPhases row={row} /> },
 * });
 * ```
 */

/** Renderer closures to attach, keyed by column key. */
export type RendererOverrides = Record<string, ColRenderers>;

export type ApplyRenderersOptions = {
  /**
   * Called for an override whose key is not in the schema.
   *
   * Worth listening to: a remote schema can drop a column between deploys, and
   * an override left behind for it is silently dead. The default warns to the
   * console rather than throwing, because one stale override should not blank
   * a table.
   */
  onUnknownKey?: (key: string) => void;
};

function defaultOnUnknownKey(key: string): void {
  console.warn(
    `[applyRenderers] no column ${JSON.stringify(key)} in the schema — ` +
      `the override will not be used. Did the endpoint's schema change?`,
  );
}

/**
 * Return a copy of `definition` with the given renderers attached.
 *
 * Non-mutating: builders are immutable, so each overridden column is rebuilt
 * over the same descriptor with the merged renderers. Columns with no override
 * are passed through by reference.
 *
 * Only the renderer keys present in an override are set; passing
 * `{ cell }` leaves an existing `sheetComponent` alone.
 */
export function applyRenderers(
  definition: TableSchemaDefinition,
  overrides: RendererOverrides,
  options?: ApplyRenderersOptions,
): TableSchemaDefinition {
  const onUnknownKey = options?.onUnknownKey ?? defaultOnUnknownKey;
  const keys = Object.keys(overrides);
  if (keys.length === 0) return definition;

  for (const key of keys) {
    // `in` walks the prototype chain, so `toString` would read as a column.
    if (!Object.hasOwn(definition, key)) onUnknownKey(key);
  }

  const result: TableSchemaDefinition = {};
  for (const [key, builder] of Object.entries(definition)) {
    // A reserved key would reassign the result's prototype instead of adding a
    // column, silently dropping it from every `Object.keys` consumer.
    const override = isSafeColumnKey(key)
      ? Object.hasOwn(overrides, key)
        ? overrides[key]
        : undefined
      : undefined;
    if (!override) {
      result[key] = builder;
      continue;
    }
    result[key] = createColBuilder(
      builder._descriptor as ColumnDescriptor,
      // The descriptor is untouched: an override changes how a column draws,
      // never what it is. `toJSON()` on the result still round-trips.
      { ...builder._renderers, ...override },
    );
  }
  return result;
}

/**
 * The display types a schema can name without shipping code.
 *
 * Exported so a tool — a schema builder UI, an agent writing a schema, a
 * validator — can enumerate what is available declaratively before reaching
 * for {@link applyRenderers}.
 */
export const NAMED_DISPLAY_TYPES = [
  "text",
  "code",
  "boolean",
  "star",
  "badge",
  "timestamp",
  "number",
  "bar",
  "heatmap",
  "gauge",
  "status-code",
  "level-indicator",
] as const;

export type NamedDisplayType = (typeof NAMED_DISPLAY_TYPES)[number];

/** Is this display type one the renderer can draw from the descriptor alone? */
export function isNamedDisplayType(type: string): type is NamedDisplayType {
  return (NAMED_DISPLAY_TYPES as readonly string[]).includes(type);
}
