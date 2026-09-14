import {
  createTableManifest,
  type TableManifest,
} from "@dtf/registry/lib/table-schema";
import { describe, expect, it } from "vitest";
import { col, createTableSchema } from "../../../lib/table-schema";
import { defaultDataEndpoint, schemaIdentity } from "./data-table-remote";

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
