import { describe, expect, it } from "vitest";
import { field } from "../../schema/field";
import { createSchemaSerializer, schemaToNuqsParsers } from "./parser-bridge";

describe("schemaToNuqsParsers", () => {
  it("creates parsers for all schema fields", () => {
    const schema = {
      path: field.string(),
      count: field.number(),
      active: field.boolean(),
    };
    const parsers = schemaToNuqsParsers(schema);
    expect(parsers.path).toBeDefined();
    expect(parsers.count).toBeDefined();
    expect(parsers.active).toBeDefined();
  });

  it("creates parser for timestamp field", () => {
    const schema = { date: field.timestamp() };
    const parsers = schemaToNuqsParsers(schema);
    expect(parsers.date).toBeDefined();
  });

  it("creates parser for stringLiteral field", () => {
    const schema = {
      level: field.stringLiteral(["error", "warn"] as const),
    };
    const parsers = schemaToNuqsParsers(schema);
    expect(parsers.level).toBeDefined();
  });

  it("creates parser for array field", () => {
    const schema = {
      levels: field.array(field.stringLiteral(["error", "warn"] as const)),
    };
    const parsers = schemaToNuqsParsers(schema);
    expect(parsers.levels).toBeDefined();
  });

  it("creates parser for sort field", () => {
    const schema = { sort: field.sort() };
    const parsers = schemaToNuqsParsers(schema);
    expect(parsers.sort).toBeDefined();
  });

  it("handles empty schema", () => {
    const parsers = schemaToNuqsParsers({});
    expect(Object.keys(parsers)).toHaveLength(0);
  });
});

describe("createSchemaSerializer", () => {
  it("creates a serializer function", () => {
    const schema = {
      path: field.string(),
      level: field.array(field.stringLiteral(["error", "warn"] as const)),
    };
    const serialize = createSchemaSerializer(schema);
    expect(typeof serialize).toBe("function");
  });

  it("serializes state to URL search string", () => {
    const schema = {
      path: field.string(),
    };
    const serialize = createSchemaSerializer(schema);
    const result = serialize({ path: "test" });
    expect(result).toContain("path=test");
  });

  it("returns empty string for empty/null state", () => {
    const schema = {
      path: field.string(),
    };
    const serialize = createSchemaSerializer(schema);
    expect(serialize({ path: null })).toBe("");
    expect(serialize({})).toBe("");
  });

  it("skips empty arrays", () => {
    const schema = {
      levels: field.array(field.string()),
    };
    const serialize = createSchemaSerializer(schema);
    expect(serialize({ levels: [] })).toBe("");
  });
});
