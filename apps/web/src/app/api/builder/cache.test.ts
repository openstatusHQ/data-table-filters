import type { SchemaJSON } from "@dtf/registry/lib/table-schema";
import { col, createTableSchema } from "@dtf/registry/lib/table-schema";
import { describe, expect, it } from "vitest";
import { getBuilderData, storeBuilderData, updateBuilderSchema } from "./cache";

const SAMPLE_SCHEMA: SchemaJSON = createTableSchema({
  name: col.string().label("Name").filterable("input"),
}).toJSON();

const SAMPLE_DATA = [{ name: "Alice" }, { name: "Bob" }];

describe("builder cache", () => {
  describe("storeBuilderData", () => {
    it("returns a unique dataId string", () => {
      const id = storeBuilderData(SAMPLE_DATA, SAMPLE_SCHEMA);
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("returns different ids for different calls", () => {
      const id1 = storeBuilderData(SAMPLE_DATA, SAMPLE_SCHEMA);
      const id2 = storeBuilderData(SAMPLE_DATA, SAMPLE_SCHEMA);
      expect(id1).not.toBe(id2);
    });
  });

  describe("getBuilderData", () => {
    it("retrieves stored data by dataId", () => {
      const id = storeBuilderData(SAMPLE_DATA, SAMPLE_SCHEMA);
      const entry = getBuilderData(id);
      expect(entry).toBeDefined();
      expect(entry!.data).toEqual(
        SAMPLE_DATA.map((row, i) => ({ ...row, __rowId: `${i}` })),
      );
      expect(entry!.schemaJson).toEqual(SAMPLE_SCHEMA);
    });

    it("returns undefined for unknown dataId", () => {
      expect(getBuilderData("nonexistent-id")).toBeUndefined();
    });
  });

  describe("updateBuilderSchema", () => {
    it("updates the schema for an existing entry", () => {
      const id = storeBuilderData(SAMPLE_DATA, SAMPLE_SCHEMA);
      const newSchema: SchemaJSON = createTableSchema({
        name: col.string().label("Full Name").filterable("input"),
      }).toJSON();
      const result = updateBuilderSchema(id, newSchema);
      expect(result).toBe(true);
      expect(getBuilderData(id)!.schemaJson).toEqual(newSchema);
    });

    it("preserves original data after schema update", () => {
      const id = storeBuilderData(SAMPLE_DATA, SAMPLE_SCHEMA);
      const newSchema: SchemaJSON = { version: 1, columns: [] };
      updateBuilderSchema(id, newSchema);
      expect(getBuilderData(id)!.data).toEqual(
        SAMPLE_DATA.map((row, i) => ({ ...row, __rowId: `${i}` })),
      );
    });

    it("returns false for unknown dataId", () => {
      const result = updateBuilderSchema("nonexistent-id", SAMPLE_SCHEMA);
      expect(result).toBe(false);
    });
  });
});
