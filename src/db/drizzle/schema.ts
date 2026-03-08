import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const levelEnum = pgEnum("level", ["success", "warning", "error"]);
export const methodEnum = pgEnum("method", ["GET", "POST", "PUT", "DELETE"]);

export const logs = pgTable("logs", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  level: levelEnum("level").notNull(),
  method: methodEnum("method").notNull(),
  host: text("host").notNull(),
  pathname: text("pathname").notNull(),
  status: integer("status").notNull(),
  latency: integer("latency").notNull(),
  regions: text("regions").array().notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  timingDns: integer("timing_dns").notNull(),
  timingConnection: integer("timing_connection").notNull(),
  timingTls: integer("timing_tls").notNull(),
  timingTtfb: integer("timing_ttfb").notNull(),
  timingTransfer: integer("timing_transfer").notNull(),
  headers: jsonb("headers").$type<Record<string, string>>().notNull(),
  message: text("message"),
});
