import {
  filterGenericData,
  getGenericFacets,
  sortGenericData,
} from "@/app/api/builder/data/helpers";
import { ordersData } from "@/app/builder/datasets/orders";
import type { InfiniteQueryResponse } from "@dtf/registry/lib/data-table";
import {
  createNuqsSearchParams,
  parseAsInteger,
} from "@dtf/registry/lib/store/adapters/nuqs/server";
import { field } from "@dtf/registry/lib/store/schema";
import {
  createTableManifest,
  createTableSchema,
  generateFilterSchema,
} from "@dtf/registry/lib/table-schema";
import { inferSchemaFromJSON } from "@dtf/registry/lib/table-schema/infer";

/**
 * A second endpoint for the headless demo, as unlike the logs table as it can
 * be made: no database, no SuperJSON, no timestamp cursor, and no column
 * written by hand. The schema is inferred from the rows, the manifest is built
 * from the schema, and the list is filtered in memory by the same filter
 * semantics the SQL handler uses.
 */

type Row = Record<string, unknown>;

const rows: Row[] = ordersData;

const schema = inferSchemaFromJSON(rows);
const { definition } = createTableSchema.fromJSON(schema);

export const manifest = createTableManifest({
  schema,
  primaryKey: "order_id",
  rowLabel: "{order_id} · {product}",
  // Only what `listOrders` computes. No chart, and no backwards paging: the
  // cursor is an offset, which has no "newer than" to page towards.
  capabilities: {
    facets: true,
    totalRowCount: true,
    filterRowCount: true,
  },
});

const { searchParamsCache } = createNuqsSearchParams(
  generateFilterSchema(definition, { sort: field.sort() }).definition,
  { extraParsers: { cursor: parseAsInteger, size: parseAsInteger } },
);

const DEFAULT_SIZE = 20;
const MAX_SIZE = 100;

/**
 * One page of orders for a query string.
 *
 * `cursor` is opaque to the table — it sends back whatever `nextCursor` it was
 * given — so here it is simply the offset of the next row.
 */
export function listOrders(
  query: Record<string, string>,
): InfiniteQueryResponse<Row[]> {
  const { sort, cursor, size, ...filters } = searchParamsCache.parse(
    query,
  ) as Record<string, unknown> & {
    sort: { id: string; desc: boolean } | null;
    cursor: number | null;
    size: number | null;
  };

  const filtered = filterGenericData(rows, filters, definition);
  const sorted = sortGenericData(filtered, sort);

  const offset = Math.max(0, cursor ?? 0);
  const limit = Math.min(MAX_SIZE, Math.max(1, size ?? DEFAULT_SIZE));
  const data = sorted.slice(offset, offset + limit);
  const next = offset + data.length;

  return {
    data,
    meta: {
      totalRowCount: rows.length,
      filterRowCount: filtered.length,
      facets: getGenericFacets(filtered, rows, definition),
      chartData: [],
    },
    nextCursor: next < sorted.length ? next : null,
    prevCursor: null,
  };
}

/** Public, read-only sample data: any origin may point a table at it. */
export const CORS_HEADERS = { "access-control-allow-origin": "*" };
