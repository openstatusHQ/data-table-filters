import SuperJSON from "superjson";
import { describe, expect, it } from "vitest";
import { autoParser, reviveListPayload } from "./parse-response";

const date = new Date("2026-01-02T03:04:05.000Z");
const payload = {
  data: [{ id: "a", date }],
  meta: { totalRowCount: 1, filterRowCount: 1, chartData: [], facets: {} },
  nextCursor: null,
  prevCursor: null,
};

describe("reviveListPayload", () => {
  it("reads a SuperJSON string, the way this repo's routes send it", () => {
    const result = reviveListPayload(SuperJSON.stringify(payload), []);
    expect(result.data[0].date).toEqual(date);
    expect(result.meta.totalRowCount).toBe(1);
  });

  it("reads a SuperJSON envelope sent as an object", () => {
    const result = reviveListPayload(SuperJSON.serialize(payload), []);
    expect(result.data[0].date).toBeInstanceOf(Date);
  });

  it("revives a string date inside a SuperJSON envelope too", () => {
    const stringDates = {
      ...payload,
      data: [{ id: "a", date: date.toISOString() }],
    };
    for (const body of [
      SuperJSON.stringify(stringDates),
      SuperJSON.serialize(stringDates),
    ]) {
      expect(reviveListPayload(body, ["date"]).data[0].date).toEqual(date);
    }
  });

  it("revives timestamp columns in plain JSON from the schema", () => {
    const plain = JSON.parse(JSON.stringify(payload));
    const result = reviveListPayload(plain, ["date"]);
    expect(result.data[0].date).toEqual(date);
    expect(result.data[0].id).toBe("a");
  });

  it("revives epoch milliseconds too", () => {
    const result = reviveListPayload(
      { ...payload, data: [{ id: "a", date: date.getTime() }] },
      ["date"],
    );
    expect(result.data[0].date).toEqual(date);
  });

  it("leaves a column alone when the schema does not call it a timestamp", () => {
    const plain = JSON.parse(JSON.stringify(payload));
    expect(reviveListPayload(plain, []).data[0].date).toBe(date.toISOString());
  });

  it("does not mistake a plain payload with a `json` column for an envelope", () => {
    const result = reviveListPayload(
      { ...payload, json: "x", data: [{ id: "a" }] },
      [],
    );
    expect(result.data).toEqual([{ id: "a" }]);
  });

  it("passes a malformed body through for the contract check to report", () => {
    expect(reviveListPayload({ rows: [] }, ["date"])).toEqual({ rows: [] });
    expect(reviveListPayload(null, ["date"])).toBeNull();
  });
});

describe("autoParser", () => {
  it("parses a Response", async () => {
    const response = Response.json(JSON.parse(JSON.stringify(payload)));
    const result = await autoParser(["date"])(response);
    expect(result.data[0].date).toEqual(date);
  });
});
