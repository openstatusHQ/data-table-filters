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
import { Loader2, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "../utils";
import type { SectionMeta } from "./get-content";

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
              {!loading && debouncedSearch && results.length === 0 ? (
                <CommandEmpty>No results found.</CommandEmpty>
              ) : null}
              {showAllDocs ? (
                <CommandGroup heading="Documentation">
                  {sections.map((section) => (
                    <CommandItem
                      key={section.slug}
                      value={section.title}
                      onSelect={() => {
                        router.push(`/docs/${section.slug}`);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      {section.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : results.length > 0 ? (
                <CommandGroup heading="Results">
                  {results.map((item) => (
                    <CommandItem
                      key={item.slug}
                      value={item.title}
                      onSelect={() => {
                        router.push(item.href);
                        setOpen(false);
                        setSearch("");
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
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Splits `text` on `search` matches and wraps them in <mark> — no innerHTML needed. */
function HighlightMatch({ text, search }: { text: string; search: string }) {
  if (!search) return <>{text}</>;
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i}>{part}</mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
