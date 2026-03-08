import "dotenv/config";
import { subMinutes } from "date-fns";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { logs } from "./schema";

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
const REGIONS = ["ams", "fra", "gru", "hkg", "iad", "syd"] as const;
const DAYS = 20;

const multiplier: Record<(typeof REGIONS)[number], number> = {
  ams: 1,
  iad: 0.6,
  gru: 1.6,
  syd: 1.3,
  fra: 0.8,
  hkg: 1.4,
};

const shopPathnames = [
  "/bikes/gravel/road",
  "/bikes/racing/track",
  "/bikes/mountain/trail",
  "/bikes/city/cargo",
];

const apiPathnames = ["/v1/products", "/v1/orders", "/v1/customers"];

function getRandomStatusCode() {
  const rand = Math.random();
  if (rand < 0.9) return 200;
  if (rand < 0.96) return Math.random() < 0.5 ? 400 : 404;
  return 500;
}

function getLevel(status: number) {
  if (`${status}`.startsWith("2")) return "success" as const;
  if (`${status}`.startsWith("4")) return "warning" as const;
  return "error" as const;
}

function getRandomTiming(latency: number) {
  const dns = Math.random() * (0.15 - 0.05) + 0.05;
  const connection = Math.random() * (0.3 - 0.1) + 0.1;
  const tls = Math.random() * (0.1 - 0.05) + 0.05;
  const transfer = Math.random() * (0.004 - 0) + 0.004;
  const remaining = 1 - (dns + connection + tls + transfer);

  return {
    timingDns: Math.round(latency * dns),
    timingConnection: Math.round(latency * connection),
    timingTls: Math.round(latency * tls),
    timingTtfb: Math.round(latency * remaining),
    timingTransfer: Math.round(latency * transfer),
  };
}

function getRandomRequestObject() {
  const rand = Math.random();
  if (rand < 0.5) {
    return {
      method: "POST" as const,
      host: "api.acme-shop.com",
      pathname: apiPathnames[Math.floor(Math.random() * apiPathnames.length)],
    };
  }
  return {
    method: "GET" as const,
    host: "acme-shop.com",
    pathname: shopPathnames[Math.floor(Math.random() * shopPathnames.length)],
  };
}

function createRows(minutes: number) {
  const date = subMinutes(new Date(), minutes);
  const random = Math.random();
  const requestObject = getRandomRequestObject();
  const headers = {
    Age: "0",
    "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
    Server: "Cloudflare",
  };

  return REGIONS.map((region) => {
    const status = getRandomStatusCode();
    const latency = Math.round(
      1000 * (random * (1 - multiplier[region]) + multiplier[region]),
    );
    return {
      level: getLevel(status),
      latency,
      regions: [region],
      status,
      date,
      headers,
      message:
        status === 500
          ? 'ERR_INTERNAL_DISASTER: "The server spilled coffee on itself."'
          : null,
      ...getRandomTiming(latency),
      ...requestObject,
    };
  });
}

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log("Seeding database...");

  // Generate all rows
  const allRows = Array.from({ length: DAYS * 24 }).flatMap((_, i) =>
    createRows(i * 60),
  );

  console.log(`Inserting ${allRows.length} rows...`);

  // Insert in batches of 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    await db.insert(logs).values(batch);
    console.log(
      `Inserted ${Math.min(i + BATCH_SIZE, allRows.length)}/${allRows.length}`,
    );
  }

  console.log("Seeding complete!");
  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
