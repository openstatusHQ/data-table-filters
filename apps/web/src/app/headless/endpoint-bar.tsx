"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  runEndpointConformance,
  type ConformanceCheck,
  type ConformanceReport,
} from "@dtf/registry/lib/data-table";
import type { TableManifest } from "@dtf/registry/lib/table-schema";
import { Check, ChevronDown, LoaderCircle, Minus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { EXAMPLES, headlessHref, parseManifestInput } from "./endpoint";

export type EndpointInspection = {
  manifest: TableManifest;
  /** Where rows are fetched from. */
  dataEndpoint: string;
  /** Reads a list response the way the table does. */
  parse: (response: Response) => Promise<unknown>;
};

/**
 * The one control this page adds to the table: which endpoint to render.
 *
 * Submitting navigates rather than setting state. The table's filters live in
 * the URL keyed by column, so a new endpoint has to start from a URL that
 * carries none of the previous one's.
 */
export function EndpointBar({
  input,
  externalHost,
  listError,
  inspection,
  className,
}: {
  /** The manifest URL as it was asked for. */
  input: string;
  externalHost?: string | null;
  /** The last failure of the rows request, if it is failing. */
  listError?: string | null;
  inspection?: EndpointInspection;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(input);
  const [problem, setProblem] = React.useState<string | null>(null);
  const hintId = React.useId();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const target = parseManifestInput(value);
    if (!target.ok) {
      setProblem(target.reason);
      return;
    }
    setProblem(null);
    router.push(headlessHref(target.url));
  };

  const note =
    problem ??
    listError ??
    (externalHost
      ? `Schema and rows are served by ${externalHost}, not by this site.`
      : null);
  const isError = Boolean(problem ?? listError);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <InputGroup className="min-w-0 flex-1 shadow-none">
          <InputGroupAddon>
            <InputGroupText className="font-mono text-xs">GET</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setProblem(null);
            }}
            aria-label="Manifest URL"
            aria-invalid={problem ? true : undefined}
            aria-describedby={note ? hintId : undefined}
            placeholder="https://api.example.com/logs/schema"
            className="font-mono text-sm"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
          />
        </InputGroup>
        <Button type="submit" variant="outline" className="shadow-none">
          Load
        </Button>
        <ExamplesMenu />
        {inspection ? <EndpointInspector {...inspection} /> : null}
      </form>
      {note ? (
        <p
          id={hintId}
          role={isError ? "alert" : undefined}
          className={cn(
            "px-1 text-xs",
            isError ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

function ExamplesMenu() {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="shadow-none">
          <span className="hidden sm:inline">Examples</span>
          <ChevronDown className="size-4" />
          <span className="sr-only sm:hidden">Examples</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Endpoints on this site</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {EXAMPLES.map((example) => (
          <DropdownMenuItem
            key={example.manifest}
            onSelect={() => router.push(headlessHref(example.manifest))}
            className="flex-col items-start gap-0.5"
          >
            <span className="font-medium">{example.label}</span>
            <span className="text-muted-foreground text-xs">
              {example.description}
            </span>
            <span className="text-muted-foreground font-mono text-[11px]">
              {example.manifest}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const CAPABILITIES: {
  key: keyof TableManifest["capabilities"];
  label: string;
  off: string;
}[] = [
  { key: "facets", label: "Facets", off: "faceted from the loaded rows" },
  { key: "totalRowCount", label: "Total row count", off: "left blank" },
  { key: "filterRowCount", label: "Filtered row count", off: "left blank" },
  { key: "chart", label: "Chart", off: "not rendered" },
  { key: "backwardPagination", label: "Live mode", off: "no live button" },
  { key: "actions", label: "Actions", off: "none" },
];

function EndpointInspector({
  manifest,
  dataEndpoint,
  parse,
}: EndpointInspection) {
  const [report, setReport] = React.useState<ConformanceReport | null>(null);
  const [running, setRunning] = React.useState(false);

  const run = async () => {
    setRunning(true);
    try {
      setReport(
        await runEndpointConformance({ url: dataEndpoint, manifest, parse }),
      );
    } finally {
      setRunning(false);
    }
  };

  const columns = manifest.schema.columns;
  const filterable = columns.filter((column) => column.filter).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="shadow-none">
          Inspect
          {report ? (
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                report.ok ? "bg-green-500" : "bg-destructive",
              )}
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[min(70vh,36rem)] w-[min(26rem,calc(100vw-2rem))] flex-col gap-4 overflow-y-auto text-sm"
      >
        <section className="flex flex-col gap-1.5">
          <h3 className="font-medium">What the endpoint declares</h3>
          <p className="text-muted-foreground text-xs">
            {columns.length} columns, {filterable} filterable. Rows are
            identified by{" "}
            <code className="text-foreground font-mono">
              {manifest.primaryKey}
            </code>{" "}
            and fetched from{" "}
            <code className="text-foreground font-mono break-all">
              {dataEndpoint}
            </code>
            .
          </p>
          <ul className="flex flex-col gap-1">
            {CAPABILITIES.map(({ key, label, off }) => {
              const on = Boolean(manifest.capabilities[key]);
              return (
                <li key={key} className="flex items-center gap-2">
                  {on ? (
                    <Check className="size-3.5 shrink-0 text-green-600 dark:text-green-500" />
                  ) : (
                    <Minus className="text-muted-foreground size-3.5 shrink-0" />
                  )}
                  <span className={on ? undefined : "text-muted-foreground"}>
                    {label}
                  </span>
                  {on ? null : (
                    <span className="text-muted-foreground ml-auto text-xs">
                      {off}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">Does it do what it declares?</h3>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={run}
              disabled={running}
            >
              {running ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : null}
              {report ? "Run again" : "Run checks"}
            </Button>
          </div>
          {report ? (
            <>
              <ul className="flex flex-col gap-1.5">
                {report.checks.map((check) => (
                  <CheckRow key={check.id} check={check} />
                ))}
              </ul>
              <p className="text-muted-foreground text-xs" role="status">
                {report.passed} passed, {report.failed} failed, {report.skipped}{" "}
                skipped
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">
              Sends a handful of small requests to the list endpoint and checks
              the answers against the contract: the response shape, page size,
              row identity, facets and paging.
            </p>
          )}
        </section>
      </PopoverContent>
    </Popover>
  );
}

function CheckRow({ check }: { check: ConformanceCheck }) {
  const Icon = { pass: Check, fail: X, skip: Minus }[check.status];
  return (
    <li className="flex items-start gap-2">
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          check.status === "pass" && "text-green-600 dark:text-green-500",
          check.status === "fail" && "text-destructive",
          check.status === "skip" && "text-muted-foreground",
        )}
      />
      <div className="min-w-0">
        <p>
          <span className="sr-only">{check.status}: </span>
          {check.description}
        </p>
        {check.detail ? (
          <p className="text-muted-foreground text-xs break-words">
            {check.detail}
          </p>
        ) : null}
      </div>
    </li>
  );
}
