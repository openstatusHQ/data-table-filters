"use client";

import { useDataTable } from "@/components/data-table/data-table-provider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { useHotKey } from "@/hooks/use-hot-key";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCommandHistoryKey } from "@/lib/constants/local-storage";
import { formatCompactNumber } from "@/lib/format";
import type { SchemaDefinition } from "@/lib/store/schema/types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { LoaderCircle, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DataTableFilterField } from "../types";
import {
  columnFiltersParserFromSchema,
  getFieldOptions,
  getFilterValue,
  getWordByCaretPosition,
  replaceInputByFieldType,
} from "./utils";

interface DataTableFilterCommandProps {
  // Schema definition for parsing/serializing filter values (BYOS)
  schema: SchemaDefinition;
  // Unique ID for this table (used to namespace localStorage)
  tableId?: string;
}

export function DataTableFilterCommand({
  schema,
  tableId = "default",
}: DataTableFilterCommandProps) {
  const {
    table,
    isLoading,
    filterFields: _filterFields,
    getFacetedUniqueValues,
  } = useDataTable();
  const columnFilters = table.getState().columnFilters;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [currentWord, setCurrentWord] = useState<string>("");
  // Guard to prevent effect cycle when serializing
  const isSerializingRef = useRef(false);
  const filterFields = useMemo(
    () => _filterFields?.filter((i) => !i.commandDisabled),
    [_filterFields],
  );
  const columnParser = useMemo(
    () => columnFiltersParserFromSchema({ schema, filterFields }),
    [schema, filterFields],
  );
  const [inputValue, setInputValue] = useState<string>(
    columnParser.serialize(columnFilters),
  );
  const [lastSearches, setLastSearches] = useLocalStorage<
    {
      search: string;
      timestamp: number;
    }[]
  >(getCommandHistoryKey(tableId), []);

  useEffect(() => {
    // Skip if this update came from serialization (prevents infinite loop)
    if (isSerializingRef.current) {
      isSerializingRef.current = false;
      return;
    }
    // TODO: we could check for ARRAY_DELIMITER or SLIDER_DELIMITER to auto-set filter when typing
    if (currentWord !== "" && open) return;
    // reset
    if (currentWord !== "" && !open) setCurrentWord("");
    // avoid recursion
    if (inputValue.trim() === "" && !open) return;

    const searchParams = columnParser.parse(inputValue);

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
      {} as Record<string, unknown>,
    );

    for (const key of Object.keys(searchParams)) {
      const value = searchParams[key as keyof typeof searchParams];
      table.getColumn(key)?.setFilterValue(value);
    }
    const currentFiltersToReset = currentEnabledFilters.filter((filter) => {
      return !(filter.id in searchParams);
    });
    for (const filter of currentFiltersToReset) {
      table.getColumn(filter.id)?.setFilterValue(undefined);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, open, currentWord]);

  useEffect(() => {
    // REMINDER: only update the input value if the command is closed (avoids jumps while open)
    if (!open) {
      // Set flag to prevent the parse effect from running after serialization
      isSerializingRef.current = true;
      setInputValue(columnParser.serialize(columnFilters));
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
          "group border-input bg-background text-muted-foreground ring-offset-background focus-within:ring-ring hover:bg-accent/50 hover:text-accent-foreground flex w-full items-center rounded-lg border px-3 focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-hidden",
          open ? "hidden" : "visible",
        )}
        onClick={() => setOpen(true)}
      >
        {isLoading ? (
          <LoaderCircle className="text-muted-foreground group-hover:text-popover-foreground mr-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
        ) : (
          <Search className="text-muted-foreground group-hover:text-popover-foreground mr-2 h-4 w-4 shrink-0 opacity-50" />
        )}
        <span className="h-11 w-full max-w-sm truncate py-3 text-left text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:max-w-xl lg:max-w-4xl xl:max-w-5xl">
          {inputValue.trim() ? (
            <span className="text-foreground">{inputValue}</span>
          ) : (
            <span>Search data table...</span>
          )}
        </span>
        <Kbd className="text-muted-foreground group-hover:text-accent-foreground ml-auto">
          <span className="mr-1">⌘</span>
          <span>K</span>
        </Kbd>
      </button>
      <Command
        className={cn(
          "border-border dark:bg-muted/50 overflow-visible rounded-lg border shadow-md [&>div]:border-none",
          open ? "visible" : "hidden",
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
              (item) => item.search === search,
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
          <div className="border-border bg-popover text-popover-foreground animate-in absolute top-2 z-10 w-full overflow-hidden rounded-lg border shadow-md outline-hidden">
            {/* default height is 300px but in case of more, we'd like to tease the user */}
            <CommandList className="max-h-[310px]">
              <CommandGroup heading="Filter">
                {filterFields.map((field) => {
                  if (typeof field.value !== "string") return null;
                  if (inputValue.includes(`${field.value}:`)) return null;
                  // TBD: should we handle this in the component?
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
                            `${prefix}${value}`,
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
                  const facetedValue =
                    getFacetedUniqueValues?.(table, field.value) ||
                    column?.getFacetedUniqueValues();

                  const options = getFieldOptions({ field, facetedValue });

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
                            }),
                          );
                          setCurrentWord("");
                        }}
                      >
                        {`${optionValue}`}
                        {facetedValue?.has(optionValue) ? (
                          <span className="text-muted-foreground ml-auto font-mono">
                            {formatCompactNumber(
                              facetedValue.get(optionValue) || 0,
                            )}
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
                        <span className="text-muted-foreground/80 ml-auto truncate group-aria-selected:block">
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
                                (i) => i.search !== item.search,
                              ),
                            );
                          }}
                          className="hover:bg-background ml-1 hidden rounded-md p-0.5 group-aria-selected:block"
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
              className="bg-accent/50 text-accent-foreground flex flex-wrap justify-between gap-3 border-t px-2 py-1.5 text-sm"
              cmdk-footer=""
            >
              <div className="flex flex-wrap gap-3">
                <span>
                  Use <Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate
                </span>
                <span>
                  <Kbd>Enter</Kbd> to query
                </span>
                <span>
                  <Kbd>Esc</Kbd> to close
                </span>
                <Separator orientation="vertical" className="my-auto h-3" />
                <span>
                  Union: <Kbd>regions:a,b</Kbd>
                </span>
                <span>
                  Range: <Kbd>p95:59-340</Kbd>
                </span>
                <span>
                  Spaces: <Kbd>name:&quot;a b&quot;</Kbd>
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
  const { table, getFacetedMinMaxValues, getFacetedUniqueValues } =
    useDataTable();
  const value = field.value as string;
  switch (field.type) {
    case "checkbox": {
      return (
        <span className="text-muted-foreground/80 ml-1 hidden truncate group-aria-selected:block">
          {getFacetedUniqueValues
            ? Array.from(getFacetedUniqueValues(table, value)?.keys() || [])
                .map((value) => `[${value}]`)
                .join(" ")
            : field.options?.map(({ value }) => `[${value}]`).join(" ")}
        </span>
      );
    }
    case "slider": {
      const [min, max] = getFacetedMinMaxValues?.(table, value) || [
        field.min,
        field.max,
      ];
      return (
        <span className="text-muted-foreground/80 ml-1 hidden truncate group-aria-selected:block">
          [{min} - {max}]
        </span>
      );
    }
    case "input": {
      return (
        <span className="text-muted-foreground/80 ml-1 hidden truncate group-aria-selected:block">
          [{`${String(field.value)}`} input]
        </span>
      );
    }
    default: {
      return null;
    }
  }
}
