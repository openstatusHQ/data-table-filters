import type { ActionDescriptor } from "@dtf/registry/lib/actions/types";
import { sanitizeActionDescriptors } from "@dtf/registry/lib/actions/validate";
import type { ActionValidationOptions } from "@dtf/registry/lib/actions/validate";
import { migrateSchemaJSON } from "./serialize";
import type { SchemaJSON } from "./types";

/**
 * The table manifest — what an endpoint says about itself.
 *
 * This is the missing half of the headless story. The schema was already
 * serializable, but every consumer built it locally from TypeScript, so
 * "point the table at a URL" was never actually possible. A manifest is that
 * URL's answer: the schema, which column identifies a row, what the server can
 * and cannot compute, and what may be done to a row.
 *
 * It is fetched over the network from a server the app may not own, so
 * `parseTableManifest` treats every field as untrusted and bounded.
 */

/** Bump alongside a migration step in `parseTableManifest`. */
export const TABLE_MANIFEST_VERSION = 1;

/**
 * What the endpoint can compute.
 *
 * The client used to assume all of it. An endpoint that cannot group facets or
 * count matching rows had no way to say so, and the UI had no way to degrade —
 * it simply rendered empty filters and a blank count. Each flag here is a thing
 * the table will stop asking for, or compute on the client instead.
 */
export type TableCapabilities = {
  /** `meta.facets` is populated. When false, facet counts come from loaded rows. */
  facets: boolean;
  /**
   * The columns the server can facet, when it can only do some. Omitted means
   * "every filterable column".
   */
  facetedColumns?: readonly string[];
  /** `meta.totalRowCount` is meaningful. */
  totalRowCount: boolean;
  /** `meta.filterRowCount` is meaningful. */
  filterRowCount: boolean;
  /** `meta.chartData` is populated. When false, the chart slot is not rendered. */
  chart: boolean;
  /** `prevCursor` is honoured — the precondition for live mode. */
  backwardPagination: boolean;
  /** `meta.actions` and the per-row `_actions` stamp are populated. */
  actions: boolean;
};

/**
 * The conservative reading of an endpoint that said nothing.
 *
 * Everything optional is off: a table that renders no chart against a server
 * that has one is a missing feature, while a table that renders a chart against
 * a server that has none is a broken screen.
 */
export const DEFAULT_CAPABILITIES: TableCapabilities = {
  facets: false,
  totalRowCount: false,
  filterRowCount: false,
  chart: false,
  backwardPagination: false,
  actions: false,
};

/**
 * How the timeline chart is drawn.
 *
 * `meta.chartData` is `{ timestamp, [series]: number }[]`, and until now which
 * column it bucketed, which series it carried, and what colour each series took
 * were all decided in app code. A table pointed at an endpoint has none of that,
 * so the endpoint states it.
 */
export type TableChartConfig = {
  /** The timestamp column the buckets are over. Must be a column in the schema. */
  columnKey: string;
  /** The numeric series in each point, in stacking order. */
  series: { key: string; label?: string; color?: string }[];
  /** Bucket width in milliseconds, when the endpoint has a fixed one. */
  intervalMs?: number;
};

export type TableManifestDefaults = {
  sort?: { id: string; desc: boolean };
  size?: number;
  columnVisibility?: Record<string, boolean>;
};

export type TableManifest = {
  version: number;
  schema: SchemaJSON;
  /**
   * The column that identifies a row on the wire.
   *
   * Actions key rows by it and the sheet resolves the open row through it. It
   * used to be a closure written by hand at each call site
   * (`getRowId={(row) => row.uuid}`), which is exactly the kind of thing a
   * pointed-at table cannot supply.
   */
  primaryKey: string;
  /**
   * A human name for a row, as a template over column keys:
   * `"{method} {pathname}"`. Used for accessible labels, never for identity.
   */
  rowLabel?: string;
  capabilities: TableCapabilities;
  /** Present when `capabilities.chart` is true. */
  chart?: TableChartConfig;
  actions?: ActionDescriptor[];
  defaults?: TableManifestDefaults;
};

