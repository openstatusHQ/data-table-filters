import type { Filters } from "@dtf/registry/lib/filters";
import {
  ROW_ACTIONS_KEY,
  type ActionDescriptor,
  type ActionScope,
  type ActionVariant,
  type WithRowActions,
} from "./types";

/**
 * The declarative half of an action — everything except how it executes.
 *
 * `createActionHandler` (Drizzle) adds the `handler`; this module never looks
 * at it, which is what keeps `annotate` and `descriptors` importable anywhere.
 */
export type ActionDefinitionBase<
  TRow = Record<string, unknown>,
  TValues = Record<string, unknown>,
> = {
  label: string;
  /** Defaults to `["row", "bulk"]`. */
  scope?: ActionScope[];
  variant?: ActionVariant;
  /**
   * Confirmation copy. `{count}` is replaced with the affected row count and
   * `{one|other}` picks a form by it: `"Delete {count} {log|logs}?"`.
   */
  confirm?: string;
  /**
   * Availability, as filter values — `{ status: ["dead"] }` — in exactly the
   * shape the list endpoint reads from its search params.
   *
   * One declaration, two engines: `filters.matches` evaluates it per row to
   * compute `_actions`, and the SQL engine compiles it into the handler's WHERE
   * guard. Keys must be filterable columns; anything else throws at
   * construction rather than silently matching every row.
   *
   * Typed by the `Filters` the actions are defined against: from a table
   * schema definition, `TValues` is `FilterValues<typeof definition>`, so a
   * key that is not a filterable column or a value the column cannot filter
   * on (`{ level: ["fatal"] }` against `col.enum(LEVELS)`) is a compile
   * error before it is a runtime one.
   */
  when?: Partial<TValues>;
  /**
   * JS-only escape hatch for availability the filter semantics cannot express
   * (a computed field, a non-filterable column). It only shapes `_actions`;
   * there is no SQL counterpart, so the handler must guard itself.
   */
  available?: (row: TRow) => boolean;
};

export type DefineActionsOptions = {
  /** `href` is `${basePath}/${id}`. */
  basePath: string;
  /** Published on `bulk` descriptors as `maxIds`. */
  maxIds?: number;
};

export type DefinedActions<TDef extends ActionDefinitionBase<never>> = {
  /** The declarations, with defaults applied. Keyed by id. */
  definitions: ReadonlyMap<string, TDef & { scope: ActionScope[] }>;
  /** Public metadata for the wire. Same order as declared. */
  descriptors: ActionDescriptor[];
  /** Stamp every row with the ids it currently qualifies for. */
  annotate<TRow>(rows: readonly TRow[]): WithRowActions<TRow>[];
  /** The ids one row qualifies for. */
  actionsFor(row: unknown): string[];
};

const DEFAULT_SCOPE: ActionScope[] = ["row", "bulk"];

/**
 * An id is a URL segment and an audit-log key. Keep it boring. The leading
 * letter is not taste: `Object.entries` hoists integer-like keys (`"1"`,
 * `"42"`) to the front in numeric order, which would silently reorder
 * `descriptors` and the menus built from them.
 */
const ID_PATTERN = /^[a-z][a-z0-9_-]*$/;

/**
 * The pick-list. Adding a field to `ActionDescriptor` fails to compile here
 * until it is either projected or deliberately excluded — the failure mode
 * this guards against is `{ ...definition }` leaking a handler, a secret, or a
 * `when` clause the server never meant to publish.
 */
const PUBLIC_KEYS = {
  id: true,
  label: true,
  scope: true,
  variant: true,
  confirm: true,
  href: true,
  maxIds: true,
} as const satisfies Record<keyof ActionDescriptor, true>;

type _PublicKeysExhaustive = [
  Exclude<keyof ActionDescriptor, keyof typeof PUBLIC_KEYS>,
] extends [never]
  ? true
  : never;
const _publicKeysExhaustive: _PublicKeysExhaustive = true;
void _publicKeysExhaustive;

