import {
  ROW_ACTIONS_KEY,
  type ActionDescriptor,
  type ActionErrorCode,
  type ActionRequest,
  type ActionResponse,
  type ActionScope,
} from "@dtf/registry/lib/actions/types";

/** Replace `{name}` placeholders. Unknown names are left as-is. */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}

/** Read the server's `_actions` stamp off a row. Missing means "none". */
export function rowActionsOf(row: unknown): string[] {
  if (typeof row !== "object" || row === null) return [];
  const value = (row as Record<string, unknown>)[ROW_ACTIONS_KEY];
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}

export function actionsForScope(
  actions: readonly ActionDescriptor[],
  scope: ActionScope,
): ActionDescriptor[] {
  return actions.filter((action) => action.scope.includes(scope));
}

/** Row-scoped actions the row is stamped with, in descriptor order. */
export function rowScopedActions(
  actions: readonly ActionDescriptor[],
  rowActionIds: readonly string[],
): ActionDescriptor[] {
  return actionsForScope(actions, "row").filter((action) =>
    rowActionIds.includes(action.id),
  );
}

/**
 * Split a selection into the rows an action applies to and the rest.
 *
 * A bulk button stays enabled while *any* selected row qualifies — an
 * intersection would make bulk useless on a mixed list — and the request
 * carries only the eligible ids, with the skipped count surfaced in the
 * confirmation.
 */
export function partitionRows<TRow extends { original: unknown }>(
  rows: readonly TRow[],
  actionId: string,
  getRowActions: (row: TRow["original"]) => string[],
): { eligible: TRow[]; skipped: number } {
  const eligible = rows.filter((row) =>
    getRowActions(row.original).includes(actionId),
  );
  return { eligible, skipped: rows.length - eligible.length };
}

export function newCommandId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return `cmd_${c.randomUUID()}`;
  return `cmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** The server said no. `code` mirrors `ActionError.error`. */
export class ActionRequestError extends Error {
  readonly code: ActionErrorCode;
  readonly status: number;
  /** Present on `count_mismatch`. */
  readonly actual?: number;

  constructor(code: ActionErrorCode, status: number, actual?: number) {
    super(code.replace(/_/g, " "));
    this.name = "ActionRequestError";
    this.code = code;
    this.status = status;
    if (actual !== undefined) this.actual = actual;
  }
}

const KNOWN_CODES: ReadonlySet<string> = new Set<ActionErrorCode>([
  "unknown_action",
  "scope_not_allowed",
  "invalid_request",
  "count_mismatch",
  "forbidden",
  "failed",
]);

/** One POST. Throws `ActionRequestError` for any non-2xx. */
export async function postAction(
  href: string,
  request: ActionRequest,
  fetcher: typeof fetch = fetch,
): Promise<ActionResponse> {
  const response = await fetcher(href, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // A non-JSON body is handled by the status check below.
  }

  if (!response.ok) {
    const body = (json ?? {}) as { error?: unknown; actual?: unknown };
    const code =
      typeof body.error === "string" && KNOWN_CODES.has(body.error)
        ? (body.error as ActionErrorCode)
        : "failed";
    const actual = typeof body.actual === "number" ? body.actual : undefined;
    throw new ActionRequestError(code, response.status, actual);
  }

  // A 2xx without a numeric `applied` is not "applied to 0" — it is a route
  // that does not speak the contract (204, an HTML page from a proxy, …).
  const body = (json ?? {}) as { applied?: unknown };
  if (typeof body.applied !== "number") {
    throw new ActionRequestError("failed", response.status);
  }
  return { applied: body.applied };
}
