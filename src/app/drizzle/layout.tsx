import { DataTableLayout } from "@/components/layout/data-table-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DataTableLayout>{children}</DataTableLayout>;
}
