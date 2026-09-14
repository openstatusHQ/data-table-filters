import {
  isContractValid,
  validateListResponse,
  type ContractIssue,
} from "./contract";

/**
 * A conformance kit for a list endpoint.
 *
 * The filter-semantics corpus in `lib/filters/testing/conformance.ts` answers
 * "does this engine interpret a filter the way the table does". This answers
 * the other half: "does this endpoint speak the HTTP contract" — the parameters
 * it must read, the shape it must return, and whether its manifest tells the
 * truth about itself.
 *
 * It is deliberately a plain async function with no test-framework dependency,
 * so it ships to consumers and can run in their test runner, in CI against a
 * deployed URL, or from a script. That is also why it does not live under
 * `testing/` — the registry does not ship anything from there, and this is a
 * runtime verifier rather than test scaffolding.
 *
 * ## What it cannot check
 *
 * Filter *semantics* — whether `?level=error,warn` returns the right rows —
 * belong to the filter corpus, which needs known data. This kit runs against a
 * live endpoint whose contents it does not know, so it checks structure,
 * self-consistency, and the claims the manifest makes.
 */

/**
 * The part of a `TableManifest` this kit reads.
 *
 * Structural rather than an import of `TableManifest`: the conformance kit
 * ships with the query block, which does not depend on the schema block, and a
 * real manifest satisfies this shape anyway. Keeping it structural is also what
 * lets someone conformance-test an endpoint whose manifest they hand-wrote.
 */
export type ConformanceManifest = {
  primaryKey: string;
  capabilities: {
    facets?: boolean;
    facetedColumns?: readonly string[];
    totalRowCount?: boolean;
    filterRowCount?: boolean;
    chart?: boolean;
    backwardPagination?: boolean;
  };
  schema: {
    columns: readonly { key: string; filter?: { type?: string } | null }[];
  };
};

export type ConformanceCheck = {
  id: string;
  description: string;
  status: "pass" | "fail" | "skip";
  /** Why it failed, or why it was skipped. */
  detail?: string;
  issues?: ContractIssue[];
};

export type ConformanceReport = {
  checks: ConformanceCheck[];
  passed: number;
  failed: number;
  skipped: number;
  ok: boolean;
};

export type EndpointConformanceOptions = {
  /** The list endpoint, without a query string. */
  url: string;
  /** The manifest this endpoint serves. Its capabilities are what we hold it to. */
  manifest: ConformanceManifest;
  /** Defaults to global `fetch`. Supply one to add auth headers. */
  fetch?: typeof fetch;
  /** Parses a response body. Defaults to `response.json()`. */
  parse?: (response: Response) => Promise<unknown>;
  /** Page size to request. Defaults to 5, to keep the probe cheap. */
  size?: number;
};

function record(
  checks: ConformanceCheck[],
  check: ConformanceCheck,
): ConformanceCheck {
  checks.push(check);
  return check;
}

function pass(id: string, description: string): ConformanceCheck {
  return { id, description, status: "pass" };
}

function fail(
  id: string,
  description: string,
  detail: string,
  issues?: ContractIssue[],
): ConformanceCheck {
  return {
    id,
    description,
    status: "fail",
    detail,
    ...(issues ? { issues } : {}),
  };
}

function skip(
  id: string,
  description: string,
  detail: string,
): ConformanceCheck {
  return { id, description, status: "skip", detail };
}

