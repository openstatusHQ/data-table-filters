import { createMockLogs } from "@/db/mock";
import { ColumnSchema } from "../schema";

const DAYS = 20;

export { createMockLogs };

export const mock = Array.from({ length: DAYS * 24 })
  .map((_, i) => createMockLogs({ minutes: i * 60 }))
  .reduce((prev, curr) => prev.concat(curr), []) satisfies ColumnSchema[];

export const mockLive = Array.from({ length: 10 })
  // REMINDER: do not use random, otherwise data needs to be sorted
  .map((_, i) => createMockLogs({ minutes: -((i + 1) * 0.3) }))
  .reduce((prev, curr) => prev.concat(curr), [])
  .reverse() satisfies ColumnSchema[];
