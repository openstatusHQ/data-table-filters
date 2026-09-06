import { describe, expect, it } from "vitest";
import {
  FILTER_ENCODING,
  isContractValid,
  REQUEST_PARAMS,
  validateListResponse,
  type ContractIssue,
} from "./contract";

function response(overrides?: Record<string, unknown>) {
  return {
    data: [],
    meta: { totalRowCount: 0, filterRowCount: 0, chartData: [], facets: {} },
    nextCursor: null,
    prevCursor: null,
    ...overrides,
  };
}

function errors(issues: ContractIssue[]): string[] {
  return issues.filter((i) => i.severity === "error").map((i) => i.path);
}

function warnings(issues: ContractIssue[]): string[] {
  return issues.filter((i) => i.severity === "warning").map((i) => i.path);
}

describe("the encoding constants", () => {
  it("names every reserved parameter", () => {
    expect(Object.values(REQUEST_PARAMS)).toEqual([
      "cursor",
      "direction",
      "size",
      "sort",
      "uuid",
      "live",
    ]);
  });

  it("keeps slider and timerange on the same separator", () => {
    // They are documented as intentionally identical; the parser branches on
    // the column's filter type, not the delimiter.
    expect(FILTER_ENCODING.slider).toBe(FILTER_ENCODING.range);
  });
});

describe("validateListResponse", () => {
  it("accepts a well-formed response", () => {
    expect(validateListResponse(response())).toEqual([]);
  });

  it("rejects a non-object", () => {
    expect(errors(validateListResponse(null))).toEqual([""]);
    expect(errors(validateListResponse("{}"))).toEqual([""]);
  });

  it("requires `data` to be an array", () => {
    expect(errors(validateListResponse(response({ data: {} })))).toContain(
      "data",
    );
  });

  it("requires `meta` to be an object", () => {
    expect(errors(validateListResponse(response({ meta: null })))).toContain(
      "meta",
    );
  });

  it("accepts a null cursor as the end of the list", () => {
    expect(
      validateListResponse(response({ nextCursor: null, prevCursor: null })),
    ).toEqual([]);
  });

  it("accepts a numeric or string cursor", () => {
    expect(validateListResponse(response({ nextCursor: 1700 }))).toEqual([]);
    expect(validateListResponse(response({ nextCursor: "opaque" }))).toEqual(
      [],
    );
  });

  it("rejects a cursor of another type", () => {
    expect(
      errors(validateListResponse(response({ nextCursor: { at: 1 } }))),
    ).toContain("nextCursor");
  });

  it("rejects non-numeric row counts", () => {
    const issues = validateListResponse(
      response({ meta: { totalRowCount: "12" } }),
    );
    expect(errors(issues)).toContain("meta.totalRowCount");
  });

  it("does not require counts the endpoint never claimed", () => {
    expect(validateListResponse(response({ meta: {} }))).toEqual([]);
  });

  it("warns when a declared count is absent", () => {
    const issues = validateListResponse(response({ meta: {} }), {
      capabilities: { totalRowCount: true, filterRowCount: true },
    });
    expect(warnings(issues)).toEqual([
      "meta.totalRowCount",
      "meta.filterRowCount",
    ]);
    // A missing claim is renderable, so it must not block.
    expect(isContractValid(issues)).toBe(true);
  });

  it("warns when declared facets are absent", () => {
    const issues = validateListResponse(response({ meta: {} }), {
      capabilities: { facets: true },
    });
    expect(warnings(issues)).toContain("meta.facets");
  });

  it("warns when a declared chart is absent", () => {
    const issues = validateListResponse(response({ meta: {} }), {
      capabilities: { chart: true },
    });
    expect(warnings(issues)).toContain("meta.chartData");
  });

  it("warns when backwardPagination is declared but no prevCursor field exists", () => {
    const payload = response();
    delete (payload as Record<string, unknown>).prevCursor;
    const issues = validateListResponse(payload, {
      capabilities: { backwardPagination: true },
    });
    expect(warnings(issues)).toContain("prevCursor");
  });

  describe("facets", () => {
    it("accepts a well-formed facet", () => {
      expect(
        validateListResponse(
          response({
            meta: {
              facets: {
                level: { rows: [{ value: "error", total: 3 }], total: 3 },
              },
            },
          }),
        ),
      ).toEqual([]);
    });

    it("accepts numeric min/max on a slider facet", () => {
      expect(
        validateListResponse(
          response({
            meta: {
              facets: { latency: { rows: [], total: 0, min: 1, max: 900 } },
            },
          }),
        ),
      ).toEqual([]);
    });

    it("rejects a facet that is not an object", () => {
      expect(
        errors(
          validateListResponse(response({ meta: { facets: { level: [] } } })),
        ),
      ).toContain("meta.facets.level");
    });

    it("rejects a facet with no rows and no total", () => {
      const issues = validateListResponse(
        response({ meta: { facets: { level: {} } } }),
      );
      expect(errors(issues)).toEqual([
        "meta.facets.level.rows",
        "meta.facets.level.total",
      ]);
    });

    it("rejects a facet row without a numeric total", () => {
      expect(
        errors(
          validateListResponse(
            response({
              meta: {
                facets: {
                  level: { rows: [{ value: "error" }], total: 1 },
                },
              },
            }),
          ),
        ),
      ).toContain("meta.facets.level.rows[0]");
    });

    it("rejects a non-numeric min", () => {
      expect(
        errors(
          validateListResponse(
            response({
              meta: { facets: { latency: { rows: [], total: 0, min: "1" } } },
            }),
          ),
        ),
      ).toContain("meta.facets.latency.min");
    });

    it("rejects facets that are not an object", () => {
      expect(
        errors(validateListResponse(response({ meta: { facets: [] } }))),
      ).toContain("meta.facets");
    });
  });

  describe("chartData", () => {
    it("accepts points with a numeric timestamp", () => {
      expect(
        validateListResponse(
          response({
            meta: { chartData: [{ timestamp: 1700, error: 2, info: 5 }] },
          }),
        ),
      ).toEqual([]);
    });

    it("rejects a point with no timestamp", () => {
      expect(
        errors(
          validateListResponse(
            response({ meta: { chartData: [{ error: 2 }] } }),
          ),
        ),
      ).toContain("meta.chartData[0]");
    });

    it("rejects chartData that is not an array", () => {
      expect(
        errors(validateListResponse(response({ meta: { chartData: {} } }))),
      ).toContain("meta.chartData");
    });
  });

  it("rejects actions that are not an array", () => {
    expect(
      errors(validateListResponse(response({ meta: { actions: {} } }))),
    ).toContain("meta.actions");
  });
});

describe("isContractValid", () => {
  it("is true for warnings alone", () => {
    expect(
      isContractValid([{ path: "meta", message: "x", severity: "warning" }]),
    ).toBe(true);
  });

  it("is false when any error is present", () => {
    expect(
      isContractValid([
        { path: "meta", message: "x", severity: "warning" },
        { path: "data", message: "y", severity: "error" },
      ]),
    ).toBe(false);
  });

  it("is true for no issues", () => {
    expect(isContractValid([])).toBe(true);
  });
});
