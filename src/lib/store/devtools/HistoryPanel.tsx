/**
 * History Panel Component
 *
 * Shows state change history with timestamps.
 */

"use client";

import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import React from "react";

export interface HistoryEntry {
  timestamp: number;
  state: Record<string, unknown>;
}

interface HistoryPanelProps {
  history: HistoryEntry[];
  onSelect?: (entry: HistoryEntry) => void;
  selectedIndex?: number;
  className?: string;
}

export function HistoryPanel({
  history,
  onSelect,
  selectedIndex,
  className,
}: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div
        className={cn(
          "py-4 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        No history yet
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        History ({history.length})
      </div>
      <div className="max-h-[200px] space-y-1 overflow-y-auto">
        {history
          .slice()
          .reverse()
          .map((entry, index) => {
            const actualIndex = history.length - 1 - index;
            const isSelected = selectedIndex === actualIndex;
            const changedKeys = getChangedKeys(
              entry.state,
              history[actualIndex - 1]?.state || {},
            );

            return (
              <button
                key={entry.timestamp}
                type="button"
                onClick={() => onSelect?.(entry)}
                className={cn(
                  "w-full rounded px-2 py-1.5 text-left text-xs transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 hover:bg-muted/50",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] opacity-60">
                    #{actualIndex + 1}
                  </span>
                  <span className="text-[10px] opacity-60">
                    {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                  </span>
                </div>
                {changedKeys.length > 0 && (
                  <div className="mt-0.5 text-[10px] opacity-80">
                    Changed: {changedKeys.join(", ")}
                  </div>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}

function getChangedKeys(
  current: Record<string, unknown>,
  previous: Record<string, unknown>,
): string[] {
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);

  for (const key of allKeys) {
    if (!isEqual(current[key], previous[key])) {
      changed.push(key);
    }
  }

  return changed;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isEqual(v, b[i]));
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) =>
      isEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    );
  }
  return false;
}
