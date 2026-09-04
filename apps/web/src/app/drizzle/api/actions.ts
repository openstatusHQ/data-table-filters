import { db } from "@/db/drizzle";
import { logs } from "@/db/drizzle/schema";
import { createActionHandler } from "@dtf/registry/lib/drizzle/actions";
import { defineFilters } from "@dtf/registry/lib/filters";
import { z } from "zod";
import { columnMapping } from "../column-mapping";
import { tableSchema } from "../table-schema";

/**
 * Demo actions against the shared `logs` table.
 *
 * The public site runs against one database, so writes are opt-in there: set
 * `ALLOW_DEMO_ACTIONS=1` and the list endpoint starts advertising actions and
 * the POST route starts accepting them. Local development is the opposite
 * default — on unless `ALLOW_DEMO_ACTIONS=0` — so the demo works out of the
 * box against your own database. Read at request time, not module load, so
 * tests can flip it.
 */
export function demoActionsEnabled(): boolean {
  const flag = process.env.ALLOW_DEMO_ACTIONS;
  if (flag === "1") return true;
  if (flag === "0") return false;
  return process.env.NODE_ENV === "development";
}

/** One interpretation of the table's filter semantics, shared with the GET. */
export const filters = defineFilters(tableSchema.definition);

export const actionHandler = createActionHandler({
  db,
  table: logs,
  filters,
  columnMapping,
  idColumn: "uuid",
  // `logs.uuid` is a `uuid` column: anything else fails the cast inside
  // Postgres, which would come back as a 500 instead of a 400.
  idSchema: z.uuid(),
  basePath: "/drizzle/api/actions",
  actions: {
    // Actions enqueue, they don't execute: this flips a status and lets the
    // rest of the system react. Only rows the guard allows — `level = error`
    // — are touched, whatever ids the client sent.
    acknowledge: {
      label: "Acknowledge",
      scope: ["row", "bulk", "filter"],
      when: { level: ["error"] },
      handler: async (ctx, tx) => {
        const rows = await tx
          .update(logs)
          .set({ level: "warning" })
          .where(ctx.where)
          .returning({ uuid: logs.uuid });
        return rows.length;
      },
    },
    delete: {
      label: "Delete",
      scope: ["row", "bulk"],
      variant: "destructive",
      confirm: "Delete {count} {log|logs}?",
      handler: async (ctx, tx) => {
        const rows = await tx
          .delete(logs)
          .where(ctx.where)
          .returning({ uuid: logs.uuid });
        return rows.length;
      },
    },
  },
  // Where a real deployment writes its audit log.
  audit: (event) => {
    console.info("[drizzle/api/actions]", JSON.stringify(event));
  },
});
