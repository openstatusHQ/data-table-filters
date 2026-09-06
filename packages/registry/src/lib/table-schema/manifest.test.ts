import { describe, expect, it, vi } from "vitest";
import { col } from "./col";
import { createTableSchema } from "./index";
import {
  createTableManifest,
  createTableManifestHandler,
  DEFAULT_CAPABILITIES,
  fetchTableManifest,
  MANIFEST_LIMITS,
  manifestETag,
  parseTableManifest,
  TABLE_MANIFEST_VERSION,
  TableManifestError,
  type TableManifest,
} from "./manifest";

const tableSchema = createTableSchema({
  uuid: col.string().label("ID"),
  level: col
    .enum(["error", "warn", "info"])
    .label("Level")
    .filterable("checkbox"),
  date: col.timestamp().label("Date").sortable(),
  host: col.string().label("Host").filterable("input"),
});

function manifest(overrides?: Partial<TableManifest>): TableManifest {
  return {
    ...createTableManifest({
      schema: tableSchema,
      primaryKey: "uuid",
      capabilities: { facets: true, totalRowCount: true },
    }),
    ...overrides,
  };
}

// ── createTableManifest ─────────────────────────────────────────────────────

describe("createTableManifest", () => {
  it("serializes the schema and stamps the version", () => {
    const result = createTableManifest({
      schema: tableSchema,
      primaryKey: "uuid",
    });
    expect(result.version).toBe(TABLE_MANIFEST_VERSION);
    expect(result.schema.columns.map((c) => c.key)).toEqual([
      "uuid",
      "level",
      "date",
      "host",
    ]);
  });

  it("accepts a plain SchemaJSON as well as a builder", () => {
    const json = tableSchema.toJSON();
    expect(
      createTableManifest({ schema: json, primaryKey: "uuid" }).schema,
    ).toEqual(json);
  });

  it("defaults every capability to off", () => {
    expect(
      createTableManifest({ schema: tableSchema, primaryKey: "uuid" })
        .capabilities,
    ).toEqual(DEFAULT_CAPABILITIES);
  });

  it("merges declared capabilities over the defaults", () => {
    expect(
      createTableManifest({
        schema: tableSchema,
        primaryKey: "uuid",
        capabilities: { facets: true, chart: true },
      }).capabilities,
    ).toMatchObject({
      facets: true,
      chart: true,
      backwardPagination: false,
    });
  });

  it("refuses a primaryKey that is not a column", () => {
    expect(() =>
      createTableManifest({ schema: tableSchema, primaryKey: "nope" }),
    ).toThrow(TableManifestError);
  });

  it("omits empty optional fields rather than writing nulls", () => {
    const result = createTableManifest({
      schema: tableSchema,
      primaryKey: "uuid",
      actions: [],
    });
    expect(result).not.toHaveProperty("actions");
    expect(result).not.toHaveProperty("rowLabel");
    expect(result).not.toHaveProperty("defaults");
  });
});

// ── parseTableManifest ──────────────────────────────────────────────────────

