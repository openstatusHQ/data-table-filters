import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
  SORT_DELIMITER,
  SPACE_DELIMITER,
} from "@dtf/registry/lib/delimiters";

/**
 * The wire contract between the table and its list endpoint.
 *
 * This existed only implicitly, inside the nuqs serializer: the parameter
 * names, the delimiters, the sort encoding and the cursor convention were all
 * consequences of one client's implementation rather than anything an endpoint
 * author could read. That is fine while both halves ship together and useless
 * the moment someone else writes the server.
 *
 * Nothing here is new behaviour — it is the behaviour that was already on the
 * wire, written down, plus a validator so a response that does not honour it
 * fails loudly rather than rendering an empty table.
 */

// ── Request ─────────────────────────────────────────────────────────────────

/**
 * Reserved query parameters. Every other parameter is a column key, and its
 * value is encoded per {@link FILTER_ENCODING}.
 */
export const REQUEST_PARAMS = {
  /** Page cursor. Milliseconds since epoch for the default strategy. */
  cursor: "cursor",
  /** `"next"` (older) or `"prev"` (newer). Only sent when paging both ways. */
  direction: "direction",
  /** Page size. */
  size: "size",
  /** `"<columnKey>.<asc|desc>"` — see {@link SORT_DELIMITER}. */
  sort: "sort",
  /** Row-scoped view state. Never narrows the result set. */
  uuid: "uuid",
  /** Live-tail mode. Never narrows the result set. */
  live: "live",
} as const;

/**
 * How a filter value is written into a query parameter.
 *
 * The delimiters are shared with the client's parser; an endpoint that splits
 * differently will silently see one value where the user meant several.
 */
export const FILTER_ENCODING = {
  /** `checkbox`: `?level=error,warn` */
  array: ARRAY_DELIMITER,
  /** `slider`: `?latency=100-3000` (inclusive both ends) */
  slider: SLIDER_DELIMITER,
  /** `timerange`: `?date=1700000000000-1700003600000` (epoch ms, inclusive) */
  range: RANGE_DELIMITER,
  /** Spaces inside a single value. */
  space: SPACE_DELIMITER,
  /** `?sort=date.desc` */
  sort: SORT_DELIMITER,
} as const;

/**
 * A single value that itself contains the array delimiter cannot be encoded,
 * so `checkbox` values are required not to contain it. Stated here because it
 * is a constraint on the *data*, not on the client.
 */
export const ENCODING_CONSTRAINTS = [
  `A checkbox value may not contain ${JSON.stringify(ARRAY_DELIMITER)}.`,
  `Slider and timerange bounds may not be negative, because ${JSON.stringify(SLIDER_DELIMITER)} also separates them.`,
] as const;

// ── Response ────────────────────────────────────────────────────────────────

/** One problem with a response. `path` is a dotted location in the payload. */
export type ContractIssue = {
  path: string;
  message: string;
  /**
   * `error` — the table cannot render this correctly.
   * `warning` — renderable, but the endpoint is not doing what it claimed.
   */
  severity: "error" | "warning";
};

