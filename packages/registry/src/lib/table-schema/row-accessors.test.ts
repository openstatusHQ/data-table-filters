import { describe, expect, it } from "vitest";
import { createRowAccessors } from "./manifest";

describe("createRowAccessors", () => {
  describe("getRowId", () => {
    it("reads the primary key off the row", () => {
      const { getRowId } = createRowAccessors({ primaryKey: "uuid" });
      expect(getRowId({ uuid: "abc", host: "a.com" })).toBe("abc");
    });

    it("coerces a non-string key, so numeric ids work", () => {
      const { getRowId } = createRowAccessors({ primaryKey: "id" });
      expect(getRowId({ id: 42 })).toBe("42");
    });

    it("reads a dotted key path", () => {
      const { getRowId } = createRowAccessors({ primaryKey: "meta.id" });
      expect(getRowId({ meta: { id: "nested" } })).toBe("nested");
    });

    it("returns an empty string when the key is missing", () => {
      const { getRowId } = createRowAccessors({ primaryKey: "uuid" });
      expect(getRowId({})).toBe("");
      expect(getRowId({ uuid: null })).toBe("");
      expect(getRowId({ meta: {} })).toBe("");
    });

    it("refuses a prototype-reaching key rather than returning [object Object]", () => {
      // Every row would otherwise share one id, collapsing selection and
      // bulk-action targeting onto a single row.
      const { getRowId } = createRowAccessors({ primaryKey: "__proto__" });
      expect(getRowId({ a: 1 })).toBe("");
    });

    it("prefers a literal dotted key over walking the path", () => {
      const { getRowId } = createRowAccessors({ primaryKey: "meta.id" });
      expect(getRowId({ "meta.id": "flat" })).toBe("flat");
    });

    it("survives a non-object row", () => {
      const { getRowId } = createRowAccessors({ primaryKey: "uuid" });
      expect(getRowId(null)).toBe("");
      expect(getRowId(7)).toBe("");
    });
  });

  describe("getRowLabel", () => {
    it("is undefined when the manifest declares no template", () => {
      expect(createRowAccessors({ primaryKey: "uuid" }).getRowLabel).toBe(
        undefined,
      );
    });

    it("interpolates column keys", () => {
      const { getRowLabel } = createRowAccessors({
        primaryKey: "uuid",
        rowLabel: "{method} {pathname}",
      });
      expect(getRowLabel!({ method: "GET", pathname: "/api/logs" })).toBe(
        "GET /api/logs",
      );
    });

    it("reads dotted key paths and trims whitespace in the marker", () => {
      const { getRowLabel } = createRowAccessors({
        primaryKey: "uuid",
        rowLabel: "{ meta.name }",
      });
      expect(getRowLabel!({ meta: { name: "checkout" } })).toBe("checkout");
    });

    it("leaves an unknown key as written, so a typo is visible", () => {
      const { getRowLabel } = createRowAccessors({
        primaryKey: "uuid",
        rowLabel: "{method} {pathnmae}",
      });
      expect(getRowLabel!({ method: "GET", pathname: "/api" })).toBe(
        "GET {pathnmae}",
      );
    });

    it("leaves a null or undefined value as the marker rather than printing null", () => {
      const { getRowLabel } = createRowAccessors({
        primaryKey: "uuid",
        rowLabel: "{host}",
      });
      expect(getRowLabel!({ host: null })).toBe("{host}");
    });

    it("keeps literal text around the markers", () => {
      const { getRowLabel } = createRowAccessors({
        primaryKey: "uuid",
        rowLabel: "Request {method} to {host}",
      });
      expect(getRowLabel!({ method: "POST", host: "a.com" })).toBe(
        "Request POST to a.com",
      );
    });

    it("coerces numbers and booleans", () => {
      const { getRowLabel } = createRowAccessors({
        primaryKey: "uuid",
        rowLabel: "{status} {ok}",
      });
      expect(getRowLabel!({ status: 200, ok: true })).toBe("200 true");
    });
  });
});
