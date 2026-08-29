/**
 * The wire contract for row actions.
 *
 * Everything here crosses the network as JSON, so it is deliberately free of
 * Drizzle, React, and handler code. The server declares actions next to their
 * handlers (`createActionHandler`), projects them to `ActionDescriptor[]` for
 * the list response, and stamps each row with the ids it currently qualifies
 * for. The client renders buttons from that JSON and never learns what an
 * action *does*.
 *
 * `_actions` on a row is a hint. The handler's WHERE — the id set (or filter)
 * intersected with the action's `when` guard — is the authority, so a row that
 * changed between fetch and click is skipped, never mis-applied, and the
 * response's `applied` may be lower than the number of ids sent.
 */

export type ActionScope = "row" | "bulk" | "filter";

export type ActionVariant = "default" | "destructive";

/** What the client sees. Built by an explicit pick-list, never by omitting keys. */
export type ActionDescriptor = {
  /** Stable identifier — it is a URL segment and lands in audit logs. */
  id: string;
  label: string;
  scope: ActionScope[];
  variant?: ActionVariant;
  /** Confirmation copy. `{count}` is replaced with the affected row count. */
  confirm?: string;
  /** Where to POST. Composed by the server from its `basePath`. */
  href: string;
};

/**
 * The POST body. `ids` serves both `row` and `bulk` scope; `filter` applies
 * the action to every row matching a filter-values object in the same shape
 * the list endpoint reads from its search params.
 *
 * `expected_count` lets the client confirm against the number it showed the
 * user — the rows matching `filter` alone. The server compares it to that
 * same set (before the action's `when` guard narrows it) and answers
 * `count_mismatch` when it has drifted; the client may resend without it to
 * apply regardless. `applied` can still be lower than `expected_count`
 * because of the guard — that is by design, not drift.
 *
 * `cmd_id` is client-generated and flows through to the handler and the audit
 * hook. Delivery is at-least-once: the server keeps no ledger, so a retry after
 * an unknown outcome re-runs the handler.
 */
export type ActionRequest =
  | { scope: "ids"; ids: string[]; cmd_id: string }
  | {
      scope: "filter";
      filter: Record<string, unknown>;
      expected_count?: number;
      cmd_id: string;
    };

export type ActionResponse = { applied: number };

export type ActionErrorCode =
  | "unknown_action"
  | "scope_not_allowed"
  | "invalid_request"
  | "count_mismatch"
  | "forbidden"
  | "failed";

export type ActionError = {
  error: ActionErrorCode;
  /** Present on `count_mismatch`: what the server counted. */
  actual?: number;
};

/** Per-row list of action ids the row currently qualifies for. */
export const ROW_ACTIONS_KEY = "_actions";

export type WithRowActions<TRow> = TRow & {
  [ROW_ACTIONS_KEY]: string[];
};
