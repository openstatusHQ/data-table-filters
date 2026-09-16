import { LEVELS, METHODS, REGIONS, type ColumnSchema } from "./table-schema";

const ROWS = 5000;
const DAYS = 7;

const PATHNAMES = [
  "/api/v1/orders",
  "/api/v1/products",
  "/api/v1/customers",
  "/checkout",
  "/cart",
  "/search",
  "/account/settings",
  "/health",
];

/** A small seeded generator, so every server process serves the same rows. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)];
}

function hex(random: () => number, length: number): string {
  let out = "";
  for (let index = 0; index < length; index++) {
    out += Math.floor(random() * 16).toString(16);
  }
  return out;
}

function statusFor(random: () => number): number {
  const roll = random();
  if (roll < 0.85) return 200;
  if (roll < 0.9) return 201;
  if (roll < 0.94) return 400;
  if (roll < 0.97) return 404;
  return 500;
}

function levelFor(status: number): (typeof LEVELS)[number] {
  if (status >= 500) return "error";
  if (status >= 400) return "warning";
  return "info";
}

/**
 * Rows spread over the last `DAYS` days, newest first — the order a timestamp
 * cursor expects. The values are seeded, so a refresh shows the same table;
 * only the timestamps move with the clock.
 */
export function createRows(now: number = Date.now()): ColumnSchema[] {
  const random = mulberry32(42);
  const span = DAYS * 24 * 60 * 60 * 1000;
  const step = span / ROWS;
  const rows: ColumnSchema[] = [];

  for (let index = 0; index < ROWS; index++) {
    const status = statusFor(random);
    const base = 40 + random() * 200;
    const slow = random() < 0.05 ? random() * 3000 : 0;
    rows.push({
      uuid: hex(random, 32),
      // Jitter stays under one step, so the order is strictly descending.
      date: new Date(now - Math.floor(index * step + random() * step * 0.4)),
      level: levelFor(status),
      status,
      method: pick(random, METHODS),
      pathname: pick(random, PATHNAMES),
      region: pick(random, REGIONS),
      latency: Math.round(base + slow),
    });
  }

  return rows;
}

export const rows = createRows();
