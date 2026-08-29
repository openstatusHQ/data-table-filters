"use client";

import { useDataTable } from "@dtf/registry/components/data-table/data-table-provider";
import { Button } from "@dtf/registry/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@dtf/registry/components/ui/dropdown-menu";
import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import { ChevronDown } from "lucide-react";
import { useDataTableActions } from "./provider";
import { actionsForScope } from "./utils";

/**
 * Keep only the store keys that are filters. `sort`, `cursor`, `uuid` and
 * friends are table state, not a predicate, and the server would drop them
 * anyway — but sending them hides what the request is actually about.
 */
export function pickFilterValues(
  state: Record<string, unknown>,
  filterKeys: readonly string[],
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  for (const key of filterKeys) {
    const value = state[key];
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    filter[key] = value;
  }
  return filter;
}

/**
 * "Apply to every row matching the current filters" — the filter scope.
 * Sits in the toolbar's `toolbarActions` slot. Sends `expected_count` from
 * the server's own `filterRowCount`, so a drifted set is caught server-side.
 */
export function DataTableActionsFilterMenu() {
  const { actions, trigger, isPending } = useDataTableActions();
  const { filterRows, filterFields } = useDataTable();
  const state = useFilterState<Record<string, unknown>>();

  const filterActions = actionsForScope(actions, "filter");
  if (filterActions.length === 0) return null;

  const count = filterRows ?? 0;
  const filterKeys = filterFields.map((field) => String(field.value));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending || count === 0}
          data-matching={count}
        >
          Actions
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-muted-foreground font-normal">
          All {count.toLocaleString()} matching rows
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {filterActions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            variant={
              action.variant === "destructive" ? "destructive" : "default"
            }
            onSelect={() =>
              trigger(
                action,
                {
                  scope: "filter",
                  filter: pickFilterValues(state, filterKeys),
                  expected_count: count,
                },
                { count },
              )
            }
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
