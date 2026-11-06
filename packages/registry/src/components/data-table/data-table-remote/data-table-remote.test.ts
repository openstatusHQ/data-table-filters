import {
  createTableManifest,
  type TableManifest,
} from "@dtf/registry/lib/table-schema";
import { describe, expect, it } from "vitest";
import { field } from "../../../lib/store/schema";
import {
  col,
  createTableSchema,
  generateFilterSchema,
} from "../../../lib/table-schema";
import {
  createRemoteSearchParamsSerializer,
  defaultDataEndpoint,
  schemaIdentity,
  toColumnFilters,
  withoutReservedFilters,
} from "./data-table-remote";

function manifestWith(keys: string[]): TableManifest {
  const definition = Object.fromEntries(
    keys.map((key) => [key, col.string().label(key)]),
  );
  return createTableManifest({
    schema: createTableSchema(definition),
    primaryKey: keys[0]!,
  });
}

describe("defaultDataEndpoint", () => {
  it("strips a trailing /schema segment", () => {
    expect(defaultDataEndpoint("/api/logs/schema")).toBe("/api/logs");
  });

  it("strips a trailing /schema/ with a slash", () => {
    expect(defaultDataEndpoint("/api/logs/schema/")).toBe("/api/logs");
  });

  it("leaves an endpoint that does not end in /schema alone", () => {
    expect(defaultDataEndpoint("/api/logs/manifest")).toBe(
      "/api/logs/manifest",
    );
    expect(defaultDataEndpoint("/api/logs")).toBe("/api/logs");
  });

  it("does not strip a /schema that is not the last segment", () => {
    expect(defaultDataEndpoint("/api/schema/logs")).toBe("/api/schema/logs");
  });

  it("falls back to root rather than an empty string", () => {
    expect(defaultDataEndpoint("/schema")).toBe("/");
  });

  it("works on an absolute URL", () => {
    expect(defaultDataEndpoint("https://api.example.com/logs/schema")).toBe(
      "https://api.example.com/logs",
    );
  });
});

describe("schemaIdentity", () => {
  it("is stable for the same column set", () => {
    expect(schemaIdentity(manifestWith(["a", "b"]))).toBe(
      schemaIdentity(manifestWith(["a", "b"])),
    );
  });

  it("changes when a column is added or removed", () => {
    expect(schemaIdentity(manifestWith(["a", "b"]))).not.toBe(
      schemaIdentity(manifestWith(["a", "b", "c"])),
    );
  });

  it("changes when columns are reordered, since column order is table state", () => {
    expect(schemaIdentity(manifestWith(["a", "b"]))).not.toBe(
      schemaIdentity(manifestWith(["b", "a"])),
    );
  });

  it("ignores capability changes, which must not reset the user's sorting", () => {
    const base = manifestWith(["a", "b"]);
    const withChart: TableManifest = {
      ...base,
      capabilities: { ...base.capabilities, chart: true },
    };
    expect(schemaIdentity(withChart)).toBe(schemaIdentity(base));
  });

  it("ignores action changes", () => {
    const base = manifestWith(["a", "b"]);
    const withActions: TableManifest = {
      ...base,
      actions: [
        { id: "x", label: "X", scope: ["row"], href: "/api/actions/x" },
      ],
    };
    expect(schemaIdentity(withActions)).toBe(schemaIdentity(base));
  });
});

