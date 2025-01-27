"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { LoaderCircle, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { Kbd } from "@/components/custom/kbd";
import type { Table } from "@tanstack/react-table";
import type { z } from "zod";
import type { DataTableFilterField } from "../types";
import { deserialize, serializeColumFilters } from "../utils";
import { Separator } from "@/components/ui/separator";
import {
  getFieldOptions,
  getFilterValue,
  getWordByCaretPosition,
  replaceInputByFieldType,
} from "./utils";
import { formatDistanceToNow } from "date-fns";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useHotKey } from "@/hooks/use-hot-key";
import { useDataTable } from "@/providers/data-table";

// FIXME: there is an issue on cmdk if I wanna only set a single slider value...

interface DataTableFilterCommandProps<TSchema extends z.AnyZodObject> {
  schema: TSchema;
}

export function DataTableFilterCommand<TSchema extends z.AnyZodObject>({
  schema,
}: DataTableFilterCommandProps<TSchema>) {
  const { table, isLoading, filterFields: _filterFields } = useDataTable();
  const columnFilters = table.getState().columnFilters;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [currentWord, setCurrentWord] = useState<string>("");
  const filterFields = useMemo(
    () => _filterFields?.filter((i) => !i.commandDisabled),
    [_filterFields]
  );
  const [inputValue, setInputValue] = useState<string>(
    serializeColumFilters(columnFilters, filterFields)
  );
  const [lastSearches, setLastSearches] = useLocalStorage<
    {
      search: string;
      timestamp: number;
    }[]
  >("data-table-command", []);

  useEffect(() => {
    // TODO: we could check for ARRAY_DELIMITER or SLIDER_DELIMITER to auto-set filter when typing
    if (currentWord !== "" && open) return;
    // reset
    if (currentWord !== "" && !open) setCurrentWord("");
    // avoid recursion
    if (inputValue.trim() === "" && !open) return;

    // FIXME: that stuff is BAD!
    const searchParams = deserialize(schema)(inputValue);
    const currentFilters = table.getState().columnFilters;
    const currentEnabledFilters = currentFilters.filter((filter) => {
      const field = _filterFields?.find((field) => field.value === filter.id);
      return !field?.commandDisabled;
    });
    const currentDisabledFilters = currentFilters.filter((filter) => {
      const field = _filterFields?.find((field) => field.value === filter.id);
      return field?.commandDisabled;
    });

    const commandDisabledFilterKeys = currentDisabledFilters.reduce(
      (prev, curr) => {
        prev[curr.id] = curr.value;
        return prev;
      },
      {} as Record<string, unknown>
    );

    if (searchParams.success) {
      for (const key of Object.keys(searchParams.data)) {
        const value = searchParams.data[key as keyof typeof searchParams.data];
        table.getColumn(key)?.setFilterValue(value);
      }
      const currentFiltersToReset = currentEnabledFilters.filter((filter) => {
        return !(filter.id in searchParams.data);
      });
      for (const filter of currentFiltersToReset) {
        table.getColumn(filter.id)?.setFilterValue(undefined);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, open, currentWord]);

  useEffect(() => {
    // REMINDER: only update the input value if the command is closed (avoids jumps while open)
    if (!open) {
      setInputValue(serializeColumFilters(columnFilters, filterFields));
    }
  }, [columnFilters, filterFields, open]);

  useHotKey(() => setOpen((open) => !open), "k");

  useEffect(() => {
    if (open) {
      inputRef?.current?.focus();
    }
  }, [open]);

  return (
    <div>
      <button
        type="button"
        className={cn(
          "group flex w-full items-center rounded-lg border border-input bg-background px-3 text-muted-foreground ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:bg-accent/50 hover:text-accent-foreground",
          open ? "hidden" : "visible"
        )}
        onClick={() => setOpen(true)}
      >
        {isLoading ? (
          <LoaderCircle className="mr-2 h-4 w-4 shrink-0 text-muted-foreground opacity-50 group-hover:text-popover-foreground animate-spin" />
        ) : (
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground opacity-50 group-hover:text-popover-foreground" />
        )}
        <span className="h-11 w-full max-w-sm truncate py-3 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50 md:max-w-xl lg:max-w-4xl xl:max-w-5xl">
          {inputValue.trim() ? (
            <span className="text-foreground">{inputValue}</span>
          ) : (
            <span>Search data table...</span>
          )}
        </span>
        <Kbd className="ml-auto text-muted-foreground group-hover:text-accent-foreground">
          <span className="mr-1">⌘</span>
          <span>K</span>
        </Kbd>
      </button>
      <Command
        className={cn(
          "overflow-visible rounded-lg border border-border shadow-md [&>div]:border-none dark:bg-muted/50",
          open ? "visible" : "hidden"
        )}
        filter={(value, search, keywords) =>
          getFilterValue({ value, search, keywords, currentWord })
        }
        // loop
      >
        <CommandInput
          ref={inputRef}
          value={inputValue}
          onValueChange={setInputValue}
          onKeyDown={(e) => {
            if (e.key === "Escape") inputRef?.current?.blur();
          }}
          onBlur={() => {
            setOpen(false);
            // FIXME: doesnt reflect the jumps
            // FIXME: will save non-existing searches
            // TODO: extract into function
            const search = inputValue.trim();
            if (!search) return;
            const timestamp = Date.now();
            const searchIndex = lastSearches.findIndex(
              (item) => item.search === search
            );
            if (searchIndex !== -1) {
              lastSearches[searchIndex].timestamp = timestamp;
              setLastSearches(lastSearches);
              return;
            }
            setLastSearches([...lastSearches, { search, timestamp }]);
            return;
          }}
          onInput={(e) => {
            const caretPosition = e.currentTarget?.selectionStart || -1;
            const value = e.currentTarget?.value || "";
            const word = getWordByCaretPosition({ value, caretPosition });
            setCurrentWord(word);
          }}
          placeholder="Search data table..."
          className="text-foreground"
        />
        <div className="relative">
          <div className="absolute top-2 z-10 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md outline-none animate-in">
            {/* default height is 300px but in case of more, we'd like to tease the user */}
            <CommandList className="max-h-[310px]">
              <CommandGroup heading="Filter">
                {filterFields?.map((field) => {
                  if (typeof field.value !== "string") return null;
                  if (inputValue.includes(`${field.value}:`)) return null;
                  return (
                    <CommandItem
                      key={field.value}
                      value={field.value}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={(value) => {
                        setInputValue((prev) => {
                          if (currentWord.trim() === "") {
                            const input = `${prev}${value}`;
                            return `${input}:`;
                          }
                          // lots of cheat
                          const isStarting = currentWord === prev;
                          const prefix = isStarting ? "" : " ";
                          const input = prev.replace(
                            `${prefix}${currentWord}`,
                            `${prefix}${value}`
                          );
                          return `${input}:`;
                        });
                        setCurrentWord(`${value}:`);
                      }}
                      className="group"
                    >
                      {field.value}
                      <CommandItemSuggestions field={field} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Query">
                {filterFields?.map((field) => {
                  if (typeof field.value !== "string") return null;
                  if (!currentWord.includes(`${field.value}:`)) return null;

                  const column = table.getColumn(field.value);
                  const facetedValue = column?.getFacetedUniqueValues();

                  const options = getFieldOptions({ field });

                  return options.map((optionValue) => {
                    return (
                      <CommandItem
                        key={`${String(field.value)}:${optionValue}`}
                        value={`${String(field.value)}:${optionValue}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onSelect={(value) => {
                          setInputValue((prev) =>
                            replaceInputByFieldType({
                              prev,
                              currentWord,
                              optionValue,
                              value,
                              field,
                            })
                          );
                          setCurrentWord("");
                        }}
                      >
                        {`${optionValue}`}
                        {facetedValue?.has(optionValue) ? (
                          <span className="ml-auto font-mono text-muted-foreground">
                            {facetedValue?.get(optionValue)}
                          </span>
                        ) : null}
                      </CommandItem>
                    );
                  });
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Suggestions">
                {lastSearches
                  ?.sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 5)
                  .map((item) => {
                    return (
                      <CommandItem
                        key={`suggestion:${item.search}`}
                        value={`suggestion:${item.search}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onSelect={(value) => {
                          const search = value.replace("suggestion:", "");
                          setInputValue(`${search} `);
                          setCurrentWord("");
                        }}
                        className="group"
                      >
                        {item.search}
                        <span className="ml-auto truncate text-muted-foreground/80 group-aria-[selected=true]:block">
                          {formatDistanceToNow(item.timestamp, {
                            addSuffix: true,
                          })}
                        </span>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // TODO: extract into function
                            setLastSearches(
                              lastSearches.filter(
                                (i) => i.search !== item.search
                              )
                            );
                          }}
                          className="ml-1 hidden rounded-md p-0.5 hover:bg-background group-aria-[selected=true]:block"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
              <CommandEmpty>No results found.</CommandEmpty>
            </CommandList>
            <div
              className="flex flex-wrap justify-between gap-3 border-t bg-accent/50 px-2 py-1.5 text-sm text-accent-foreground"
              cmdk-footer=""
            >
              <div className="flex flex-wrap gap-3">
                <span>
                  Use <Kbd variant="outline">↑</Kbd>{" "}
                  <Kbd variant="outline">↓</Kbd> to navigate
                </span>
                <span>
                  <Kbd variant="outline">Enter</Kbd> to query
                </span>
                <span>
                  <Kbd variant="outline">Esc</Kbd> to close
                </span>
                <Separator orientation="vertical" className="my-auto h-3" />
                <span>
                  Union: <Kbd variant="outline">regions:a,b</Kbd>
                </span>
                <span>
                  Range: <Kbd variant="outline">p95:59-340</Kbd>
                </span>
              </div>
              {lastSearches.length ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-accent-foreground"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => setLastSearches([])}
                >
                  Clear suggestions
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </Command>
    </div>
  );
}

// function CommandItemType<TData>

function CommandItemSuggestions<TData>({
  field,
}: {
  field: DataTableFilterField<TData>;
}) {
  switch (field.type) {
    case "checkbox": {
      return (
        <span className="ml-1 hidden truncate text-muted-foreground/80 group-aria-[selected=true]:block">
          {field.options?.map(({ value }) => `[${value}]`).join(" ")}
        </span>
      );
    }
    case "slider": {
      return (
        <span className="ml-1 hidden truncate text-muted-foreground/80 group-aria-[selected=true]:block">
          [{field.min} - {field.max}]
        </span>
      );
    }
    case "input": {
      return (
        <span className="ml-1 hidden truncate text-muted-foreground/80 group-aria-[selected=true]:block">
          [{`${String(field.value)}`} input]
        </span>
      );
    }
    default: {
      return null;
    }
  }
}
