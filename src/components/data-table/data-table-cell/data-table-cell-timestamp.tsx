"use client";

import { HoverCardTimestamp } from "@/app/infinite/_components/hover-card-timestamp";

export function DataTableCellTimestamp({
  date,
}: {
  date: Date | string | number;
}) {
  const d = date instanceof Date ? date : new Date(date);
  return <HoverCardTimestamp date={d} />;
}