function join(url: string, query: string): string {
  if (!query) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

/**
 * Run every check against a live endpoint.
 *
 * Never throws for a failing endpoint — a thrown request is itself a recorded
 * failure, so one unreachable URL does not hide the other results.
 */
export async function runEndpointConformance(
  options: EndpointConformanceOptions,
): Promise<ConformanceReport> {
  const doFetch = options.fetch ?? fetch;
  const parse = options.parse ?? ((response: Response) => response.json());
  const size = options.size ?? 5;
  const { manifest, url } = options;
  const checks: ConformanceCheck[] = [];

  const get = async (
    query: string,
  ): Promise<{ payload?: unknown; error?: string }> => {
    try {
      const response = await doFetch(join(url, query));
      if (!response.ok) {
        return { error: `${response.status} ${response.statusText}`.trim() };
      }
      return { payload: await parse(response) };
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : String(cause) };
    }
  };

  // ── 1. The endpoint answers at all, in the right shape ───────────────────

  const base = await get(`size=${size}`);
  if (base.error || base.payload === undefined) {
    record(
      checks,
      fail(
        "responds",
        "returns a 2xx for an unfiltered request",
        base.error ?? "no body",
      ),
    );
    return summarize(checks);
  }
  record(checks, pass("responds", "returns a 2xx for an unfiltered request"));

  const baseIssues = validateListResponse(base.payload, {
    capabilities: manifest.capabilities,
  });
  record(
    checks,
    isContractValid(baseIssues)
      ? {
          id: "response-shape",
          description: "response matches the list contract",
          status: "pass",
          ...(baseIssues.length > 0 ? { issues: baseIssues } : {}),
        }
      : fail(
          "response-shape",
          "response matches the list contract",
          `${baseIssues.filter((i) => i.severity === "error").length} contract error(s)`,
          baseIssues,
        ),
  );

  const first = base.payload as {
    data?: unknown[];
    nextCursor?: unknown;
    meta?: Record<string, unknown>;
  };

  // ── 2. `size` is honoured ────────────────────────────────────────────────

  if (Array.isArray(first.data)) {
    record(
      checks,
      first.data.length <= size
        ? pass("size", "honours the `size` parameter")
        : fail(
            "size",
            "honours the `size` parameter",
            `asked for ${size}, received ${first.data.length}`,
          ),
    );
  }

  // ── 3. Rows carry the primary key ────────────────────────────────────────

  if (Array.isArray(first.data) && first.data.length > 0) {
    const missing = first.data.filter((row) => {
      if (typeof row !== "object" || row === null) return true;
      return readPath(row, manifest.primaryKey) === undefined;
    });
    record(
      checks,
      missing.length === 0
        ? pass("primary-key", "every row carries the manifest's `primaryKey`")
        : fail(
            "primary-key",
            "every row carries the manifest's `primaryKey`",
            `${missing.length} of ${first.data.length} rows have no ${JSON.stringify(manifest.primaryKey)}`,
          ),
    );

    const ids = first.data.map((row) =>
      String(readPath(row as object, manifest.primaryKey)),
    );
    record(
      checks,
      new Set(ids).size === ids.length
        ? pass("primary-key-unique", "primary keys are unique within a page")
        : fail(
            "primary-key-unique",
            "primary keys are unique within a page",
            "the same id appeared twice, so row identity is not stable",
          ),
    );
  } else {
    record(
      checks,
      skip(
        "primary-key",
        "every row carries the manifest's `primaryKey`",
        "the endpoint returned no rows",
      ),
    );
  }

  // ── 4. Declared facets are actually computed ─────────────────────────────

  if (manifest.capabilities.facets) {
    const facets = (first.meta?.facets ?? {}) as Record<string, unknown>;
    const expected =
      manifest.capabilities.facetedColumns ??
      manifest.schema.columns
        // Only `checkbox` and `slider` need a facet: one wants the set of
        // values, the other wants bounds. An `input` filter is free text and a
        // `timerange` carries its own bounds, so neither has anything to group.
        // "Has a filter descriptor" is the wrong test — a plain `col.string()`
        // gets an `input` filter by default and would be demanded here.
        .filter(
          (column) =>
            column.filter?.type === "checkbox" ||
            column.filter?.type === "slider",
        )
        .map((column) => column.key);
    const absent = expected.filter((key) => !(key in facets));
    record(
      checks,
      absent.length === 0
        ? pass("facets", "computes a facet for every column it claims")
        : fail(
            "facets",
            "computes a facet for every column it claims",
            `no facet for: ${absent.join(", ")}`,
          ),
    );
  } else {
    record(
      checks,
      skip(
        "facets",
        "computes a facet for every column it claims",
        "the manifest does not declare `facets`",
      ),
    );
  }

  // ── 5. Paging forwards advances ──────────────────────────────────────────

  if (first.nextCursor === null || first.nextCursor === undefined) {
    record(
      checks,
      skip(
        "paging",
        "a second page returns different rows",
        "the first page was the last page",
      ),
    );
  } else {
    const second = await get(
      `size=${size}&cursor=${encodeURIComponent(String(first.nextCursor))}&direction=next`,
    );
    if (second.error || second.payload === undefined) {
      record(
        checks,
        fail(
          "paging",
          "a second page returns different rows",
          second.error ?? "no body",
        ),
      );
    } else {
      const secondIssues = validateListResponse(second.payload, {
        capabilities: manifest.capabilities,
      });
      const nextData = (second.payload as { data?: unknown[] }).data ?? [];
      const firstIds = new Set(
        (first.data ?? []).map((row) =>
          String(readPath(row as object, manifest.primaryKey)),
        ),
      );
      const overlap = nextData.filter((row) =>
        firstIds.has(String(readPath(row as object, manifest.primaryKey))),
      );

      if (!isContractValid(secondIssues)) {
        record(
          checks,
          fail(
            "paging",
            "a second page returns different rows",
            "the second page does not match the contract",
            secondIssues,
          ),
        );
      } else if (nextData.length > 0 && overlap.length === nextData.length) {
        // Every row repeated: the cursor was ignored, which is an infinite
        // scroll that never advances.
        record(
          checks,
          fail(
            "paging",
            "a second page returns different rows",
            "the second page repeated the first page exactly — is `cursor` being read?",
          ),
        );
      } else {
        record(checks, pass("paging", "a second page returns different rows"));
      }
    }
  }

  // ── 6. Backwards paging, when claimed ────────────────────────────────────

  if (!manifest.capabilities.backwardPagination) {
    record(
      checks,
      skip(
        "backward-paging",
        "accepts `direction=prev`",
        "the manifest does not declare `backwardPagination`",
      ),
    );
  } else {
    const prevCursor = (base.payload as { prevCursor?: unknown }).prevCursor;
    if (prevCursor === null || prevCursor === undefined) {
      record(
        checks,
        skip(
          "backward-paging",
          "accepts `direction=prev`",
          "no `prevCursor` to page back from",
        ),
      );
    } else {
      const back = await get(
        `size=${size}&cursor=${encodeURIComponent(String(prevCursor))}&direction=prev`,
      );
      record(
        checks,
        back.error
          ? fail("backward-paging", "accepts `direction=prev`", back.error)
          : isContractValid(
                validateListResponse(back.payload, {
                  capabilities: manifest.capabilities,
                }),
              )
            ? pass("backward-paging", "accepts `direction=prev`")
            : fail(
                "backward-paging",
                "accepts `direction=prev`",
                "the response does not match the contract",
              ),
      );
    }
  }

  // ── 7. An unknown parameter does not break the endpoint ──────────────────

  const noisy = await get(`size=${size}&__dtf_unknown_param=1`);
  record(
    checks,
    noisy.error
      ? fail(
          "unknown-param",
          "ignores an unrecognised query parameter",
          `an unknown parameter produced ${noisy.error} — the table adds view-state params that never narrow results`,
        )
      : pass("unknown-param", "ignores an unrecognised query parameter"),
  );

  return summarize(checks);
}

/** Reads a possibly-dotted key path off a row. */
function readPath(row: unknown, path: string): unknown {
  if (row === null || typeof row !== "object") return undefined;
  if (!path.includes(".")) return (row as Record<string, unknown>)[path];
  let current: unknown = row;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function summarize(checks: ConformanceCheck[]): ConformanceReport {
  const passed = checks.filter((check) => check.status === "pass").length;
  const failed = checks.filter((check) => check.status === "fail").length;
  const skipped = checks.filter((check) => check.status === "skip").length;
  return { checks, passed, failed, skipped, ok: failed === 0 };
}

/** A one-line-per-check summary, for a CI log. */
export function formatConformanceReport(report: ConformanceReport): string {
  const symbol = { pass: "PASS", fail: "FAIL", skip: "SKIP" } as const;
  const lines = report.checks.map((check) => {
    const head = `${symbol[check.status]}  ${check.id}: ${check.description}`;
    return check.detail ? `${head}\n      ${check.detail}` : head;
  });
  lines.push(
    `\n${report.passed} passed, ${report.failed} failed, ${report.skipped} skipped`,
  );
  return lines.join("\n");
}