describe("parseTableManifest", () => {
  it("round-trips a manifest through JSON", () => {
    const original = manifest();
    const parsed = parseTableManifest(JSON.parse(JSON.stringify(original)));
    expect(parsed.primaryKey).toBe("uuid");
    expect(parsed.capabilities.facets).toBe(true);
    expect(parsed.schema.columns.map((c) => c.key)).toEqual(
      original.schema.columns.map((c) => c.key),
    );
  });

  it("throws on a non-object", () => {
    expect(() => parseTableManifest(null)).toThrow(TableManifestError);
    expect(() => parseTableManifest("{}")).toThrow(TableManifestError);
  });

  it("throws when the schema has no columns", () => {
    expect(() =>
      parseTableManifest({
        schema: { version: 1, columns: [] },
        primaryKey: "a",
      }),
    ).toThrow(/no columns/);
  });

  it("throws when there are more columns than the limit", () => {
    const columns = Array.from(
      { length: MANIFEST_LIMITS.maxColumns + 1 },
      (_, i) => ({ key: `c${i}`, kind: "string", label: `C${i}` }),
    );
    expect(() =>
      parseTableManifest({
        schema: { version: 1, columns },
        primaryKey: "c0",
      }),
    ).toThrow(/over the limit/);
  });

  it("throws when primaryKey is missing or names an unknown column", () => {
    const json = manifest();
    expect(() =>
      parseTableManifest({ ...json, primaryKey: undefined }),
    ).toThrow(/primaryKey/);
    expect(() => parseTableManifest({ ...json, primaryKey: "ghost" })).toThrow(
      /primaryKey/,
    );
  });

  it("drops a column with an empty or over-long key and warns", () => {
    const warnings: string[] = [];
    const parsed = parseTableManifest(
      {
        schema: {
          version: 1,
          columns: [
            { key: "uuid", kind: "string", label: "ID" },
            { key: "", kind: "string", label: "Nameless" },
            { key: "x".repeat(201), kind: "string", label: "Long" },
          ],
        },
        primaryKey: "uuid",
      },
      { onWarning: (message) => warnings.push(message) },
    );

    expect(parsed.schema.columns.map((c) => c.key)).toEqual(["uuid"]);
    expect(warnings).toHaveLength(2);
  });

  it("throws when every column was dropped", () => {
    expect(() =>
      parseTableManifest({
        schema: { version: 1, columns: [{ key: "", kind: "string" }] },
        primaryKey: "uuid",
      }),
    ).toThrow(/no usable columns/);
  });

  it("treats missing capabilities as all-off", () => {
    const parsed = parseTableManifest({
      schema: tableSchema.toJSON(),
      primaryKey: "uuid",
    });
    expect(parsed.capabilities).toEqual(DEFAULT_CAPABILITIES);
  });

  it("coerces non-boolean capability values rather than trusting them", () => {
    const parsed = parseTableManifest({
      schema: tableSchema.toJSON(),
      primaryKey: "uuid",
      capabilities: { facets: "yes", chart: 1, totalRowCount: true },
    });
    expect(parsed.capabilities.facets).toBe(false);
    expect(parsed.capabilities.chart).toBe(false);
    expect(parsed.capabilities.totalRowCount).toBe(true);
  });

  it("keeps facetedColumns as strings only", () => {
    const parsed = parseTableManifest({
      schema: tableSchema.toJSON(),
      primaryKey: "uuid",
      capabilities: { facets: true, facetedColumns: ["level", 7, null] },
    });
    expect(parsed.capabilities.facetedColumns).toEqual(["level"]);
  });

  it("drops a default sort on a column that does not exist", () => {
    const parsed = parseTableManifest({
      schema: tableSchema.toJSON(),
      primaryKey: "uuid",
      defaults: { sort: { id: "ghost", desc: true } },
    });
    expect(parsed.defaults).toBeUndefined();
  });

  it("keeps a default sort, size and visibility that resolve", () => {
    const parsed = parseTableManifest({
      schema: tableSchema.toJSON(),
      primaryKey: "uuid",
      defaults: {
        sort: { id: "date", desc: true },
        size: 40,
        columnVisibility: { host: false, ghost: false },
      },
    });
    expect(parsed.defaults).toEqual({
      sort: { id: "date", desc: true },
      size: 40,
      columnVisibility: { host: false },
    });
  });

  it("rejects a non-positive default size", () => {
    const parsed = parseTableManifest({
      schema: tableSchema.toJSON(),
      primaryKey: "uuid",
      defaults: { size: 0 },
    });
    expect(parsed.defaults).toBeUndefined();
  });

  it("drops actions with an unsafe href and warns", () => {
    const warnings: string[] = [];
    const parsed = parseTableManifest(
      {
        schema: tableSchema.toJSON(),
        primaryKey: "uuid",
        actions: [
          { id: "ok", label: "Replay", scope: ["row"], href: "/api/replay" },
          {
            id: "bad",
            label: "Exfiltrate",
            scope: ["row"],
            href: "https://evil.example.com/x",
          },
        ],
      },
      {
        actionValidation: { selfOrigin: "https://app.example.com" },
        onWarning: (message) => warnings.push(message),
      },
    );

    expect(parsed.actions?.map((a) => a.id)).toEqual(["ok"]);
    expect(warnings[0]).toContain("bad");
  });

  it("caps the number of actions", () => {
    const actions = Array.from(
      { length: MANIFEST_LIMITS.maxActions + 10 },
      (_, i) => ({
        id: `a${i}`,
        label: `A${i}`,
        scope: ["row"],
        href: `/api/a${i}`,
      }),
    );
    const parsed = parseTableManifest({
      schema: tableSchema.toJSON(),
      primaryKey: "uuid",
      actions,
    });
    expect(parsed.actions).toHaveLength(MANIFEST_LIMITS.maxActions);
  });

  it("drops an over-long rowLabel", () => {
    const parsed = parseTableManifest({
      schema: tableSchema.toJSON(),
      primaryKey: "uuid",
      rowLabel: "x".repeat(501),
    });
    expect(parsed.rowLabel).toBeUndefined();
  });

  it("migrates a v0 schema forward", () => {
    const parsed = parseTableManifest({
      schema: {
        columns: [
          { key: "uuid", dataType: "string", label: "ID" },
          { key: "date", dataType: "timestamp", label: "Date" },
        ],
      },
      primaryKey: "uuid",
    });
    expect(parsed.schema.version).toBe(1);
    expect(parsed.schema.columns[1]!.kind).toBe("timestamp");
  });
});

