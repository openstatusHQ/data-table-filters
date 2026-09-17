import {
  DataTableLayout,
  DataTableLayoutFloatingAction,
  DataTableLayoutFloatingBar,
} from "@/components/layout/data-table-layout";
import type { Metadata } from "next";

/**
 * The registry's `data-table-example-infinite` block, mounted as-is so a
 * change to the example is visible locally before it ships. The root layout
 * already provides the query client and the nuqs adapter the block expects.
 */
export const metadata: Metadata = {
  title: "Example",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DataTableLayout>
      <DataTableLayoutFloatingBar>
        <DataTableLayoutFloatingAction href="/docs">
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
