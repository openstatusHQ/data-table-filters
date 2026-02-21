"use client";

import { HoverCardTimestamp } from "@/app/infinite/_components/hover-card-timestamp";

export function DataTableCellTimestamp({ date }: { date: Date }) {
  return <HoverCardTimestamp date={date} />;
}
