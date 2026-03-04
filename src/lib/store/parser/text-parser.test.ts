import { describe, expect, it } from "vitest";
import { field } from "../schema/field";
import { createTextParser } from "./text-parser";

const schema = {
  level: field.array(field.stringLiteral(["error", "warn", "info"] as const)),
  path: field.string(),
  latency: field.array(field.number()).delimiter("-"),
};

describe("createTextParser", () => {
  describe("parse", () => {
    it("parses simple key:value pairs", () => {
      const parser = createTextParser(schema);
      const result = parser.parse("path:/api/users");
      expect(result.path).toBe("/api/users");
    });

    it("parses array values", () => {
      const parser = createTextParser(schema);
      const result = parser.parse("level:error,warn");
      expect(result.level).toEqual(["error", "warn"]);
    });

    it("parses multiple fields separated by space", () => {
      const parser = createTextParser(schema);
      const result = parser.parse("level:error path:/api");
      expect(result.level).toEqual(["error"]);
      expect(result.path).toBe("/api");
    });

    it("returns empty for empty input", () => {
      const parser = createTextParser(schema);
      expect(parser.parse("")).toEqual({});
      expect(parser.parse("   ")).toEqual({});
    });

    it("skips unknown fields", () => {
      const parser = createTextParser(schema);
      const result = parser.parse("unknown:value level:error");
      expect(result.level).toEqual(["error"]);
      expect(result).not.toHaveProperty("unknown");
    });

    it("skips parts without key:value format", () => {
      const parser = createTextParser(schema);
      const result = parser.parse("just-text level:error");
      expect(result.level).toEqual(["error"]);
    });

    it("resolves aliases", () => {
      const parser = createTextParser(schema, { aliases: { l: "level" } });
      const result = parser.parse("l:error,warn");
      expect(result.level).toEqual(["error", "warn"]);
    });

    it("skips entries with empty value after colon", () => {
      const parser = createTextParser(schema);
      const result = parser.parse("level:");
      expect(result).toEqual({});
    });
  });

  describe("serialize", () => {
    it("serializes state to text", () => {
      const parser = createTextParser(schema);
      const result = parser.serialize({ level: ["error", "warn"] });
      expect(result).toBe("level:error,warn");
    });

    it("serializes multiple fields", () => {
      const parser = createTextParser(schema);
      const result = parser.serialize({ level: ["error"], path: "/api" });
      expect(result).toContain("level:error");
      expect(result).toContain("path:/api");
    });

    it("skips null/undefined values", () => {
      const parser = createTextParser(schema);
      const result = parser.serialize({ path: null, level: [] });
      expect(result).toBe("");
    });

    it("skips empty arrays", () => {
      const parser = createTextParser(schema);
      const result = parser.serialize({ level: [] });
      expect(result).toBe("");
    });
  });

  describe("getWordAtCaret", () => {
    it("finds word at caret position", () => {
      const parser = createTextParser(schema);
      const result = parser.getWordAtCaret("level:error path:test", 5);
      expect(result.word).toBe("level:error");
      expect(result.field).toBe("level");
      expect(result.value).toBe("error");
    });

    it("finds second word when caret is in it", () => {
      const parser = createTextParser(schema);
      const result = parser.getWordAtCaret("level:error path:test", 15);
      expect(result.word).toBe("path:test");
      expect(result.field).toBe("path");
    });

    it("returns null field/value for non-key:value word", () => {
      const parser = createTextParser(schema);
      const result = parser.getWordAtCaret("partial", 3);
      expect(result.field).toBeNull();
      expect(result.value).toBeNull();
    });

    it("resolves aliases in word detection", () => {
      const parser = createTextParser(schema, { aliases: { l: "level" } });
      const result = parser.getWordAtCaret("l:error", 3);
      expect(result.field).toBe("level");
    });
  });

  describe("replaceWordAtCaret", () => {
    it("replaces word at caret position", () => {
      const parser = createTextParser(schema);
      const { newInput, newCaretPosition } = parser.replaceWordAtCaret(
        "level:err path:test",
        7,
        "level:error",
      );
      expect(newInput).toBe("level:error path:test");
      expect(newCaretPosition).toBe(11);
    });

    it("replaces at end of input", () => {
      const parser = createTextParser(schema);
      const { newInput } = parser.replaceWordAtCaret("level:error pat", 15, "path:test");
      expect(newInput).toBe("level:error path:test");
    });
  });

  describe("getSuggestions", () => {
    const fieldOptions = {
      level: ["error", "warn", "info"],
      path: ["/api/users", "/api/orders"],
    };

    it("suggests field names when no field is typed", () => {
      const parser = createTextParser(schema);
      const result = parser.getSuggestions("", 0, fieldOptions);
      expect(result.type).toBe("field");
      expect(result.suggestions).toContain("level");
      expect(result.suggestions).toContain("path");
    });

    it("suggests field names filtered by partial input", () => {
      const parser = createTextParser(schema);
      const result = parser.getSuggestions("le", 2, fieldOptions);
      expect(result.type).toBe("field");
      expect(result.suggestions).toContain("level");
      expect(result.suggestions).not.toContain("path");
    });

    it("suggests values when field is known", () => {
      const parser = createTextParser(schema);
      const result = parser.getSuggestions("level:er", 8, fieldOptions);
      expect(result.type).toBe("value");
      expect(result.field).toBe("level");
      expect(result.suggestions).toContain("error");
    });

    it("includes aliases in field suggestions", () => {
      const parser = createTextParser(schema, { aliases: { l: "level" } });
      const result = parser.getSuggestions("", 0, fieldOptions);
      expect(result.suggestions).toContain("l");
    });
  });
});