/**
 * Build a manifest from a table schema.
 *
 * The server side of the contract. `createTableSchema(...)` already produces
 * the `SchemaJSON`; this names the row identity and states what the endpoint
 * can actually compute, which are the two things the schema alone never said.
 */
export function createTableManifest(config: {
  schema: { toJSON(): SchemaJSON } | SchemaJSON;
  primaryKey: string;
  rowLabel?: string;
  capabilities?: Partial<TableCapabilities>;
  chart?: TableChartConfig;
  actions?: ActionDescriptor[];
  defaults?: TableManifestDefaults;
}): TableManifest {
  const schema =
    "toJSON" in config.schema ? config.schema.toJSON() : config.schema;

  if (!schema.columns.some((column) => column.key === config.primaryKey)) {
    // Caught here rather than at the client, which would only be able to blank
    // the table and say the endpoint was wrong.
    throw new TableManifestError(
      `primaryKey ${JSON.stringify(config.primaryKey)} is not a column in the schema`,
    );
  }

  return {
    version: TABLE_MANIFEST_VERSION,
    schema,
    primaryKey: config.primaryKey,
    ...(config.rowLabel ? { rowLabel: config.rowLabel } : {}),
    capabilities: { ...DEFAULT_CAPABILITIES, ...config.capabilities },
    ...(config.chart ? { chart: config.chart } : {}),
    ...(config.actions?.length ? { actions: config.actions } : {}),
    ...(config.defaults ? { defaults: config.defaults } : {}),
  };
}

// ── Bounds ──────────────────────────────────────────────────────────────────

/**
 * Caps on an incoming manifest.
 *
 * A remote schema drives column generation, filter rendering and URL state, so
 * an unbounded one is a way to hang the tab. These are deliberately far above
 * any real table.
 */
export const MANIFEST_LIMITS = {
  maxColumns: 200,
  maxKeyLength: 200,
  maxLabelLength: 500,
  maxActions: 50,
} as const;

/**
 * Path segments that reach an object's prototype rather than its own data.
 *
 * Column keys are server-authored. `definition[key] = builder` with a
 * `"__proto__"` key does not add an own property — it reassigns the object's
 * prototype, so the column silently vanishes from every `Object.keys` consumer
 * with none of the warnings every other rejected input here produces. As a
 * `primaryKey` it is worse: `getRowId` returns `"[object Object]"` for every
 * row, collapsing selection and bulk actions onto a single id.
 */
const RESERVED_SEGMENTS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/** True when every segment of a dotted key addresses own data. */
export function isSafeColumnKey(key: string): boolean {
  return key.split(".").every((segment) => !RESERVED_SEGMENTS.has(segment));
}

export class TableManifestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TableManifestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCapabilities(value: unknown): TableCapabilities {
  if (!isRecord(value)) return { ...DEFAULT_CAPABILITIES };
  const facetedColumns = Array.isArray(value.facetedColumns)
    ? value.facetedColumns.filter(
        (key): key is string =>
          typeof key === "string" && key.length <= MANIFEST_LIMITS.maxKeyLength,
      )
    : undefined;
  return {
    facets: value.facets === true,
    ...(facetedColumns ? { facetedColumns } : {}),
    totalRowCount: value.totalRowCount === true,
    filterRowCount: value.filterRowCount === true,
    chart: value.chart === true,
    backwardPagination: value.backwardPagination === true,
    actions: value.actions === true,
  };
}

