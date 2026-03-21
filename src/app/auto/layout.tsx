import {
  DataTableLayout,
  DataTableLayoutFloatingAction,
  DataTableLayoutFloatingBar,
} from "@/components/layout/data-table-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DataTableLayout>
      <DataTableLayoutFloatingBar>
        <DataTableLayoutFloatingAction href="https://github.com/openstatusHQ/data-table-filters">
          View GitHub Repo
        </DataTableLayoutFloatingAction>
        <DataTableLayoutFloatingAction href="/" secondary>
          Go back to home
        </DataTableLayoutFloatingAction>
      </DataTableLayoutFloatingBar>
      {children}
    </DataTableLayout>
  );
}
