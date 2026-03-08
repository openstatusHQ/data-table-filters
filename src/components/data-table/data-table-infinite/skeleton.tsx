import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/custom/table";
import { Skeleton as DefaultSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const chartBarsHeights = Array.from({ length: 40 }).map(
  () => Math.random() * 30 + 15,
);

export function Skeleton() {
  return (
    <div
      className="flex h-full min-h-screen w-full flex-col sm:flex-row"
      style={
        {
          "--top-bar-height": "0px",
        } as React.CSSProperties
      }
    >
      {/* Left Sidebar - Filters */}
      <div
        className={cn(
          "h-full w-full flex-col sm:sticky sm:top-0 sm:max-h-screen sm:min-h-screen sm:min-w-52 sm:max-w-52 sm:self-start md:min-w-72 md:max-w-72",
          "hidden sm:flex",
        )}
      >
        <div className="border-b border-border bg-background p-2 md:sticky md:top-0">
          <div className="flex h-[46px] items-center justify-between gap-3">
            <p className="px-2 font-medium text-foreground">Filters</p>
          </div>
        </div>
        <div className="flex-1 p-2 sm:overflow-y-scroll">
          {/* Filter Controls Skeleton */}
          <div className="flex flex-col gap-4">
            {/* Time Range */}
            <div className="space-y-2">
              <DefaultSkeleton className="h-4 w-20" />
              <DefaultSkeleton className="h-9 w-full" />
            </div>

            {/* Level Filters */}
            <div className="space-y-2">
              <DefaultSkeleton className="h-4 w-12" />
              <div className="grid gap-2">
                <DefaultSkeleton className="h-7 w-full" />
                <DefaultSkeleton className="h-7 w-full" />
                <DefaultSkeleton className="h-7 w-full" />
              </div>
            </div>

            {/* Other Filters */}
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <DefaultSkeleton className="h-4 w-24" />
                <DefaultSkeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border bg-background p-4 md:sticky md:bottom-0">
          {/* Socials Footer Skeleton */}
          <div className="flex items-center justify-center gap-2">
            <DefaultSkeleton className="h-5 w-5 rounded-full" />
            <DefaultSkeleton className="h-5 w-5 rounded-full" />
            <DefaultSkeleton className="h-5 w-5 rounded-full" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex max-w-full flex-1 flex-col border-border sm:border-l",
        )}
      >
        {/* Top Bar */}
        <div
          className={cn(
            "flex flex-col gap-4 bg-background p-2",
            "sticky top-0 z-10 pb-4",
          )}
        >
          {/* Search Command Palette */}
          <DefaultSkeleton className="h-11 w-full rounded-lg border border-border" />

          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DefaultSkeleton className="h-9 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <DefaultSkeleton className="h-4 w-36" />
              <div className="flex gap-1">
                <DefaultSkeleton className="h-9 w-9" />
                <DefaultSkeleton className="h-9 w-9" />
              </div>
            </div>
          </div>

          {/* Timeline Chart Skeleton */}
          <div className="-mb-2 aspect-auto h-[60px] w-full">
            <div className="relative h-full">
              {/* Chart bars area - positioned at top */}
              <div className="absolute inset-x-0 top-0 flex h-[45px] items-end gap-[1px]">
                {chartBarsHeights.map((height, i) => (
                  <DefaultSkeleton
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              {/* Axis labels area - positioned at bottom */}
              <div className="absolute bottom-0 left-0 right-0 flex h-[15px] items-center justify-between px-1">
                <DefaultSkeleton className="h-3 w-12" />
                <DefaultSkeleton className="h-3 w-12" />
                <DefaultSkeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="z-0">
          <Table
            className="border-separate border-spacing-0"
            containerClassName="max-h-[calc(100vh_-_var(--top-bar-height))]"
          >
            <TableHeader className={cn("sticky top-0 z-20 bg-background")}>
              <TableRow
                className={cn(
                  "bg-muted/50 hover:bg-muted/50",
                  "[&>*]:border-t [&>:not(:last-child)]:border-r",
                )}
              >
                {/* Level */}
                <TableHead className="w-[27px] min-w-[27px] max-w-[27px] border-b border-border">
                  <DefaultSkeleton className="h-4 w-4" />
                </TableHead>
                {/* Date */}
                <TableHead className="w-[200px] min-w-[200px] max-w-[200px] border-b border-border">
                  <DefaultSkeleton className="h-4 w-12" />
                </TableHead>
                {/* Status */}
                <TableHead className="w-[60px] min-w-[60px] max-w-[60px] border-b border-border">
                  <DefaultSkeleton className="h-4 w-12" />
                </TableHead>
                {/* Method */}
                <TableHead className="w-[69px] min-w-[69px] max-w-[69px] border-b border-border">
                  <DefaultSkeleton className="h-4 w-12" />
                </TableHead>
                {/* Host */}
                <TableHead className="w-[125px] min-w-[125px] border-b border-border">
                  <DefaultSkeleton className="h-4 w-12" />
                </TableHead>
                {/* Pathname */}
                <TableHead className="w-[130px] min-w-[130px] border-b border-border">
                  <DefaultSkeleton className="h-4 w-16" />
                </TableHead>
                {/* Latency */}
                <TableHead className="w-[100px] border-b border-border">
                  <DefaultSkeleton className="h-4 w-14" />
                </TableHead>
                {/* Region */}
                <TableHead className="w-[100px] border-b border-border">
                  <DefaultSkeleton className="h-4 w-12" />
                </TableHead>
                {/* Timing Phases */}
                <TableHead className="border-b border-border">
                  <DefaultSkeleton className="h-4 w-24" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 24 }).map((_, i) => (
                <TableRow
                  key={i}
                  className="hover:bg-transparent [&>*]:border-b [&>:not(:last-child)]:border-r"
                >
                  {/* Level */}
                  <TableCell className="w-[27px] min-w-[27px] max-w-[27px]">
                    <DefaultSkeleton className="h-2 w-2 rounded-full" />
                  </TableCell>
                  {/* Date */}
                  <TableCell className="w-[200px] min-w-[200px] max-w-[200px] font-mono">
                    <DefaultSkeleton className="h-4 w-[180px]" />
                  </TableCell>
                  {/* Status */}
                  <TableCell className="w-[60px] min-w-[60px] max-w-[60px] font-mono">
                    <DefaultSkeleton className="h-5 w-8 rounded" />
                  </TableCell>
                  {/* Method */}
                  <TableCell className="w-[69px] min-w-[69px] max-w-[69px] font-mono">
                    <DefaultSkeleton className="h-4 w-10" />
                  </TableCell>
                  {/* Host */}
                  <TableCell className="w-[125px] min-w-[125px] font-mono">
                    <DefaultSkeleton className="h-4 w-[110px]" />
                  </TableCell>
                  {/* Pathname */}
                  <TableCell className="w-[130px] min-w-[130px] font-mono">
                    <DefaultSkeleton className="h-4 w-[100px]" />
                  </TableCell>
                  {/* Latency */}
                  <TableCell className="w-[100px] font-mono">
                    <DefaultSkeleton className="h-4 w-16" />
                  </TableCell>
                  {/* Region */}
                  <TableCell className="w-[100px]">
                    <DefaultSkeleton className="h-4 w-12" />
                  </TableCell>
                  {/* Timing Phases */}
                  <TableCell>
                    <div className="flex h-6 w-full items-center gap-0.5">
                      <DefaultSkeleton className="h-2 flex-1 rounded-sm" />
                      <DefaultSkeleton className="h-2 flex-1 rounded-sm" />
                      <DefaultSkeleton className="h-2 flex-1 rounded-sm" />
                      <DefaultSkeleton className="h-2 flex-1 rounded-sm" />
                      <DefaultSkeleton className="h-2 flex-1 rounded-sm" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {/* Load More Button Row */}
              <TableRow className="hover:bg-transparent data-[state=selected]:bg-transparent">
                <TableCell colSpan={9} className="text-center">
                  <DefaultSkeleton className="mx-auto h-9 w-24" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
