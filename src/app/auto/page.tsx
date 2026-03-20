import { DataTableAuto } from "@/components/data-table/data-table-auto";
import bookmarks from "./bookmarks.json";

export default function Page() {
  return <DataTableAuto data={bookmarks} />;
}