export type ValidateResponseOptions = {
  /**
   * What the endpoint said it computes. Fields it did not claim are not
   * required, and fields it *did* claim but omitted become warnings — that is
   * the whole point of the capability flags.
   */
  capabilities?: {
    facets?: boolean;
    totalRowCount?: boolean;
    filterRowCount?: boolean;
    chart?: boolean;
    backwardPagination?: boolean;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkFacet(
  facet: unknown,
  path: string,
  issues: ContractIssue[],
): void {
  if (!isRecord(facet)) {
    issues.push({ path, message: "facet is not an object", severity: "error" });
    return;
  }
  if (!Array.isArray(facet.rows)) {
    issues.push({
      path: `${path}.rows`,
      message: "facet is missing `rows`",
      severity: "error",
    });
  } else {
    facet.rows.forEach((row, index) => {
      if (!isRecord(row) || typeof row.total !== "number") {
        issues.push({
          path: `${path}.rows[${index}]`,
          message: "facet row must be `{ value, total: number }`",
          severity: "error",
        });
      }
    });
  }
  if (typeof facet.total !== "number") {
    issues.push({
      path: `${path}.total`,
      message: "facet is missing a numeric `total`",
      severity: "error",
    });
  }
  for (const bound of ["min", "max"] as const) {
    if (facet[bound] !== undefined && typeof facet[bound] !== "number") {
      issues.push({
        path: `${path}.${bound}`,
        message: `\`${bound}\` must be a number when present`,
        severity: "error",
      });
    }
  }
}

/**
 * Check one list response against the contract.
 *
 * Returns issues rather than throwing: a warning-only response still renders,
 * and a caller building a conformance report wants all of them at once, not
 * the first.
 */
export function validateListResponse(
  payload: unknown,
  options?: ValidateResponseOptions,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const capabilities = options?.capabilities ?? {};

  if (!isRecord(payload)) {
    return [
      { path: "", message: "response is not an object", severity: "error" },
    ];
  }

  if (!Array.isArray(payload.data)) {
    issues.push({
      path: "data",
      message: "`data` must be an array of rows",
      severity: "error",
    });
  }

  // A cursor of `null` means "no more pages" and is the normal end state, so
  // only a wrong *type* is a problem.
  for (const key of ["nextCursor", "prevCursor"] as const) {
    const value = payload[key];
    if (
      value !== null &&
      value !== undefined &&
      typeof value !== "number" &&
      typeof value !== "string"
    ) {
      issues.push({
        path: key,
        message: `\`${key}\` must be a number, a string, or null`,
        severity: "error",
      });
    }
  }

  if (capabilities.backwardPagination && payload.prevCursor === undefined) {
    issues.push({
      path: "prevCursor",
      message:
        "endpoint declares `backwardPagination` but sent no `prevCursor` field",
      severity: "warning",
    });
  }

  if (!isRecord(payload.meta)) {
    issues.push({
      path: "meta",
      message: "`meta` must be an object",
      severity: "error",
    });
    return issues;
  }

  const meta = payload.meta;

  for (const [key, claimed] of [
    ["totalRowCount", capabilities.totalRowCount],
    ["filterRowCount", capabilities.filterRowCount],
  ] as const) {
    const value = meta[key];
    if (value === undefined) {
      if (claimed) {
        issues.push({
          path: `meta.${key}`,
          message: `endpoint declares \`${key}\` but did not send it`,
          severity: "warning",
        });
      }
    } else if (typeof value !== "number") {
      issues.push({
        path: `meta.${key}`,
        message: `\`${key}\` must be a number`,
        severity: "error",
      });
    }
  }

  if (meta.facets !== undefined) {
    if (!isRecord(meta.facets)) {
      issues.push({
        path: "meta.facets",
        message: "`facets` must be an object keyed by column",
        severity: "error",
      });
    } else {
      for (const [key, facet] of Object.entries(meta.facets)) {
        checkFacet(facet, `meta.facets.${key}`, issues);
      }
    }
  } else if (capabilities.facets) {
    issues.push({
      path: "meta.facets",
      message: "endpoint declares `facets` but did not send them",
      severity: "warning",
    });
  }

  if (meta.chartData !== undefined) {
    if (!Array.isArray(meta.chartData)) {
      issues.push({
        path: "meta.chartData",
        message: "`chartData` must be an array",
        severity: "error",
      });
    } else {
      meta.chartData.forEach((point, index) => {
        if (!isRecord(point) || typeof point.timestamp !== "number") {
          issues.push({
            path: `meta.chartData[${index}]`,
            message: "each point must carry a numeric `timestamp`",
            severity: "error",
          });
        }
      });
    }
  } else if (capabilities.chart) {
    issues.push({
      path: "meta.chartData",
      message: "endpoint declares `chart` but did not send `chartData`",
      severity: "warning",
    });
  }

  if (meta.actions !== undefined && !Array.isArray(meta.actions)) {
    issues.push({
      path: "meta.actions",
      message: "`actions` must be an array of descriptors",
      severity: "error",
    });
  }

  return issues;
}

/** True when nothing in the response prevents the table from rendering it. */
export function isContractValid(issues: readonly ContractIssue[]): boolean {
  return !issues.some((issue) => issue.severity === "error");
}
