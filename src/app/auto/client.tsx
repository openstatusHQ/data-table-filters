"use client";

import { DataTableAuto } from "@/components/data-table/data-table-auto";
import { bookmarks } from "./data";

export function Client() {
  return <DataTableAuto data={bookmarks} />;
}
