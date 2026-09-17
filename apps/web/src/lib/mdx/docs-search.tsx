"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useDebounce } from "@dtf/registry/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { Command as CommandPrimitive } from "cmdk";
import { BookOpen, Loader2, SearchIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "../utils";
import {
  filterPaletteGroups,
  PALETTE_GROUPS,
  type PaletteAction,
  type PaletteGroup,
} from "./docs-search-actions";
import type { SectionMeta } from "./get-content";
import { tokenize } from "./search";

type SearchResult = {
  title: string;
  slug: string;
  href: string;
  content: string;
};

export function DocsSearch({ sections }: { sections: SectionMeta[] }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const router = useRouter();
  const { setTheme } = useTheme();

  const {
    data: results = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["docs-search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const res = await fetch(
        `/docs/api/search?q=${encodeURIComponent(debouncedSearch)}`,
      );
      return res.json() as Promise<SearchResult[]>;
    },
    placeholderData: (prev) => prev,
  });

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => {
          if (o) setSearch("");
          return !o;
        });
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const loading = isLoading || isFetching;
  const showAllDocs = !debouncedSearch;

  // The static rows filter on the live query, not the debounced one: they
  // are local, so there is no reason to make them wait for the network.
  // Pages sit above the docs, the rest below them.
  const matched = filterPaletteGroups(PALETTE_GROUPS, search);
  const groups = {
    before: matched.filter((group) => group.heading === "Pages"),
    after: matched.filter((group) => group.heading !== "Pages"),
  };
  const hasActions = matched.length > 0;

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  const run = (action: PaletteAction) => {
    close();
    if (action.theme) {
      setTheme(action.theme);
    } else if (action.external) {
      window.open(action.href, "_blank", "noopener,noreferrer");
    } else {
      router.push(action.href);
    }
  };

  const renderGroup = (group: PaletteGroup) => (
    <CommandGroup key={group.heading} heading={group.heading}>
      {group.actions.map((action) => (
        <CommandItem
          key={action.label}
          value={`${group.heading}:${action.label}`}
          onSelect={() => run(action)}
        >
          <action.icon className="size-4 shrink-0" aria-hidden="true" />
          {/* one child, or the item's flex gap splits the word at the mark */}
          <span className="truncate">
            <HighlightMatch text={action.label} search={search} />
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          "text-muted-foreground w-full border-dashed shadow-none",
          open && "bg-accent text-accent-foreground dark:bg-input/30",
        )}
      >
        <SearchIcon className="size-3.5" />
        <span className="flex-1 text-left">Search...</span>
        <Kbd>
          <span>⌘</span>
          <span>K</span>
        </Kbd>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setSearch("");
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search Docs</DialogTitle>
          <DialogDescription>Search through documentation...</DialogDescription>
        </DialogHeader>
        <DialogContent className="top-[15%] translate-y-0 overflow-hidden p-0">
          <Command shouldFilter={false}>
            <div className="flex items-center gap-2 border-b px-3">
              {loading && debouncedSearch ? (
                <Loader2 className="size-4 shrink-0 animate-spin opacity-50" />
              ) : (
                <SearchIcon className="size-4 shrink-0 opacity-50" />
              )}
              <CommandPrimitive.Input
                className="placeholder:text-muted-foreground flex h-11 w-full bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Type to search..."
                value={search}
                onValueChange={setSearch}
              />
            </div>
            <CommandList>
              {!loading &&
              debouncedSearch &&
              results.length === 0 &&
              !hasActions ? (
                <CommandEmpty>No results found.</CommandEmpty>
              ) : null}
              {groups.before.map(renderGroup)}
              {showAllDocs ? (
                <CommandGroup heading="Documentation">
                  {sections.map((section) => (
                    <CommandItem
                      key={section.slug}
                      value={`Documentation:${section.title}`}
                      onSelect={() => {
                        close();
                        router.push(`/docs/${section.slug}`);
                      }}
                    >
                      <BookOpen
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                      {section.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : results.length > 0 ? (
                <CommandGroup heading="Documentation">
                  {results.map((item) => (
                    <CommandItem
                      key={item.slug}
                      value={`Results:${item.title}`}
                      onSelect={() => {
                        close();
                        router.push(item.href);
                      }}
                    >
                      <div className="grid min-w-0">
                        <span className="block truncate">
                          <HighlightMatch text={item.title} search={search} />
                        </span>
                        {item.content && search ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            <HighlightMatch
                              text={item.content}
                              search={search}
                            />
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {groups.after.map(renderGroup)}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Splits `text` on the search terms and wraps them in <mark> — no innerHTML
 * needed. Marks the terms the search ranked on rather than the raw query, so a
 * multi-word question highlights the words that actually matched.
 */
function HighlightMatch({ text, search }: { text: string; search: string }) {
  const terms = tokenize(search);
  if (terms.length === 0) return <>{text}</>;

  const escaped = terms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const lowered = new Set(terms);
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        lowered.has(part.toLowerCase()) ? <mark key={i}>{part}</mark> : part,
      )}
    </>
  );
}
