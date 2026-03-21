import {
  DataTableLayout,
  DataTableLayoutFloatingAction,
  DataTableLayoutFloatingBar,
} from "@/components/layout/data-table-layout";
import { LockBodyScroll } from "./lock-body-scroll";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DataTableLayout>
      <LockBodyScroll />
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