function toDescriptor(
  id: string,
  definition: ActionDefinitionBase<never> & { scope: ActionScope[] },
  options: DefineActionsOptions,
): ActionDescriptor {
  const descriptor: ActionDescriptor = {
    id,
    label: definition.label,
    scope: [...definition.scope],
    href: `${options.basePath}/${id}`,
  };
  // Optional keys are only present when set, so the JSON stays canonical.
  if (definition.variant !== undefined) descriptor.variant = definition.variant;
  if (definition.confirm !== undefined) descriptor.confirm = definition.confirm;
  // Only a bulk request can carry more than one id, so only there does the
  // limit mean anything to the client.
  if (options.maxIds !== undefined && definition.scope.includes("bulk")) {
    descriptor.maxIds = options.maxIds;
  }
  return descriptor;
}

/**
 * Validate a `when` clause against the declared filter semantics.
 *
 * `filters.plan` silently drops unknown keys and inactive values, which is
 * right for search params and wrong for an availability guard: a typo would
 * turn "only dead rows" into "every row". So every key must be a spec, and
 * every value must plan to an op.
 */
function assertWhen(
  id: string,
  when: Record<string, unknown>,
  filters: Filters,
): void {
  for (const key of Object.keys(when)) {
    if (!filters.spec(key)) {
      throw new Error(
        `[defineActions] Action "${id}": when.${JSON.stringify(key)} is not a filterable column. ` +
          `Filterable: ${filters.specs.map((spec) => spec.key).join(", ") || "(none)"}`,
      );
    }
    const ops = filters.plan({ [key]: when[key] });
    if (ops.length === 0) {
      throw new Error(
        `[defineActions] Action "${id}": when.${JSON.stringify(key)} is not an active filter value ` +
          `(got ${JSON.stringify(when[key])}). An empty guard would match every row.`,
      );
    }
  }
}

/**
 * Turn action declarations into the two things the rest of the system needs:
 * public descriptors for the wire, and a per-row availability stamp.
 *
 * Generic over the definition type so the Drizzle handler can carry its
 * `handler` through without this module depending on Drizzle, and over the
 * filter values so `when` is checked against the columns `filters` declares.
 */
export function defineActions<
  TDef extends ActionDefinitionBase<never, TValues>,
  TValues extends Record<string, unknown> = Record<string, unknown>,
>(
  filters: Filters<TValues>,
  actions: Record<string, TDef>,
  options: DefineActionsOptions,
): DefinedActions<TDef> {
  const basePath = options.basePath.replace(/\/+$/, "");
  if (basePath.length === 0) {
    throw new Error(`[defineActions] basePath must be a non-empty path`);
  }
  if (
    options.maxIds !== undefined &&
    (!Number.isInteger(options.maxIds) || options.maxIds < 1)
  ) {
    throw new Error(
      `[defineActions] maxIds must be a positive integer, got ${String(options.maxIds)}`,
    );
  }
  const resolved: DefineActionsOptions = { ...options, basePath };

  const definitions = new Map<string, TDef & { scope: ActionScope[] }>();
  const descriptors: ActionDescriptor[] = [];

  for (const [id, definition] of Object.entries(actions)) {
    if (!ID_PATTERN.test(id)) {
      throw new Error(
        `[defineActions] Action id ${JSON.stringify(id)} must match ${ID_PATTERN} — it becomes a URL segment.`,
      );
    }
    if (!definition.label) {
      throw new Error(`[defineActions] Action "${id}" needs a label`);
    }

    const scope = Array.from(new Set(definition.scope ?? DEFAULT_SCOPE));
    if (scope.length === 0) {
      throw new Error(`[defineActions] Action "${id}" declares an empty scope`);
    }

    if (definition.when) assertWhen(id, definition.when, filters);

    const withDefaults = { ...definition, scope };
    definitions.set(id, withDefaults);
    descriptors.push(toDescriptor(id, withDefaults, resolved));
  }

  const actionsFor = (row: unknown): string[] => {
    const ids: string[] = [];
    for (const [id, definition] of definitions) {
      if (definition.when && !filters.matches(definition.when, row)) continue;
      if (definition.available && !definition.available(row as never)) continue;
      ids.push(id);
    }
    return ids;
  };

  return {
    definitions,
    descriptors,
    actionsFor,
    annotate: (rows) =>
      rows.map((row) => ({ ...row, [ROW_ACTIONS_KEY]: actionsFor(row) })),
  };
}
