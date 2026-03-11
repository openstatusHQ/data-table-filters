import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { createMockLogs } from "../mock";
import { logs } from "./schema";

const DAYS = 20;

function toDrizzleRow(row: ReturnType<typeof createMockLogs>[number]) {
  return {
    uuid: row.uuid,
    method: row.method,
    host: row.host,
    pathname: row.pathname,
    level: row.level,
    latency: row.latency,
    status: row.status,
    regions: row.regions,
    date: row.date,
    headers: row.headers,
    message: row.message ?? null,
    timingDns: row["timing.dns"],
    timingConnection: row["timing.connection"],
    timingTls: row["timing.tls"],
    timingTtfb: row["timing.ttfb"],
    timingTransfer: row["timing.transfer"],
  };
}

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const db = drizzle(connectionString);

  console.log("Seeding database...");

  const allRows = Array.from({ length: DAYS * 24 }).flatMap((_, i) =>
    createMockLogs({ minutes: i * 60 }).map(toDrizzleRow),
  );

  console.log(`Inserting ${allRows.length} rows...`);

  const BATCH_SIZE = 500;
  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    await db.insert(logs as any).values(batch);
    console.log(
      `Inserted ${Math.min(i + BATCH_SIZE, allRows.length)}/${allRows.length}`,
    );
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
