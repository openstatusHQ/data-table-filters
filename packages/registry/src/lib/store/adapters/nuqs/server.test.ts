import { describe, expect, it } from "vitest";
import { field } from "../../schema/field";
import { createNuqsSearchParams } from "./server";

describe("createNuqsSearchParams", () => {
  const setup = () => {
    const schema = { path: field.string() };
    return createNuqsSearchParams(schema);
  };

  it("registers a built-in _meta parser for the metadata control param", () => {
    const { searchParamsParser } = setup();
    expect(searchParamsParser._meta).toBeDefined();
  });

  it("serializes _meta=false for non-initial pages", () => {
    const { searchParamsSerializer } = setup();
    const result = searchParamsSerializer({ _meta: false });
    expect(result).toContain("_meta=false");
  });

  it("omits _meta when null (initial page / stable query key)", () => {
    const { searchParamsSerializer } = setup();
    const result = searchParamsSerializer({ _meta: null });
    expect(result).not.toContain("_meta");
  });
});