// ── Chart config ────────────────────────────────────────────────────────────

describe("chart config", () => {
  const base = {
    schema: tableSchema.toJSON(),
    primaryKey: "uuid",
    capabilities: { chart: true },
  };

  it("round-trips a well-formed chart config", () => {
    const parsed = parseTableManifest({
      ...base,
      chart: {
        columnKey: "date",
        series: [
          { key: "error", label: "Errors", color: "#f00" },
          { key: "info" },
        ],
        intervalMs: 60_000,
      },
    });

    expect(parsed.chart).toEqual({
      columnKey: "date",
      series: [
        { key: "error", label: "Errors", color: "#f00" },
        { key: "info" },
      ],
      intervalMs: 60_000,
    });
  });

  it("drops a chart pinned to a column that does not exist", () => {
    const warnings: string[] = [];
    const parsed = parseTableManifest(
      { ...base, chart: { columnKey: "ghost", series: [{ key: "error" }] } },
      { onWarning: (message) => warnings.push(message) },
    );

    expect(parsed.chart).toBeUndefined();
    expect(warnings[0]).toContain("columnKey");
  });

  it("drops a chart with no usable series", () => {
    const parsed = parseTableManifest({
      ...base,
      chart: { columnKey: "date", series: [{ label: "no key" }, 7] },
    });
    expect(parsed.chart).toBeUndefined();
  });

  it("keeps the valid series and discards malformed ones", () => {
    const parsed = parseTableManifest({
      ...base,
      chart: { columnKey: "date", series: [{ key: "error" }, null, { x: 1 }] },
    });
    expect(parsed.chart?.series).toEqual([{ key: "error" }]);
  });

  it("ignores a non-positive interval", () => {
    const parsed = parseTableManifest({
      ...base,
      chart: { columnKey: "date", series: [{ key: "error" }], intervalMs: 0 },
    });
    expect(parsed.chart?.intervalMs).toBeUndefined();
  });

  it("is absent when the manifest declares none", () => {
    expect(parseTableManifest(base).chart).toBeUndefined();
  });

  it("is carried through createTableManifest", () => {
    const built = createTableManifest({
      schema: tableSchema,
      primaryKey: "uuid",
      capabilities: { chart: true },
      chart: { columnKey: "date", series: [{ key: "error" }] },
    });
    expect(built.chart?.columnKey).toBe("date");
  });
});

// ── ETag ────────────────────────────────────────────────────────────────────

describe("manifestETag", () => {
  it("is stable for the same manifest", () => {
    expect(manifestETag(manifest())).toBe(manifestETag(manifest()));
  });

  it("changes when the manifest changes", () => {
    expect(manifestETag(manifest())).not.toBe(
      manifestETag(manifest({ primaryKey: "host" })),
    );
  });

  it("is a quoted entity tag", () => {
    expect(manifestETag(manifest())).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/);
  });
});

