import {
  defineActions,
  type ActionDefinitionBase,
  type ActionDescriptor,
  type ActionErrorCode,
  type ActionRequest,
  type ActionResponse,
  type WithRowActions,
} from "@dtf/registry/lib/actions";
import type { Filters } from "@dtf/registry/lib/filters";
import { and, count, inArray, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { buildWhereConditions } from "./filters";
import type { ColumnMapping, DrizzleDB } from "./types";

/**
 * What a handler receives.
 *
 * `where` is the authority: the requested set (ids, or a filter) intersected
 * with the action's `when` guard. A handler that uses it cannot touch a row
 * the action does not apply to, no matter what the client sent.
 */
export type ActionContext = {
  where: SQL;
  /** Present for `scope: "ids"`. */
  ids?: string[];
  /** Present for `scope: "filter"` — already passed through `filters.coerce`. */
  filter?: Record<string, unknown>;
  /** Whoever the route authenticated. Never read from the request body. */
  actor?: string;
  /** Client-generated; at-least-once, see `ActionRequest`. */
  cmdId: string;
};

export type DrizzleActionDefinition<TRow = Record<string, unknown>> =
  ActionDefinitionBase<TRow> & {
    /**
     * Runs inside one transaction and returns how many rows it applied to.
     *
     * Actions enqueue; they don't execute. A replay flips `status` to
     * `pending` and lets the worker do the work — that is why one short
     * transaction is enough and why nothing here does I/O.
     *
     * ```ts
     * handler: async (ctx, tx) => {
     *   const rows = await tx
     *     .update(outbox)
     *     .set({ status: "pending", attempt: 0 })
     *     .where(ctx.where)
     *     .returning({ id: outbox.id });
     *   return rows.length;
     * }
     * ```
     */
    handler: (ctx: ActionContext, tx: DrizzleDB) => Promise<number>;
  };

export type ActionAuditEvent = {
  action: string;
  actor?: string;
  cmdId: string;
  scope: ActionRequest["scope"];
  ids?: string[];
  filter?: Record<string, unknown>;
  applied: number;
  at: Date;
};

export type ActionHandlerConfig<TRow = Record<string, unknown>> = {
  db: DrizzleDB;
  table: PgTable;
  /** The same `defineFilters(...)` the list handler uses. */
  filters: Filters;
  columnMapping: ColumnMapping;
  /** The schema key that identifies a row. Must be in `columnMapping`. */
  idColumn: string;
  actions: Record<string, DrizzleActionDefinition<TRow>>;
  /** `href` is `${basePath}/${id}` — the route that calls `execute`. */
  basePath: string;
  /** Upper bound on `ids.length`; larger requests are `invalid_request`. */
  maxIds?: number;
  /**
   * Called once per applied command, after the transaction committed. If it
   * throws, the mutation has already happened — the error propagates so the
   * route can decide, but nothing is rolled back.
   */
  audit?: (event: ActionAuditEvent) => void | Promise<void>;
};

const STATUS_BY_CODE: Record<ActionErrorCode, number> = {
  unknown_action: 404,
  scope_not_allowed: 400,
  invalid_request: 400,
  count_mismatch: 409,
  forbidden: 403,
  failed: 500,
};

/** A typed failure the route maps to an HTTP response. */
export class ActionHandlerError extends Error {
  readonly code: ActionErrorCode;
  readonly status: number;
  /** Present on `count_mismatch`. */
  readonly actual?: number;

  constructor(code: ActionErrorCode, message: string, actual?: number) {
    super(message);
    this.name = "ActionHandlerError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    if (actual !== undefined) this.actual = actual;
  }

  /** The JSON body for the wire. */
  toJSON(): { error: ActionErrorCode; actual?: number } {
    return this.actual === undefined
      ? { error: this.code }
      : { error: this.code, actual: this.actual };
  }
}

const requestSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("ids"),
    ids: z.array(z.string().min(1)).min(1),
    cmd_id: z.string().min(1),
  }),
  z.object({
    scope: z.literal("filter"),
    filter: z.record(z.string(), z.unknown()),
    expected_count: z.number().int().nonnegative().optional(),
    cmd_id: z.string().min(1),
  }),
]);

export type ActionHandler<TRow = Record<string, unknown>> = {
  /** Public metadata for `meta.actions`. */
  descriptors: ActionDescriptor[];
  /** Stamp fetched rows with `_actions`. */
  annotate<T extends TRow>(rows: readonly T[]): WithRowActions<T>[];
  /**
   * Run one action. Throws `ActionHandlerError` for every contract violation;
   * anything else that escapes is the handler's own failure, already rolled
   * back.
   */
  execute(
    actionId: string,
    body: unknown,
    options?: { actor?: string },
  ): Promise<ActionResponse>;
};

/**
 * The write-side sibling of `createDrizzleHandler`.
 *
 * Shares its `filters` and `columnMapping`, so an action's `when` guard and a
 * filter-scoped request compile through the very same `buildWhereConditions`
 * the list endpoint uses — the set the user saw is the set the action hits.
 */
