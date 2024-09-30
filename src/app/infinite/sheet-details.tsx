"use client";
import { ColumnSchema } from "./schema";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FunctionSquare,
  Info,
  X,
} from "lucide-react";
import * as React from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/custom/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import CopyToClipboardContainer from "@/components/custom/copy-to-clipboard-container";
import { cn } from "@/lib/utils";
import {
  getTimingColor,
  getTimingLabel,
  getTimingPercentage,
  timingPhases,
} from "@/constants/timing";
import { formatDate, formatMilliseconds } from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/constants/status-code";
import type { Table } from "@tanstack/react-table";
import { regions } from "@/constants/region";
import { Skeleton } from "@/components/ui/skeleton";
import { Kbd } from "@/components/custom/kbd";

export interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function SheetDetails<TData>({ table }: DataTableToolbarProps<TData>) {
  // FIXME: this is `ColumnSchema` and not `TData` specific - we need to find a way to make it generic
  // and be able to pass a `renderComponent` prop to render the details
  const [selected, setSelected] = React.useState<ColumnSchema | undefined>();

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedRowKey =
    Object.keys(table.getState().rowSelection)?.[0] || undefined;

  const index = table
    .getCoreRowModel()
    .flatRows.findIndex((row) => row.id === selectedRowKey);

  const nextId = React.useMemo(
    () => table.getCoreRowModel().flatRows[index + 1]?.id,
    [index, table]
  );

  const prevId = React.useMemo(
    () => table.getCoreRowModel().flatRows[index - 1]?.id,
    [index, table]
  );

  const onPrev = React.useCallback(() => {
    if (prevId) table.setRowSelection({ [prevId]: true });
  }, [prevId, table]);

  const onNext = React.useCallback(() => {
    if (nextId) table.setRowSelection({ [nextId]: true });
  }, [nextId, table]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!selected) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        onPrev();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onNext();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [selected, onNext, onPrev]);

  React.useEffect(() => {
    setSelected(
      selectedRows.map((row) => row.original)?.[0] as unknown as
        | ColumnSchema
        | undefined
    );
  }, [selectedRows]);

  return (
    <Sheet
      open={!!selected}
      onOpenChange={() => table.toggleAllRowsSelected(false)}
    >
      <SheetContent className="sm:max-w-md overflow-y-auto p-0" hideClose>
        <SheetHeader className="sticky top-0 border-b bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-left font-mono truncate">
              {selected?.pathname}
            </SheetTitle>
            <div className="flex items-center gap-1 h-7">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={!prevId}
                      onClick={onPrev}
                    >
                      <ChevronUp className="h-5 w-5" />
                      <span className="sr-only">Previous</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Navigate <Kbd variant="outline">↑</Kbd>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={!nextId}
                      onClick={onNext}
                    >
                      <ChevronDown className="h-5 w-5" />
                      <span className="sr-only">Next</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Navigate <Kbd variant="outline">↓</Kbd>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Separator orientation="vertical" className="mx-1" />
              <SheetClose autoFocus={true} asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>
        <SheetDetailsContent data={selected} className="p-4" />
      </SheetContent>
    </Sheet>
  );
}

interface SheetDetailsContentProps
  extends React.HTMLAttributes<HTMLDListElement> {
  data?: ColumnSchema;
}

export function SheetDetailsContent({
  data,
  className,
  ...props
}: SheetDetailsContentProps) {
  if (!data) return <SheetDetailsContentSkeleton />;

  const statusColor = getStatusColor(data.status);
  const timingPercentage = getTimingPercentage(data, data.latency);

  return (
    <dl className={cn(className)} {...props}>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">ID</dt>
        <dd className="font-mono truncate">{data.uuid}</dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Success</dt>
        <dd>
          {data.success ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <X className="h-4 w-4 text-red-500" />
          )}
        </dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Date</dt>
        <dd className="font-mono text-right">{formatDate(data.date)}</dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Status Code</dt>
        <dd>
          <Badge
            variant="outline"
            className={`${statusColor.bg} ${statusColor.border} ${statusColor.text} font-mono`}
          >
            {data.status}
          </Badge>
        </dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Host</dt>
        <dd className="font-mono truncate">{data.host}</dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Pathname</dt>
        <dd className="font-mono truncate">{data.pathname}</dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Region</dt>
        <dd className="font-mono text-right">
          <span className="text-muted-foreground text-xs">
            {regions[data.regions[0]]}
          </span>{" "}
          {data.regions[0]}
        </dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Latency</dt>
        <dd className="font-mono">
          {formatMilliseconds(data.latency)}
          <span className="text-muted-foreground">ms</span>
        </dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="flex items-center gap-1 text-muted-foreground">
          Percentile
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Calculated from current filters</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </dt>
        <dd className="font-mono flex items-center gap-1">
          <FunctionSquare className="h-4 w-4 text-muted-foreground" />
          {!data.percentile ? "N/A" : Math.round(data.percentile)}
        </dd>
      </div>
      <div className="flex flex-col gap-2 py-2 border-b text-sm text-left">
        <dt className="text-muted-foreground">Timing Phases</dt>
        {timingPhases.map((phase) => (
          <div
            key={phase}
            className="grid grid-cols-3 gap-2 text-xs justify-between items-center"
          >
            <div className="text-muted-foreground uppercase truncate">
              {getTimingLabel(phase)}
            </div>
            <div className="flex gap-2 col-span-2">
              <div className="font-mono text-muted-foreground mr-8">
                {timingPercentage[phase]}
              </div>
              <div className="flex flex-1 gap-2 items-center justify-end">
                <div className="font-mono">
                  {formatMilliseconds(data[phase])}
                  <span className="text-muted-foreground">ms</span>
                </div>
              </div>
              <div
                className={cn(getTimingColor(phase), "h-4")}
                style={{ width: `${(data[phase] / data.latency) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {data.message ? (
        <div className="flex flex-col gap-2 py-2 border-b text-sm text-left">
          <dt className="text-muted-foreground">Message</dt>
          <CopyToClipboardContainer className="rounded-md bg-destructive/30 border border-destructive/50 p-2 whitespace-pre-wrap break-all font-mono">
            {JSON.stringify(data.message, null, 2)}
          </CopyToClipboardContainer>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 py-2 text-sm text-left">
        <dt className="text-muted-foreground">Headers</dt>
        <CopyToClipboardContainer className="rounded-md bg-muted/50 border p-2 whitespace-pre-wrap break-all font-mono">
          {JSON.stringify(data.headers, null, 2)}
        </CopyToClipboardContainer>
      </div>
    </dl>
  );
}

const skeleton = {
  ID: "h-5 w-52",
  Success: "h-5 w-5",
  Date: "h-5 w-36",
  "Status Code": "h-5 w-12",
  Host: "h-5 w-24",
  Pathname: "h-5 w-56",
  Region: "h-5 w-12",
  Latency: "h-5 w-16",
  Percentile: "h-5 w-12",
  "Timing Phases": "h-5 w-52",
  Message: "h-5 w-52",
};

export function SheetDetailsContentSkeleton() {
  return (
    <dl>
      {Object.entries(skeleton).map(([key, size]) => (
        <div
          key={key}
          className="flex gap-4 py-2 border-b text-sm justify-between items-center"
        >
          <dt className="text-muted-foreground">{key}</dt>
          <dd>
            <Skeleton className={size} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