// ── Handler ─────────────────────────────────────────────────────────────────

describe("createTableManifestHandler", () => {
  it("serves the manifest with an ETag", async () => {
    const handler = createTableManifestHandler(manifest());
    const response = await handler(
      new Request("https://app.example.com/schema"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("etag")).toBeTruthy();
    expect((await response.json()).primaryKey).toBe("uuid");
  });

  it("answers 304 when the ETag matches", async () => {
    const handler = createTableManifestHandler(manifest());
    const etag = manifestETag(manifest());

    const response = await handler(
      new Request("https://app.example.com/schema", {
        headers: { "if-none-match": etag },
      }),
    );

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
  });

  it("answers 304 for a weak tag and for a list", async () => {
    const handler = createTableManifestHandler(manifest());
    const etag = manifestETag(manifest());

    expect(
      (
        await handler(
          new Request("https://app.example.com/schema", {
            headers: { "if-none-match": `W/${etag}` },
          }),
        )
      ).status,
    ).toBe(304);

    expect(
      (
        await handler(
          new Request("https://app.example.com/schema", {
            headers: { "if-none-match": `"other", ${etag}` },
          }),
        )
      ).status,
    ).toBe(304);
  });

  it("answers 200 when the ETag does not match", async () => {
    const handler = createTableManifestHandler(manifest());
    const response = await handler(
      new Request("https://app.example.com/schema", {
        headers: { "if-none-match": '"stale"' },
      }),
    );
    expect(response.status).toBe(200);
  });

  it("calls a function manifest per request", async () => {
    const build = vi.fn(() => manifest());
    const handler = createTableManifestHandler(build);
    await handler(new Request("https://app.example.com/schema"));
    await handler(new Request("https://app.example.com/schema"));
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("passes through extra headers and cache-control", async () => {
    const handler = createTableManifestHandler(manifest(), {
      cacheControl: "public, max-age=60",
      headers: { "access-control-allow-origin": "*" },
    });
    const response = await handler(
      new Request("https://app.example.com/schema"),
    );
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});

// ── fetchTableManifest ──────────────────────────────────────────────────────

describe("fetchTableManifest", () => {
  it("fetches, validates and returns the manifest", async () => {
    const handler = createTableManifestHandler(manifest());
    const result = await fetchTableManifest("https://api.example.com/schema", {
      fetch: ((url: string) =>
        handler(new Request(url))) as unknown as typeof fetch,
    });
    expect(result.primaryKey).toBe("uuid");
  });

  it("sends resolved headers and credentials", async () => {
    const handler = createTableManifestHandler(manifest());
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
      handler(new Request(url, { headers: init?.headers })),
    );

    await fetchTableManifest("https://api.example.com/schema", {
      fetch: fetchMock as unknown as typeof fetch,
      headers: async () => ({ authorization: "Bearer token" }),
      credentials: "include",
    });

    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      headers: { authorization: "Bearer token" },
      credentials: "include",
    });
  });

  it("throws TableManifestError on a non-2xx", async () => {
    const error = await fetchTableManifest("https://api.example.com/schema", {
      fetch: (async () =>
        new Response("nope", {
          status: 404,
          statusText: "Not Found",
        })) as unknown as typeof fetch,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(TableManifestError);
    expect(error.message).toContain("404");
  });

  it("throws TableManifestError on a non-JSON body", async () => {
    const error = await fetchTableManifest("https://api.example.com/schema", {
      fetch: (async () => new Response("<html/>")) as unknown as typeof fetch,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(TableManifestError);
    expect(error.message).toContain("not valid JSON");
  });

  it("throws when the payload is JSON but not a manifest", async () => {
    const error = await fetchTableManifest("https://api.example.com/schema", {
      fetch: (async () =>
        new Response(
          JSON.stringify({ hello: "world" }),
        )) as unknown as typeof fetch,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(TableManifestError);
  });
});