export function createActionHandler<TRow = Record<string, unknown>>(
  config: ActionHandlerConfig<TRow>,
): ActionHandler<TRow> {
  const {
    db,
    table,
    filters,
    columnMapping,
    idColumn,
    basePath,
    maxIds = 1000,
    audit,
  } = config;

  const idCol = columnMapping[idColumn];
  if (!idCol) {
    throw new Error(
      `[createActionHandler] idColumn "${idColumn}" not found in columnMapping`,
    );
  }

  // Mirror `createDrizzleHandler`: `buildWhereConditions` skips a key that is
  // missing from the mapping. For a `when` guard that would mean "every row";
  // for a filter-scoped request, "more rows than the user saw". Fail here.
  const unmapped = filters.specs
    .map((spec) => spec.key)
    .filter((key) => !columnMapping[key]);
  if (unmapped.length > 0) {
    throw new Error(
      `[createActionHandler] These filterable columns are missing from columnMapping:\n` +
        unmapped.map((key) => `  - ${key}`).join("\n"),
    );
  }

  const defined = defineActions<DrizzleActionDefinition<TRow>>(
    filters,
    config.actions,
    { basePath },
  );

  // `when` guards never change after construction, so compile them once.
  const guards = new Map<string, SQL[]>();
  for (const [id, definition] of defined.definitions) {
    guards.set(
      id,
      definition.when
        ? buildWhereConditions(filters, definition.when, columnMapping)
        : [],
    );
  }

  async function execute(
    actionId: string,
    body: unknown,
    options: { actor?: string } = {},
  ): Promise<ActionResponse> {
    const definition = defined.definitions.get(actionId);
    if (!definition) {
      throw new ActionHandlerError("unknown_action", `No action "${actionId}"`);
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ActionHandlerError(
        "invalid_request",
        `Invalid request body: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ")}`,
      );
    }
    const request = parsed.data;

    const guard = guards.get(actionId) ?? [];
    let where: SQL;
    /** The set the client counted — the filter alone, before the guard. */
    let shown: SQL | undefined;
    let ids: string[] | undefined;
    let filter: Record<string, unknown> | undefined;

    if (request.scope === "ids") {
      const allowed =
        definition.scope.includes("row") || definition.scope.includes("bulk");
      if (!allowed) {
        throw new ActionHandlerError(
          "scope_not_allowed",
          `Action "${actionId}" does not accept ids (scope: ${definition.scope.join(", ")})`,
        );
      }
      if (!definition.scope.includes("bulk") && request.ids.length > 1) {
        throw new ActionHandlerError(
          "scope_not_allowed",
          `Action "${actionId}" accepts one id at a time (scope: ${definition.scope.join(", ")})`,
        );
      }
      if (request.ids.length > maxIds) {
        throw new ActionHandlerError(
          "invalid_request",
          `Too many ids (${request.ids.length} > ${maxIds}); use scope "filter"`,
        );
      }
      ids = Array.from(new Set(request.ids));
      where = and(inArray(idCol, ids), ...guard)!;
    } else {
      if (!definition.scope.includes("filter")) {
        throw new ActionHandlerError(
          "scope_not_allowed",
          `Action "${actionId}" does not accept a filter (scope: ${definition.scope.join(", ")})`,
        );
      }
      // The same interpretation as the list endpoint: `filters.plan` (inside
      // `buildWhereConditions`) drops unknown keys and inactive values and
      // never clamps. `filters.coerce` would clamp a slider to its declared
      // bounds — and a range the user dragged past those bounds must hit the
      // rows they saw, not a narrower set. Unknown keys are dropped from the
      // recorded filter as well.
      filter = Object.fromEntries(
        Object.entries(request.filter).filter(
          ([key]) => filters.spec(key) !== undefined,
        ),
      );
      const visible = buildWhereConditions(filters, filter, columnMapping);
      // An empty filter is "every row". Legal — `expected_count` is the
      // client's safety net — but the handler still gets a real SQL.
      shown = and(...visible) ?? sql`true`;
      where = and(...visible, ...guard) ?? sql`true`;
    }

    const ctx: ActionContext = {
      where,
      cmdId: request.cmd_id,
      ...(ids ? { ids } : {}),
      ...(filter ? { filter } : {}),
      ...(options.actor !== undefined ? { actor: options.actor } : {}),
    };
    const expectedCount =
      request.scope === "filter" ? request.expected_count : undefined;

    const applied = await db.transaction(async (tx) => {
      if (expectedCount !== undefined && shown !== undefined) {
        // Drift is measured on the set the client was shown, not on the
        // guarded set: a guard makes `applied` smaller by design, and that is
        // not "the set changed".
        const [row] = await tx.select({ n: count() }).from(table).where(shown);
        const actual = Number(row?.n ?? 0);
        if (actual !== expectedCount) {
          throw new ActionHandlerError(
            "count_mismatch",
            `Expected ${expectedCount} rows, found ${actual}`,
            actual,
          );
        }
      }
      const result = await definition.handler(ctx, tx);
      if (typeof result !== "number" || !Number.isFinite(result)) {
        throw new Error(
          `[createActionHandler] Action "${actionId}" handler must return the applied row count, got ${String(result)}`,
        );
      }
      return result;
    });

    if (audit) {
      await audit({
        action: actionId,
        cmdId: request.cmd_id,
        scope: request.scope,
        applied,
        at: new Date(),
        ...(ids ? { ids } : {}),
        ...(filter ? { filter } : {}),
        ...(options.actor !== undefined ? { actor: options.actor } : {}),
      });
    }

    return { applied };
  }

  return {
    descriptors: defined.descriptors,
    annotate: (rows) => defined.annotate(rows),
    execute,
  };
}
