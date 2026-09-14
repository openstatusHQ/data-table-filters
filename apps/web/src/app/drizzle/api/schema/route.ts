import {
  createTableManifest,
  createTableManifestHandler,
} from "@dtf/registry/lib/table-schema";
import { tableSchema } from "../../table-schema";
import { actionHandler, demoActionsEnabled } from "../actions";

export const dynamic = "force-dynamic";

/**
 * The manifest for the `logs` table.
 *
 * Built per request rather than once at module load because `actions` depends
 * on `demoActionsEnabled()`, which is read at request time so tests can flip
 * it — the same reason the list endpoint checks it per request.
 *
 * Every capability declared here is one this endpoint actually implements:
 * `createDrizzleHandler` computes facets and both row counts, the route adds
 * chart data, and the cursor is bidirectional so live mode works.
 */
const handler = createTableManifestHandler(
  () =>
    createTableManifest({
      schema: tableSchema,
      primaryKey: "uuid",
      rowLabel: "{method} {pathname}",
      capabilities: {
        facets: true,
        totalRowCount: true,
        filterRowCount: true,
        chart: true,
        backwardPagination: true,
        actions: demoActionsEnabled(),
      },
      // The timeline chart buckets over `date` and stacks one series per log
      // level — decided in the client's TimelineChart until now, which a table
      // pointed at this endpoint could not have known.
      chart: {
        columnKey: "date",
        series: [
          { key: "success", label: "Success" },
          { key: "warning", label: "Warning" },
          { key: "error", label: "Error" },
        ],
      },
      defaults: { sort: { id: "date", desc: true }, size: 40 },
      ...(demoActionsEnabled() ? { actions: actionHandler.descriptors } : {}),
    }),
  { cacheControl: "no-cache" },
);

export async function GET(request: Request): Promise<Response> {
  return handler(request);
}
