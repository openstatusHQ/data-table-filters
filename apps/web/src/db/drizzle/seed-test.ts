import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { logs } from "./schema";
import { seedRows } from "./seed-data";

async function seedTest() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const db = drizzle(connectionString);

  console.log("Seeding test database with 8 deterministic rows...");
  await db.insert(logs as any).values(seedRows);
  console.log("Test seed complete!");

  process.exit(0);
}

seedTest().catch((err) => {
  console.error("Test seed failed:", err);
  process.exit(1);
});
