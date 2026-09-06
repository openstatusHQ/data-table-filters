import type { ActionDescriptor, ActionScope, ActionVariant } from "./types";

/**
 * Descriptor validation for the client.
 *
 * `meta.actions` is server-authored, and in the headless model that server is
 * not necessarily ours — the table is pointed at an endpoint and renders what
 * comes back. A descriptor is therefore untrusted input that ends up choosing a
 * URL the client will POST a list of row ids to. Nothing downstream re-checks
 * it: `postAction` sends wherever `href` says.
 *
 * So descriptors are validated once, on the way in, and anything that fails is
 * dropped rather than rendered. A button that cannot be sent safely is worse
 * than no button.
 */

const SCOPES: ReadonlySet<string> = new Set<ActionScope>([
  "row",
  "bulk",
  "filter",
]);

const VARIANTS: ReadonlySet<string> = new Set<ActionVariant>([
  "default",
  "destructive",
]);

/** Copy is rendered, not executed, but an unbounded string is still a DoS. */
const MAX_TEXT_LENGTH = 500;
/** An id is a URL segment and an audit-log key. */
const MAX_ID_LENGTH = 100;
const MAX_HREF_LENGTH = 2048;

/** C0 controls plus DEL — an encoding bug, or smuggling past a first-line check. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export type ActionValidationOptions = {
  /**
   * Origins allowed in addition to the page's own.
   *
   * Only needed when the actions endpoint lives on another host — the common
   * case is a relative `href`, which is always same-origin and needs nothing
   * here. Each entry is compared as an origin (`https://api.example.com`), so a
   * path in the entry is ignored.
   */
  allowedOrigins?: readonly string[];
  /**
   * The page's own origin. Defaults to `window.location.origin`, and is passed
   * explicitly by tests and by server-side rendering.
   */
  selfOrigin?: string;
};

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function currentOrigin(options?: ActionValidationOptions): string | null {
  if (options?.selfOrigin) return normalizeOrigin(options.selfOrigin);
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return null;
}

/**
 * Is this `href` one we are willing to POST row ids to?
 *
 * - A root-relative path (`/api/actions/replay`) is same-origin by
 *   construction and is allowed.
 * - A protocol-relative URL (`//evil.example.com/x`) reads like a path and is
 *   not one. Rejected.
 * - An absolute `http(s)` URL is allowed only when its origin is the page's own
 *   or explicitly allow-listed.
 * - Everything else — `javascript:`, `data:`, `blob:`, or a directory-relative
 *   path that would resolve against whatever page the table happens to be on —
 *   is rejected.
 */
export function isSafeActionHref(
  href: unknown,
  options?: ActionValidationOptions,
): href is string {
  if (typeof href !== "string" || href.length === 0) return false;
  if (href.length > MAX_HREF_LENGTH) return false;
  if (CONTROL_CHARS.test(href)) return false;

  // Protocol-relative, in both spellings. WHATWG treats `\` as `/` for special
  // schemes, so `/\evil.example.com/x` reads here as a root-relative path and
  // resolves in the browser as `https://evil.example.com/x` — which would POST
  // row ids to an origin the allow-list exists to gate.
  if (href.startsWith("//") || href.startsWith("/\\")) return false;
  if (href.startsWith("/")) return true;

  const parsed = (() => {
    try {
      return new URL(href);
    } catch {
      return null;
    }
  })();
  if (!parsed) return false;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const allowed = new Set(
    (options?.allowedOrigins ?? [])
      .map(normalizeOrigin)
      .filter((origin): origin is string => origin !== null),
  );
  const self = currentOrigin(options);
  if (self) allowed.add(self);

  return allowed.has(parsed.origin);
}

/** Why a descriptor was dropped. Surfaced in the console, not the UI. */
export type ActionRejection = {
  /** The `id` when it was readable, otherwise the index in the array. */
  id: string;
  reason: string;
};

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

/**
 * Validate one descriptor. Returns the reason it failed, or `null` when it is
 * safe to render.
 */
export function validateActionDescriptor(
  value: unknown,
  options?: ActionValidationOptions,
): string | null {
  if (typeof value !== "object" || value === null) return "not an object";
  const action = value as Record<string, unknown>;

  if (!isNonEmptyString(action.id, MAX_ID_LENGTH)) return "invalid id";
  if (!isNonEmptyString(action.label, MAX_TEXT_LENGTH)) return "invalid label";

  if (!Array.isArray(action.scope) || action.scope.length === 0) {
    return "invalid scope";
  }
  if (!action.scope.every((scope) => SCOPES.has(scope as string))) {
    return "unknown scope";
  }

  if (action.variant !== undefined && !VARIANTS.has(action.variant as string)) {
    return "unknown variant";
  }

  if (
    action.confirm !== undefined &&
    !isNonEmptyString(action.confirm, MAX_TEXT_LENGTH)
  ) {
    return "invalid confirm";
  }

  if (
    action.maxIds !== undefined &&
    (typeof action.maxIds !== "number" ||
      !Number.isInteger(action.maxIds) ||
      action.maxIds <= 0)
  ) {
    return "invalid maxIds";
  }

  if (!isSafeActionHref(action.href, options)) return "unsafe href";

  return null;
}

/**
 * Keep the descriptors that are safe to render; report the rest.
 *
 * Returns the input array itself when nothing was dropped, so a provider can
 * memoize on the result without losing referential stability every render.
 */
export function sanitizeActionDescriptors(
  actions: readonly unknown[] | undefined,
  options?: ActionValidationOptions,
): { actions: ActionDescriptor[]; rejected: ActionRejection[] } {
  if (!Array.isArray(actions)) return { actions: [], rejected: [] };

  const kept: ActionDescriptor[] = [];
  const rejected: ActionRejection[] = [];
  const seen = new Set<string>();

  actions.forEach((action, index) => {
    const reason = validateActionDescriptor(action, options);
    if (reason) {
      const id = (action as { id?: unknown } | null)?.id;
      rejected.push({ id: typeof id === "string" ? id : `#${index}`, reason });
      return;
    }
    const descriptor = action as ActionDescriptor;
    // Ids address actions in the UI and in audit logs; a duplicate makes both
    // ambiguous, and the second one would be unreachable anyway.
    if (seen.has(descriptor.id)) {
      rejected.push({ id: descriptor.id, reason: "duplicate id" });
      return;
    }
    seen.add(descriptor.id);
    kept.push(descriptor);
  });

  return {
    actions: rejected.length === 0 ? (actions as ActionDescriptor[]) : kept,
    rejected,
  };
}
