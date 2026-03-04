import { describe, expect, it } from "vitest";
import { storeBuilderData, getBuilderData, updateBuilderSchema } from "./cache";
import type { SchemaJSON } from "@/lib/table-schema";

const SAMPLE_SCHEMA: SchemaJSON = {
  columns: [
    { key: "name", dataType: "string", label: "Name", optional: false, hidden: false, sortable: false, filter: { type: "input", defaultOpen: false, commandDisabled: false }, display: { type: "text" }, sheet: null },
  ],
};

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
      expect(entry!.data).toEqual(SAMPLE_DATA);
      expect(entry!.schemaJson).toEqual(SAMPLE_SCHEMA);
    });

    it("returns undefined for unknown dataId", () => {
      expect(getBuilderData("nonexistent-id")).toBeUndefined();
    });
  });

  describe("updateBuilderSchema", () => {
    it("updates the schema for an existing entry", () => {
      const id = storeBuilderData(SAMPLE_DATA, SAMPLE_SCHEMA);
      const newSchema: SchemaJSON = {
        columns: [
          { id: "name", kind: "string", label: "Full Name", filter: { type: "input" }, display: { type: "text" } },
        ],
      };
      const result = updateBuilderSchema(id, newSchema);
      expect(result).toBe(true);
      expect(getBuilderData(id)!.schemaJson).toEqual(newSchema);
    });

    it("preserves original data after schema update", () => {
      const id = storeBuilderData(SAMPLE_DATA, SAMPLE_SCHEMA);
      const newSchema: SchemaJSON = { columns: [] };
      updateBuilderSchema(id, newSchema);
      expect(getBuilderData(id)!.data).toEqual(SAMPLE_DATA);
    });

    it("returns false for unknown dataId", () => {
      const result = updateBuilderSchema("nonexistent-id", SAMPLE_SCHEMA);
      expect(result).toBe(false);
    });
  });
});
