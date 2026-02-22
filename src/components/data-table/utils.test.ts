import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@/lib/delimiters";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { DataTableFilterField } from "./types";
import { deserialize, serializeColumFilters } from "./utils";

// ── deserialize ──────────────────────────────────────────────────────────────

describe("deserialize", () => {
  const schema = z.object({
    q: z.string(),
    page: z.coerce.number(),
  });

  const parse = deserialize(schema);

  it("parses a well-formed 'key:value key2:value2' string", () => {
    const result = parse("q:hello page:2");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ q: "hello", page: 2 });
    }
  });

  it("parses a single key:value pair", () => {
    // page is missing — zod requires both, so this should fail
    const result = parse("q:world");
    expect(result.success).toBe(false);
  });

  it("returns success for an empty string when all fields are optional", () => {
    const optSchema = z.object({
      q: z.string().optional(),
      page: z.coerce.number().optional(),
    });
    const optParse = deserialize(optSchema);
    const result = optParse("");
    expect(result.success).toBe(true);
  });

  it("ignores tokens that have no colon separator", () => {
    // "nocolon" has no ':' and is skipped; the rest is valid
    const result = parse("nocolon q:hello page:1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ q: "hello", page: 1 });
    }
  });

  it("ignores tokens with an empty name (leading colon)", () => {
    // ':value' splits into ['', 'value'] — empty name is skipped
    const result = parse(":orphan q:search page:1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("search");
    }
  });

  it("ignores tokens with an empty value (trailing colon)", () => {
    // 'name:' splits into ['name', ''] — empty value is skipped
    const result = parse("q:hello q2: page:3");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("hello");
    }
  });

  it("trims leading and trailing whitespace from the input", () => {
    const result = parse("  q:hello page:1  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("hello");
    }
  });

  it("returns a failure when schema validation fails", () => {
    // 'page' cannot be coerced from a non-numeric string
    const strictSchema = z.object({ count: z.number() });
    const strictParse = deserialize(strictSchema);
    const result = strictParse("count:notanumber");
    expect(result.success).toBe(false);
  });

  it("passes the parsed object through zod schema validation", () => {
    // The zod schema should reject extra keys if strict mode is used
    const strictSchema = z.object({ q: z.string() }).strict();
    const strictParse = deserialize(strictSchema);
    const result = strictParse("q:hello extra:field");
    expect(result.success).toBe(false);
  });
});

// ── serializeColumFilters ────────────────────────────────────────────────────

type Row = {
  status: number;
  level: string;
  date: Date;
  host: string;
  latency: number;
};

const filterFields: DataTableFilterField<Row>[] = [
  { label: "Status", value: "status", type: "checkbox" },
  { label: "Level", value: "level", type: "checkbox" },
  { label: "Date", value: "date", type: "timerange" },
  { label: "Host", value: "host", type: "input" },
  { label: "Latency", value: "latency", type: "slider", min: 0, max: 5000 },
];

describe("serializeColumFilters", () => {
  it("returns an empty string when columnFilters is empty", () => {
    expect(serializeColumFilters([], filterFields)).toBe("");
  });

  it("serializes a plain (non-array) filter value", () => {
    const result = serializeColumFilters(
      [{ id: "host", value: "example.com" }],
      filterFields,
    );
    expect(result).toBe("host:example.com ");
  });

  it("serializes a checkbox array filter with ARRAY_DELIMITER", () => {
    const result = serializeColumFilters(
      [{ id: "level", value: ["error", "warn"] }],
      filterFields,
    );
    expect(result).toBe(`level:error${ARRAY_DELIMITER}warn `);
  });

  it("serializes a slider array filter with SLIDER_DELIMITER", () => {
    const result = serializeColumFilters(
      [{ id: "latency", value: [0, 500] }],
      filterFields,
    );
    expect(result).toBe(`latency:0${SLIDER_DELIMITER}500 `);
  });

  it("serializes a timerange array filter with RANGE_DELIMITER", () => {
    const result = serializeColumFilters(
      [{ id: "date", value: ["2024-01-01", "2024-01-31"] }],
      filterFields,
    );
    expect(result).toBe(`date:2024-01-01${RANGE_DELIMITER}2024-01-31 `);
  });

  it("skips a filter whose field has commandDisabled: true", () => {
    const fields: DataTableFilterField<Row>[] = [
      { label: "Host", value: "host", type: "input", commandDisabled: true },
    ];
    const result = serializeColumFilters(
      [{ id: "host", value: "example.com" }],
      fields,
    );
    expect(result).toBe("");
  });

  it("skips a filter not found in filterFields (defaults to commandDisabled)", () => {
    const result = serializeColumFilters(
      [{ id: "unknown" as keyof Row, value: "foo" }],
      filterFields,
    );
    expect(result).toBe("");
  });

  it("serializes multiple filters concatenated with trailing spaces", () => {
    const result = serializeColumFilters(
      [
        { id: "host", value: "example.com" },
        { id: "level", value: ["error"] },
      ],
      filterFields,
    );
    expect(result).toBe(`host:example.com level:error `);
  });

  it("skips commandDisabled filters but includes enabled ones in the same call", () => {
    const fields: DataTableFilterField<Row>[] = [
      { label: "Host", value: "host", type: "input", commandDisabled: true },
      { label: "Level", value: "level", type: "checkbox" },
    ];
    const result = serializeColumFilters(
      [
        { id: "host", value: "example.com" },
        { id: "level", value: ["error"] },
      ],
      fields,
    );
    expect(result).toBe(`level:error `);
  });

  it("returns an empty string when filterFields is undefined (all skipped)", () => {
    // No field found → commandDisabled defaults to true → all skipped
    const result = serializeColumFilters(
      [{ id: "host", value: "example.com" }],
      undefined,
    );
    expect(result).toBe("");
  });

  it("serializes a status checkbox array filter with ARRAY_DELIMITER", () => {
    const result = serializeColumFilters(
      [{ id: "status", value: [200, 404] }],
      filterFields,
    );
    expect(result).toBe(`status:200${ARRAY_DELIMITER}404 `);
  });
});
