import type { TableManifest } from "@dtf/registry/lib/table-schema";

/**
 * The query parameter that names the manifest.
 *
 * It shares the URL with the table's own state, which is keyed by column, so it
 * has to be a name no table is likely to use — `endpoint` and `url` are both
 * ordinary columns in a request log.
 */
export const MANIFEST_PARAM = "manifest";

export const DEFAULT_MANIFEST = "/drizzle/api/schema";

export type EndpointExample = {
  label: string;
  description: string;
  manifest: string;
};

export const EXAMPLES: EndpointExample[] = [
  {
    label: "HTTP logs",
    description:
      "Postgres through Drizzle. Facets, counts, the chart and live mode are computed in SQL.",
    manifest: DEFAULT_MANIFEST,
  },
  {
    label: "Orders",
    description:
      "An in-memory array served as plain JSON. The schema is inferred from the rows.",
    manifest: "/headless/api/orders/schema",
  },
];

const MAX_URL_LENGTH = 2048;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type ManifestTarget =
  | {
      ok: true;
      /** What to fetch: a root-relative path, or a normalized absolute URL. */
      url: string;
      /** The host, when the manifest is not served by this site. */
      externalHost: string | null;
    }
  | { ok: false; reason: string };

/**
 * Decide whether a pasted manifest URL may be fetched.
 *
 * The value arrives from a form field or a shared link, so it is whatever
 * someone typed. A root-relative path stays on this site. Anything else has to
 * be an absolute `https:` URL — `http:` only for localhost, which is what lets
 * someone point the page at an API running on their own machine.
 */
export function parseManifestInput(input: string): ManifestTarget {
  const value = input.trim();
  if (!value) return { ok: false, reason: "Enter a manifest URL." };
  if (value.length > MAX_URL_LENGTH) {
    return { ok: false, reason: "That URL is too long." };
  }
  // Browsers read `\` as `/` in a URL, so `/\host` is `//host`.
  if (value.includes("\\")) {
    return { ok: false, reason: "A URL cannot contain a backslash." };
  }
  // They also strip tabs and line breaks before parsing, so `/<tab>/host` is
  // `//host` too: another host, reached through what reads as a local path.
  if (/[\u0000- \u007f]/.test(value)) {
    return {
      ok: false,
      reason: "A URL cannot contain spaces or control characters.",
    };
  }

  if (value.startsWith("/")) {
    if (value.startsWith("//")) {
      return {
        ok: false,
        reason: "Use a full https:// URL for another host.",
      };
    }
    return { ok: true, url: value, externalHost: null };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      reason: "Enter a path starting with / or a full https:// URL.",
    };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "Leave credentials out of the URL." };
  }
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    return {
      ok: false,
      reason: "Only https:// URLs are allowed (http:// for localhost).",
    };
  }

  return { ok: true, url: url.toString(), externalHost: url.host };
}

/**
 * A manifest URL without its query string and fragment.
 *
 * The rows endpoint is derived from the manifest's path, and the table appends
 * its own query string to it. Carrying `?v=2` across would leave `/schema` in
 * place, since it is no longer the end of the URL, and produce a second `?`.
 */
export function withoutQuery(url: string): string {
  return url.split(/[?#]/, 1)[0];
}

/** The page URL that renders a given manifest. */
export function headlessHref(manifest: string): string {
  if (manifest === DEFAULT_MANIFEST) return "/headless";
  return `/headless?${MANIFEST_PARAM}=${encodeURIComponent(manifest)}`;
}

/**
 * A short, stable id for a manifest URL.
 *
 * Column order, visibility and command history are stored per table id, so two
 * endpoints must not share one — the columns of the first would be applied to
 * the second.
 */
export function tableIdFor(manifest: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < manifest.length; i++) {
    hash ^= manifest.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `headless-${hash.toString(36)}`;
}

/**
 * The column live mode runs along: where the chart buckets, else the default
 * sort, else the first timestamp column. `undefined` when the table has none.
 */
export function timeColumnKey(
  manifest: Pick<TableManifest, "chart" | "defaults" | "schema">,
): string | undefined {
  const timestamps = manifest.schema.columns
    .filter((column) => column.kind === "timestamp")
    .map((column) => column.key);
  const preferred = [manifest.chart?.columnKey, manifest.defaults?.sort?.id];
  for (const key of preferred) {
    if (key && timestamps.includes(key)) return key;
  }
  return timestamps[0];
}