describe("createRemoteSearchParamsSerializer", () => {
  // The same derivation `RemoteTable` runs on a manifest's columns.
  const { definition } = generateFilterSchema(
    {
      level: col.enum(["success", "error"] as const).filterable("checkbox"),
      latency: col.number().filterable("slider", { min: 0, max: 5000 }),
      date: col.timestamp().filterable("timerange"),
      host: col.string().filterable("input"),
    },
    {
      sort: field.sort(),
      uuid: field.string(),
      live: field.boolean().default(false),
    },
  );
  const serialize = createRemoteSearchParamsSerializer(definition);
  const read = (query: string) =>
    Object.fromEntries(new URLSearchParams(query));

  it("returns an empty string when nothing is set", () => {
    expect(serialize({})).toBe("");
    expect(serialize({ level: [], host: null, sort: undefined })).toBe("");
  });

  it("writes schema keys the way the URL state does", () => {
    const query = serialize({
      level: ["success", "error"],
      latency: [100, 3000],
      host: "acme.com",
      sort: { id: "date", desc: true },
    });
    expect(query.startsWith("?")).toBe(true);
    expect(read(query)).toEqual({
      level: "success,error",
      latency: "100-3000",
      host: "acme.com",
      sort: "date.desc",
    });
  });

  it("writes a timerange as epoch milliseconds", () => {
    const query = serialize({ date: [new Date(1000), new Date(2000)] });
    expect(read(query)).toEqual({ date: "1000-2000" });
  });

  it("passes the pagination strategy's keys through", () => {
    // Regression: an allow-list serializer drops `cursor` and `direction`,
    // which are not columns, and every request is then the first page.
    const query = serialize({
      cursor: new Date(1700000000000),
      direction: "prev",
      offset: 40,
      size: 20,
    });
    expect(read(query)).toEqual({
      cursor: "1700000000000",
      direction: "prev",
      offset: "40",
      size: "20",
    });
  });

  it("keeps a zero offset", () => {
    expect(read(serialize({ offset: 0 }))).toEqual({ offset: "0" });
  });

  it("drops values it cannot write", () => {
    expect(serialize({ cursor: new Date("nope") })).toBe("");
    expect(serialize({ extra: { nested: true } })).toBe("");
  });

  it("does not resolve inherited keys as parsers", () => {
    expect(read(serialize({ toString: "x" }))).toEqual({ toString: "x" });
  });
});

describe("toColumnFilters", () => {
  it("keeps filters and drops empty ones", () => {
    expect(
      toColumnFilters({ level: ["error"], host: null, regions: [] }),
    ).toEqual([{ id: "level", value: ["error"] }]);
  });

  it("leaves out the view state that shares the URL with the filters", () => {
    // Regression: `uuid` and `live` reached the table as column filters for
    // columns that do not exist.
    expect(
      toColumnFilters({
        sort: { id: "date", desc: true },
        uuid: "abc",
        live: true,
        level: ["error"],
      }),
    ).toEqual([{ id: "level", value: ["error"] }]);
  });
});

describe("withoutReservedFilters", () => {
  const schemaOf = (definition: Parameters<typeof createTableSchema>[0]) =>
    createTableSchema(definition).toJSON();

  it("returns the same schema when no filter collides", () => {
    const schema = schemaOf({
      // A column may be *named* `uuid`; it is only a filter on it that collides.
      uuid: col.string().label("ID").notFilterable(),
      host: col.string().label("Host").filterable("input"),
    });
    const warnings: string[] = [];
    expect(withoutReservedFilters(schema, (m) => warnings.push(m))).toBe(
      schema,
    );
    expect(warnings).toEqual([]);
  });

  it("drops the filter, keeps the column, and says so", () => {
    // Regression: a filterable column keyed `uuid` shared its URL parameter
    // with the open row, so its control rendered and never applied.
    const schema = schemaOf({
      uuid: col.string().label("ID").filterable("input"),
      size: col.number().label("Size").filterable("slider", { min: 0, max: 9 }),
      host: col.string().label("Host").filterable("input"),
    });
    const warnings: string[] = [];
    const result = withoutReservedFilters(schema, (m) => warnings.push(m));

    const filters = Object.fromEntries(
      result.columns.map((column) => [column.key, column.filter?.type ?? null]),
    );
    expect(filters).toEqual({ uuid: null, size: null, host: "input" });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('"uuid"');
    // The input is not mutated.
    expect(schema.columns[0].filter).not.toBeNull();
  });
});
