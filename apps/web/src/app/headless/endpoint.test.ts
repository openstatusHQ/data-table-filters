import { describe, expect, it } from "vitest";
import {
  DEFAULT_MANIFEST,
  headlessHref,
  parseManifestInput,
  tableIdFor,
  timeColumnKey,
  withoutQuery,
} from "./endpoint";

describe("parseManifestInput", () => {
  it("accepts a root-relative path as this site", () => {
    expect(parseManifestInput("  /drizzle/api/schema ")).toEqual({
      ok: true,
      url: "/drizzle/api/schema",
      externalHost: null,
    });
  });

  it("accepts an https URL and reports its host", () => {
    expect(parseManifestInput("https://api.example.com/logs/schema")).toEqual({
      ok: true,
      url: "https://api.example.com/logs/schema",
      externalHost: "api.example.com",
    });
  });

  it("accepts http only for localhost", () => {
    expect(parseManifestInput("http://localhost:8787/schema")).toMatchObject({
      ok: true,
      externalHost: "localhost:8787",
    });
    expect(parseManifestInput("http://127.0.0.1:3000/schema").ok).toBe(true);
    expect(parseManifestInput("http://api.example.com/schema").ok).toBe(false);
  });

  it.each([
    ["", "empty"],
    ["   ", "blank"],
    ["//evil.example.com/schema", "protocol-relative"],
    ["/\\evil.example.com/schema", "backslash read as a slash"],
    // Regression: browsers strip these before parsing, leaving `//host`.
    [
      "/\t/evil.example.com/schema",
      "tab stripped into a protocol-relative URL",
    ],
    ["/\n/evil.example.com/schema", "line break stripped the same way"],
    ["/\r/evil.example.com/schema", "carriage return stripped the same way"],
    ["/api/my schema", "space inside the path"],
    ["https://exa\tmple.com/schema", "tab inside an absolute URL"],
    ["javascript:alert(1)", "script URL"],
    ["data:application/json,{}", "data URL"],
    ["blob:https://example.com/1", "blob URL"],
    ["ftp://example.com/schema", "another protocol"],
    ["api/schema", "directory-relative"],
    ["https://user:pass@example.com/schema", "credentials"],
    [`https://example.com/${"a".repeat(2100)}`, "too long"],
  ])("rejects %j (%s)", (input) => {
    const result = parseManifestInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).not.toBe("");
  });
});

describe("withoutQuery", () => {
  it("drops the query string and the fragment", () => {
    expect(withoutQuery("/logs/api/schema?v=2")).toBe("/logs/api/schema");
    expect(withoutQuery("https://api.example.com/logs/schema?v=2#top")).toBe(
      "https://api.example.com/logs/schema",
    );
    expect(withoutQuery("/logs/api/schema#top")).toBe("/logs/api/schema");
  });

  it("leaves a URL without either alone", () => {
    expect(withoutQuery("/logs/api/schema")).toBe("/logs/api/schema");
  });
});

describe("headlessHref", () => {
  it("leaves the default manifest out of the URL", () => {
    expect(headlessHref(DEFAULT_MANIFEST)).toBe("/headless");
  });

  it("encodes any other manifest", () => {
    expect(headlessHref("https://api.example.com/logs/schema?v=2")).toBe(
      "/headless?manifest=https%3A%2F%2Fapi.example.com%2Flogs%2Fschema%3Fv%3D2",
    );
  });
});

describe("tableIdFor", () => {
  it("is stable for one manifest and differs between two", () => {
    expect(tableIdFor("/a/schema")).toBe(tableIdFor("/a/schema"));
    expect(tableIdFor("/a/schema")).not.toBe(tableIdFor("/b/schema"));
    expect(tableIdFor("/a/schema")).toMatch(/^headless-[a-z0-9]+$/);
  });
});

describe("timeColumnKey", () => {
  const columns = [
    { key: "name", kind: "string" },
    { key: "created", kind: "timestamp" },
    { key: "updated", kind: "timestamp" },
  ];
  const schema = { version: 1, columns } as never;

  it("prefers the chart's column", () => {
    expect(
      timeColumnKey({
        schema,
        chart: { columnKey: "updated", series: [] },
        defaults: { sort: { id: "created", desc: true } },
      }),
    ).toBe("updated");
  });

  it("falls back to the default sort, then the first timestamp column", () => {
    expect(
      timeColumnKey({
        schema,
        defaults: { sort: { id: "updated", desc: true } },
      }),
    ).toBe("updated");
    expect(timeColumnKey({ schema })).toBe("created");
  });

  it("ignores a default sort on a column that is not a timestamp", () => {
    expect(
      timeColumnKey({
        schema,
        defaults: { sort: { id: "name", desc: false } },
      }),
    ).toBe("created");
  });

  it("is undefined without a timestamp column", () => {
    expect(
      timeColumnKey({
        schema: { version: 1, columns: [columns[0]] } as never,
      }),
    ).toBeUndefined();
  });
});
