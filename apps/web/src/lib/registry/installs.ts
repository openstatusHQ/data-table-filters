import { createHash } from "node:crypto";

/**
 * Install counting for the registry.
 *
 * The blocks are static files under `/r/*.json`, served from the CDN, so the
 * only thing that runs on an install is the proxy — it hands each fetch to
 * `installEvent` and `recordInstall`, then serves the file unchanged. Stars
 * say who looked; these keys say who installed what, and how many blocks a
 * single run pulled in.
 *
 * Keys, all in Upstash:
 *
 *   installs:block:<block>:<day>   fetches of one block on one UTC day
 *   installs:block:<block>         fetches of one block, all time
 *   installs:client:<kind>:<day>   fetches by a CLI/agent vs a browser
 *   installs:runs:<day>            HyperLogLog of run fingerprints — distinct
 *                                  install runs that day
 *
 * A run is one `shadcn add` invocation: the CLI fetches the requested blocks
 * and their registry dependencies within seconds from one address, so the
 * fingerprint is the address, the user agent, and the hour. It is a count,
 * not an identity — the hash is truncated and the hour bucket means the same
 * person tomorrow is a new run.
 */

const REGISTRY_FILE = /^\/r\/([\w-]+)\.json$/;

export type Client = "cli" | "browser";

export type InstallEvent = {
  block: string;
  client: Client;
  /** UTC day, `YYYY-MM-DD`. */
  day: string;
  fingerprint: string;
};

export const KEYS = {
  block: (block: string, day: string) => `installs:block:${block}:${day}`,
  blockTotal: (block: string) => `installs:block:${block}`,
  client: (client: Client, day: string) => `installs:client:${client}:${day}`,
  runs: (day: string) => `installs:runs:${day}`,
};

/**
 * `/r/data-table.json` -> `data-table`; anything else -> null. `known` is the
 * manifest's block names: `/r/registry.json` is served from the same folder
 * but is not a block, and `/r/anything.json` is a 404 the proxy cannot see.
 */
export function blockFromPath(
  pathname: string,
  known: ReadonlySet<string>,
): string | null {
  const match = pathname.match(REGISTRY_FILE);
  if (!match) return null;
  return known.has(match[1]) ? match[1] : null;
}

/**
 * Browsers announce themselves with `Mozilla/`; the shadcn CLI, curl, and
 * agents' fetch clients do not. A browser hit is someone clicking the link in
 * the docs, not an install.
 */
export function classifyClient(userAgent: string | null): Client {
  return userAgent?.startsWith("Mozilla/") ? "browser" : "cli";
}

export function dayKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export function runFingerprint(input: {
  ip: string;
  userAgent: string | null;
  at: Date;
}): string {
  const hour = input.at.toISOString().slice(0, 13);
  return createHash("sha256")
    .update(`${input.ip}\n${input.userAgent ?? ""}\n${hour}`)
    .digest("hex")
    .slice(0, 16);
}

export function installEvent(input: {
  method: string;
  pathname: string;
  userAgent: string | null;
  ip: string;
  at: Date;
  /** Block names from the manifest; see `blockFromPath`. */
  blocks: ReadonlySet<string>;
}): InstallEvent | null {
  // A download is a GET. HEAD is a link checker or a CDN probe.
  if (input.method !== "GET") return null;

  const block = blockFromPath(input.pathname, input.blocks);
  if (!block) return null;

  return {
    block,
    client: classifyClient(input.userAgent),
    day: dayKey(input.at),
    fingerprint: runFingerprint(input),
  };
}

/** The slice of the Upstash client `recordInstall` needs, so tests can fake it. */
export type CounterPipeline = {
  incr(key: string): unknown;
  pfadd(key: string, ...members: string[]): unknown;
  exec(): Promise<unknown>;
};

export type CounterStore = { pipeline(): CounterPipeline };

export async function recordInstall(
  store: CounterStore,
  event: InstallEvent,
): Promise<void> {
  const pipeline = store.pipeline();
  pipeline.incr(KEYS.block(event.block, event.day));
  pipeline.incr(KEYS.blockTotal(event.block));
  pipeline.incr(KEYS.client(event.client, event.day));
  // Browser hits are not runs — a person reading the JSON is not installing.
  if (event.client === "cli") {
    pipeline.pfadd(KEYS.runs(event.day), event.fingerprint);
  }
  await pipeline.exec();
}

/** The slice of the Upstash client `installSummary` needs, so tests can fake it. */
export type SummaryPipeline = {
  mget(...keys: string[]): unknown;
  pfcount(...keys: string[]): unknown;
  exec(): Promise<unknown[]>;
};

export type SummaryStore = { pipeline(): SummaryPipeline };

export type InstallSummary = {
  /** UTC days covered, oldest first. */
  days: string[];
  /** Distinct CLI install runs per day, same order as `days`. */
  runs: number[];
  clients: Record<Client, number[]>;
  blocks: {
    name: string;
    total: number;
    /** Fetches per day, same order as `days`. */
    byDay: number[];
    /** Sum over the window. */
    window: number;
  }[];
};

/** The last `days` UTC days ending today, oldest first. */
export function recentDays(today: Date, days: number): string[] {
  const out: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    out.push(dayKey(date));
  }
  return out;
}

const toNumber = (value: unknown) => Number(value ?? 0) || 0;

export async function installSummary(
  store: SummaryStore,
  input: { blocks: string[]; today: Date; days: number },
): Promise<InstallSummary> {
  const days = recentDays(input.today, input.days);
  if (days.length === 0 || input.blocks.length === 0) {
    // MGET with no keys is an error, and there is nothing to ask for.
    return { days, runs: [], clients: { cli: [], browser: [] }, blocks: [] };
  }

  const blockKeys = input.blocks.flatMap((block) =>
    days.map((day) => KEYS.block(block, day)),
  );
  const totalKeys = input.blocks.map((block) => KEYS.blockTotal(block));
  const clientKeys = (["cli", "browser"] as const).flatMap((client) =>
    days.map((day) => KEYS.client(client, day)),
  );

  // One round trip. The runs series needs one PFCOUNT per day — a single
  // call over several keys returns the cardinality of their union — so
  // those go in the same pipeline rather than out as `days` requests.
  const pipeline = store.pipeline();
  pipeline.mget(...blockKeys);
  pipeline.mget(...totalKeys);
  pipeline.mget(...clientKeys);
  for (const day of days) pipeline.pfcount(KEYS.runs(day));

  const [blockCounts, totals, clientCounts, ...runCounts] =
    (await pipeline.exec()) as [unknown[], unknown[], unknown[], ...unknown[]];

  return {
    days,
    runs: runCounts.map(toNumber),
    clients: {
      cli: clientCounts.slice(0, days.length).map(toNumber),
      browser: clientCounts.slice(days.length).map(toNumber),
    },
    blocks: input.blocks.map((name, index) => {
      const byDay = blockCounts
        .slice(index * days.length, (index + 1) * days.length)
        .map(toNumber);
      return {
        name,
        total: toNumber(totals[index]),
        byDay,
        window: byDay.reduce((sum, count) => sum + count, 0),
      };
    }),
  };
}
