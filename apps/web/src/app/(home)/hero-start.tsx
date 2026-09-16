"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AGENT_START_PROMPT, CREATE_PROJECT_COMMAND } from "@/lib/llms/blocks";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@dtf/registry/hooks/use-copy-to-clipboard";
import { Check, Copy, Sparkles } from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

type Mode = "terminal" | "agent" | "describe";

const MODES: {
  id: Mode;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  hint: React.ReactNode;
}[] = [
  {
    id: "terminal",
    label: "Terminal",
    hint: (
      <>
        One command: the app, the blocks, a working table at{" "}
        <code className="text-foreground font-mono text-xs">/example</code>.
      </>
    ),
  },
  {
    id: "agent",
    label: "Agent",
    hint: "Paste into Claude Code, Cursor, or any agent that runs commands.",
  },
  {
    id: "describe",
    label: "Describe",
    // The one mode that goes through an AI: say so with the sparkle.
    icon: Sparkles,
    hint: "Describe the table you need and get a schema to install.",
  },
];

const SNIPPETS: Record<
  Exclude<Mode, "describe">,
  { prefix: string; value: string }
> = {
  terminal: { prefix: "$", value: CREATE_PROJECT_COMMAND },
  agent: { prefix: ">", value: AGENT_START_PROMPT },
};

/**
 * Three ways to start, one row. Terminal and Agent are the same constants the
 * Quick Start, llms.txt and the page's HowTo carry; Describe is the builder.
 */
export function HeroStart({ className }: { className?: string }) {
  const [mode, setMode] = React.useState<Mode>("terminal");
  const active = MODES.find((entry) => entry.id === mode) ?? MODES[0];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        role="tablist"
        aria-label="How to start"
        className="flex items-center gap-1"
      >
        {MODES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === mode}
            onClick={() => setMode(entry.id)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs transition-colors",
              entry.id === mode
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
            {entry.icon ? (
              <entry.icon className="size-3" aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </div>
      {mode === "describe" ? (
        <DescribeForm />
      ) : (
        <CopyRow key={mode} {...SNIPPETS[mode]} label={active.label} />
      )}
      <p className="text-muted-foreground text-sm">
        {active.hint}{" "}
        <NextLink
          href="/docs/quick-start"
          className="text-foreground whitespace-nowrap underline underline-offset-4"
        >
          Quick Start
        </NextLink>
      </p>
    </div>
  );
}

function CopyRow({
  prefix,
  value,
  label,
}: {
  prefix: string;
  value: string;
  label: string;
}) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <div className="flex gap-2">
      <div
        className="border-input bg-background text-foreground flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border px-3 font-mono text-sm"
        title={value}
      >
        <span className="text-muted-foreground select-none">{prefix}</span>
        <span className="truncate">{value}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        className="shrink-0 gap-1.5 font-mono shadow-none"
        onClick={() => copy(value)}
        aria-label={isCopied ? "Copied" : `Copy ${label.toLowerCase()}`}
      >
        {isCopied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {isCopied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function DescribeForm() {
  const [description, setDescription] = React.useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) return;
    const params = new URLSearchParams({ prompt: trimmed });
    router.push(`/builder?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe a table... e.g. API logs with status, latency, region"
        className="flex-1 shadow-none"
        maxLength={500}
        autoFocus
      />
      <Button
        type="submit"
        disabled={!description.trim()}
        className="shadow-none"
      >
        Generate Table
      </Button>
    </form>
  );
}