function parseDefaults(
  value: unknown,
  keys: ReadonlySet<string>,
): TableManifestDefaults | undefined {
  if (!isRecord(value)) return undefined;
  const defaults: TableManifestDefaults = {};

  if (isRecord(value.sort) && typeof value.sort.id === "string") {
    // A default sort on a column that does not exist would be written straight
    // into the URL and then fail to resolve against the table.
    if (keys.has(value.sort.id)) {
      defaults.sort = { id: value.sort.id, desc: value.sort.desc === true };
    }
  }

  if (
    typeof value.size === "number" &&
    Number.isInteger(value.size) &&
    value.size > 0
  ) {
    defaults.size = value.size;
  }

  if (isRecord(value.columnVisibility)) {
    const visibility: Record<string, boolean> = {};
    for (const [key, visible] of Object.entries(value.columnVisibility)) {
      if (keys.has(key) && typeof visible === "boolean") {
        visibility[key] = visible;
      }
    }
    if (Object.keys(visibility).length > 0) {
      defaults.columnVisibility = visibility;
    }
  }

  return Object.keys(defaults).length > 0 ? defaults : undefined;
}

function parseChart(
  value: unknown,
  keys: ReadonlySet<string>,
  warn: (message: string) => void,
): TableChartConfig | undefined {
  if (!isRecord(value)) return undefined;

  if (typeof value.columnKey !== "string" || !keys.has(value.columnKey)) {
    // Without a column to bucket over there is nothing to draw, and a chart
    // pinned to a column that no longer exists is worse than no chart.
    warn("Dropped the chart config: `columnKey` names no column in the schema");
    return undefined;
  }

  const series = (Array.isArray(value.series) ? value.series : [])
    .filter(
      (item): item is Record<string, unknown> =>
        isRecord(item) &&
        typeof item.key === "string" &&
        item.key.length > 0 &&
        item.key.length <= MANIFEST_LIMITS.maxKeyLength,
    )
    .slice(0, MANIFEST_LIMITS.maxColumns)
    .map((item) => ({
      key: item.key as string,
      ...(typeof item.label === "string" ? { label: item.label } : {}),
      ...(typeof item.color === "string" ? { color: item.color } : {}),
    }));

  if (series.length === 0) {
    warn("Dropped the chart config: it declares no series");
    return undefined;
  }

  return {
    columnKey: value.columnKey,
    series,
    ...(typeof value.intervalMs === "number" && value.intervalMs > 0
      ? { intervalMs: value.intervalMs }
      : {}),
  };
}

export type ParseManifestOptions = {
  /** Passed to the action validator — see `sanitizeActionDescriptors`. */
  actionValidation?: ActionValidationOptions;
  /** Called with anything dropped, so a host can log it. */
  onWarning?: (message: string) => void;
};

/**
 * Validate and normalize an untrusted manifest.
 *
 * Throws only for the failures that leave nothing renderable — a missing
 * schema, no columns, no usable primary key. Everything else is repaired or
 * dropped with a warning, because one bad column should not blank the table.
 */
