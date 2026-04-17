import { describe, expect, it } from "vitest";
import { field } from "./field";

describe("field builders", () => {
  // -- string --

  describe("field.string()", () => {
    const f = field.string();

    it("has type 'string' and default null", () => {
      expect(f._config.type).toBe("string");
      expect(f._config.defaultValue).toBeNull();
    });

    it("serializes string to string", () => {
      expect(f._config.serialize("hello")).toBe("hello");
    });

    it("serializes null to empty string", () => {
      expect(f._config.serialize(null)).toBe("");
    });

    it("parses non-empty string", () => {
      expect(f._config.parse("hello")).toBe("hello");
    });

    it("parses empty string to null", () => {
      expect(f._config.parse("")).toBeNull();
    });
  });

  // -- number --

  describe("field.number()", () => {
    const f = field.number();

    it("has type 'number' and default null", () => {
      expect(f._config.type).toBe("number");
      expect(f._config.defaultValue).toBeNull();
    });

    it("serializes number to string", () => {
      expect(f._config.serialize(42)).toBe("42");
    });

    it("parses valid integer string", () => {
      expect(f._config.parse("42")).toBe(42);
    });

    it("parses negative numbers", () => {
      expect(f._config.parse("-5")).toBe(-5);
    });

    it("returns null for NaN", () => {
      expect(f._config.parse("abc")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(f._config.parse("")).toBeNull();
    });
  });

  // -- boolean --

  describe("field.boolean()", () => {
    const f = field.boolean();

    it("has type 'boolean' and default null", () => {
      expect(f._config.type).toBe("boolean");
    });

    it("serializes true/false to string", () => {
      expect(f._config.serialize(true)).toBe("true");
      expect(f._config.serialize(false)).toBe("false");
    });

    it("parses 'true' and 'false'", () => {
      expect(f._config.parse("true")).toBe(true);
      expect(f._config.parse("false")).toBe(false);
    });

    it("returns null for other strings", () => {
      expect(f._config.parse("yes")).toBeNull();
      expect(f._config.parse("")).toBeNull();
    });
  });

  // -- timestamp --

  describe("field.timestamp()", () => {
    const f = field.timestamp();

    it("has type 'timestamp' and default null", () => {
      expect(f._config.type).toBe("timestamp");
    });

    it("serializes Date to epoch ms string", () => {
      const d = new Date("2024-01-15T00:00:00Z");
      expect(f._config.serialize(d)).toBe(String(d.getTime()));
    });

    it("parses epoch ms string to Date", () => {
      const d = new Date("2024-01-15T00:00:00Z");
      const parsed = f._config.parse(String(d.getTime()));
      expect(parsed).toBeInstanceOf(Date);
      expect((parsed as Date).getTime()).toBe(d.getTime());
    });

    it("returns null for empty string", () => {
      expect(f._config.parse("")).toBeNull();
    });

    it("returns null for invalid time", () => {
      expect(f._config.parse("abc")).toBeNull();
    });
  });

  // -- stringLiteral --

  describe("field.stringLiteral()", () => {
    const LEVELS = ["error", "warn", "info"] as const;
    const f = field.stringLiteral(LEVELS);

    it("has type 'stringLiteral'", () => {
      expect(f._config.type).toBe("stringLiteral");
    });

    it("parses valid literal", () => {
      expect(f._config.parse("error")).toBe("error");
    });

    it("returns null for invalid literal", () => {
      expect(f._config.parse("debug")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(f._config.parse("")).toBeNull();
    });
  });

  // -- array --

  describe("field.array()", () => {
    it("has type 'array' and default []", () => {
      const f = field.array(field.string());
      expect(f._config.type).toBe("array");
      expect(f._config.defaultValue).toEqual([]);
    });

    it("serializes array of strings with comma delimiter", () => {
      const f = field.array(field.stringLiteral(["a", "b", "c"] as const));
      expect(f._config.serialize(["a", "b"])).toBe("a,b");
    });

    it("parses comma-delimited string", () => {
      const f = field.array(field.stringLiteral(["a", "b", "c"] as const));
      expect(f._config.parse("a,b")).toEqual(["a", "b"]);
    });

    it("returns empty array for empty string", () => {
      const f = field.array(field.string());
      expect(f._config.parse("")).toEqual([]);
    });

    it("filters out null items from parsed array", () => {
      const LEVELS = ["error", "warn"] as const;
      const f = field.array(field.stringLiteral(LEVELS));
      // "unknown" is not a valid literal, should be filtered out
      expect(f._config.parse("error,unknown,warn")).toEqual(["error", "warn"]);
    });

    it("uses SLIDER_DELIMITER for number arrays by default", () => {
      const f = field.array(field.number());
      expect(f._config.delimiter).toBe("-");
    });

    it("uses ARRAY_DELIMITER for string arrays by default", () => {
      const f = field.array(field.string());
      expect(f._config.delimiter).toBe(",");
    });
  });

  // -- sort --

  describe("field.sort()", () => {
    const f = field.sort();

    it("has type 'sort' and default null", () => {
      expect(f._config.type).toBe("sort");
      expect(f._config.defaultValue).toBeNull();
    });

    it("serializes sort object to string", () => {
      expect(f._config.serialize({ id: "latency", desc: true })).toBe(
        "latency.desc",
      );
      expect(f._config.serialize({ id: "name", desc: false })).toBe("name.asc");
    });

    it("serializes null to empty string", () => {
      expect(f._config.serialize(null)).toBe("");
    });

    it("parses sort string", () => {
      expect(f._config.parse("latency.desc")).toEqual({
        id: "latency",
        desc: true,
      });
      expect(f._config.parse("name.asc")).toEqual({ id: "name", desc: false });
    });

    it("returns null for empty string", () => {
      expect(f._config.parse("")).toBeNull();
    });
  });

  // -- fluent API --

  describe(".default()", () => {
    it("sets the default value", () => {
      const f = field.string().default("hello");
      expect(f._config.defaultValue).toBe("hello");
    });
  });

  describe(".delimiter()", () => {
    it("changes delimiter for array fields", () => {
      const f = field.array(field.number()).delimiter("|");
      expect(f._config.delimiter).toBe("|");
      expect(f._config.serialize([1, 2, 3])).toBe("1|2|3");
      expect(f._config.parse("1|2|3")).toEqual([1, 2, 3]);
    });
  });
});
