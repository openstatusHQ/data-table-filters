import { db } from "@/db/drizzle";
import { logs } from "@/db/drizzle/schema";
import { createMockLogs } from "@/db/mock";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rows = createMockLogs({ minutes: 0 });

  await db.insert(logs).values(
    rows.map((row) => ({
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
    })),
  );

  return Response.json({ success: true, inserted: rows.length });
}