export function parseTableManifest(
  value: unknown,
  options?: ParseManifestOptions,
): TableManifest {
  const warn = options?.onWarning ?? (() => {});

  if (!isRecord(value)) {
    throw new TableManifestError("Manifest is not an object");
  }

  // `migrateSchemaJSON` already normalizes every descriptor field and brings
  // older versions forward, so this only has to add the bounds it does not. Its
  // own rejection is re-thrown as a `TableManifestError` so that a caller has
  // one error type to catch for "this endpoint did not answer with a manifest".
  let schema: SchemaJSON;
  try {
    schema = migrateSchemaJSON(value.schema);
  } catch (cause) {
    throw new TableManifestError(
      `Manifest schema is not usable: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }

  if (schema.columns.length === 0) {
    throw new TableManifestError("Manifest schema has no columns");
  }
  if (schema.columns.length > MANIFEST_LIMITS.maxColumns) {
    throw new TableManifestError(
      `Manifest schema has ${schema.columns.length} columns, over the limit of ${MANIFEST_LIMITS.maxColumns}`,
    );
  }

  const seenKeys = new Set<string>();
  const columns = schema.columns.filter((column) => {
    if (column.key.length === 0) {
      warn("Dropped a column with an empty key");
      return false;
    }
    if (column.key.length > MANIFEST_LIMITS.maxKeyLength) {
      warn(`Dropped column ${JSON.stringify(column.key)}: key too long`);
      return false;
    }
    if (!isSafeColumnKey(column.key)) {
      warn(`Dropped column ${JSON.stringify(column.key)}: reserved key`);
      return false;
    }
    // An empty label is not merely ugly: `createTableSchema.fromJSON` rejects
    // it, which throws inside the component and blanks the whole table.
    if (column.label.length === 0) {
      warn(`Dropped column ${JSON.stringify(column.key)}: empty label`);
      return false;
    }
    if (column.label.length > MANIFEST_LIMITS.maxLabelLength) {
      warn(`Dropped column ${JSON.stringify(column.key)}: label too long`);
      return false;
    }
    // The definition is keyed by column key, so a duplicate would silently
    // overwrite the first with no diagnostic.
    if (seenKeys.has(column.key)) {
      warn(`Dropped column ${JSON.stringify(column.key)}: duplicate key`);
      return false;
    }
    seenKeys.add(column.key);
    return true;
  });

  if (columns.length === 0) {
    throw new TableManifestError("Manifest schema has no usable columns");
  }

  const keys = new Set(columns.map((column) => column.key));

  const primaryKey =
    typeof value.primaryKey === "string" && keys.has(value.primaryKey)
      ? value.primaryKey
      : null;
  if (!primaryKey) {
    throw new TableManifestError(
      "Manifest primaryKey is missing or names a column that does not exist",
    );
  }

  const capabilities = parseCapabilities(value.capabilities);

  const { actions, rejected } = sanitizeActionDescriptors(
    Array.isArray(value.actions)
      ? value.actions.slice(0, MANIFEST_LIMITS.maxActions)
      : undefined,
    options?.actionValidation,
  );
  for (const rejection of rejected) {
    warn(`Dropped action ${rejection.id}: ${rejection.reason}`);
  }

  return {
    version: TABLE_MANIFEST_VERSION,
    schema: { version: schema.version, columns },
    primaryKey,
    ...(typeof value.rowLabel === "string" &&
    value.rowLabel.length <= MANIFEST_LIMITS.maxLabelLength
      ? { rowLabel: value.rowLabel }
      : {}),
    capabilities,
    ...(() => {
      const chart = parseChart(value.chart, keys, warn);
      return chart ? { chart } : {};
    })(),
    ...(actions.length > 0 ? { actions } : {}),
    ...(() => {
      const defaults = parseDefaults(value.defaults, keys);
      return defaults ? { defaults } : {};
    })(),
  };
}

// ── ETag ────────────────────────────────────────────────────────────────────

/**
 * FNV-1a over the serialized manifest.
 *
 * A schema changes on deploy, not per request, so the point of the ETag is to
 * turn the client's revalidation into a 304 rather than a re-download. A
 * non-cryptographic hash is the right tool: this guards cache freshness, not
 * integrity.
 */
export function manifestETag(manifest: TableManifest): string {
  const json = JSON.stringify(manifest);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `"${hash.toString(16)}-${json.length.toString(16)}"`;
}

// ── Server ──────────────────────────────────────────────────────────────────

export type ManifestHandlerOptions = {
  /**
   * `Cache-Control` for the response. The default revalidates every time and
   * relies on the ETag for the cheap path, which is the safe default for
   * something that changes on deploy without a version in its URL.
   */
  cacheControl?: string;
  /** Extra response headers — CORS, most likely. */
  headers?: Record<string, string>;
};

/**
 * A `Request → Response` handler serving the manifest, with ETag revalidation.
 *
 * Pass a function rather than a value when the manifest depends on the request
 * — per-tenant columns, or actions that depend on the caller's permissions.
 */
export function createTableManifestHandler(
  manifest: TableManifest | ((request: Request) => TableManifest),
  options?: ManifestHandlerOptions,
) {
  return async function handler(request: Request): Promise<Response> {
    const resolved =
      typeof manifest === "function" ? manifest(request) : manifest;
    const etag = manifestETag(resolved);

    const headers: Record<string, string> = {
      "content-type": "application/json",
      etag,
      "cache-control": options?.cacheControl ?? "no-cache",
      ...options?.headers,
    };

    // `If-None-Match` may carry a list, and a proxy may have weakened the tag.
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch) {
      const candidates = ifNoneMatch
        .split(",")
        .map((value) => value.trim().replace(/^W\//, ""));
      if (candidates.includes(etag) || candidates.includes("*")) {
        return new Response(null, { status: 304, headers });
      }
    }

    return new Response(JSON.stringify(resolved), { status: 200, headers });
  };
}

// ── Client ──────────────────────────────────────────────────────────────────

export type FetchManifestOptions = ParseManifestOptions & {
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  credentials?: RequestCredentials;
  fetch?: typeof fetch;
  signal?: AbortSignal;
};

/**
 * Fetch and validate a manifest.
 *
 * Deliberately not wired to React Query here — the manifest is needed *before*
 * the query layer exists, because the URL-state adapter is built from it.
 */
export async function fetchTableManifest(
  url: string,
  options?: FetchManifestOptions,
): Promise<TableManifest> {
  const doFetch = options?.fetch ?? fetch;
  const headers =
    typeof options?.headers === "function"
      ? await options.headers()
      : options?.headers;

  const response = await doFetch(url, {
    headers,
    credentials: options?.credentials,
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new TableManifestError(
      `Could not load the table manifest from ${url}: ${response.status} ${response.statusText}`.trim(),
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new TableManifestError(
      `The table manifest at ${url} is not valid JSON`,
      { cause },
    );
  }

  return parseTableManifest(payload, options);
}

// ── Row accessors ───────────────────────────────────────────────────────────

/** Reads a possibly-dotted key path off a row. */
function readPath(row: unknown, path: string): unknown {
  if (row === null || typeof row !== "object") return undefined;
  if (!isSafeColumnKey(path)) return undefined;
  const record = row as Record<string, unknown>;
  // Rows may carry the dotted key literally — `createDrizzleHandler` projects
  // `"timing.dns"` as a flat property — so the exact key wins before walking.
  if (Object.hasOwn(record, path)) return record[path];
  if (!path.includes(".")) return undefined;
  let current: unknown = row;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    // Own data only. `isSafeColumnKey` is a name list and cannot catch
    // `"meta.toString"`, which otherwise resolves an inherited method — the
    // same value on every row, collapsing every row id onto one.
    if (!Object.hasOwn(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export type RowAccessors<TRow> = {
  /** The row's wire identity, from `manifest.primaryKey`. */
  getRowId: (row: TRow) => string;
  /**
   * A human name for the row, from `manifest.rowLabel`. `undefined` when the
   * manifest declared none — callers then fall back to static copy rather than
   * reading an internal id out loud.
   */
  getRowLabel?: (row: TRow) => string;
};

/**
 * Derive `getRowId` / `getRowLabel` from a manifest.
 *
 * These were hand-written closures at every call site
 * (`getRowId={(row) => row.uuid}`), which a table pointed at an endpoint cannot
 * supply. `rowLabel` is a template over column keys — `"{method} {pathname}"` —
 * with unknown keys left as written, so a typo is visible rather than silent.
 */
export function createRowAccessors<TRow = unknown>(
  manifest: Pick<TableManifest, "primaryKey" | "rowLabel">,
): RowAccessors<TRow> {
  const getRowId = (row: TRow): string => {
    const value = readPath(row, manifest.primaryKey);
    // Coerced rather than asserted: the id addresses a row in the DOM and on
    // the wire, and a numeric primary key is perfectly ordinary.
    return value === null || value === undefined ? "" : String(value);
  };

  const template = manifest.rowLabel;
  if (!template) return { getRowId };

  return {
    getRowId,
    getRowLabel: (row: TRow): string =>
      template.replace(/\{([^{}]+)\}/g, (match, key: string) => {
        const value = readPath(row, key.trim());
        return value === null || value === undefined ? match : String(value);
      }),
  };
}
