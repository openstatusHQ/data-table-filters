import {
  DataTableLayout,
  DataTableLayoutFloatingAction,
  DataTableLayoutFloatingBar,
} from "@/components/layout/data-table-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Headless",
  description:
    "Point the table at an API endpoint. Columns, filters, the detail sheet and URL state are derived from the manifest the endpoint serves.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DataTableLayout>
      <DataTableLayoutFloatingBar>
        <DataTableLayoutFloatingAction href="/docs/headless">
          View Documentation
        </DataTableLayoutFloatingAction>
        <DataTableLayoutFloatingAction href="/" secondary>
          Go back to home
        </DataTableLayoutFloatingAction>
      </DataTableLayoutFloatingBar>
      {children}
    </DataTableLayout>
  );
}
