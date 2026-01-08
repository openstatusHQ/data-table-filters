/**
 * State Inspector Component
 *
 * Displays current filter state in a readable format.
 */

"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface StateInspectorProps {
  state: Record<string, unknown>;
  defaults: Record<string, unknown>;
  className?: string;
}

export function StateInspector({
  state,
  defaults,
  className,
}: StateInspectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Current State
      </div>
      <div className="space-y-1">
        {Object.entries(state).map(([key, value]) => {
          const isDefault = isValueEqual(value, defaults[key]);
          return (
            <div
              key={key}
              className={cn(
                "flex items-start justify-between gap-2 rounded px-2 py-1 text-xs",
                isDefault ? "bg-muted/30" : "bg-primary/10",
              )}
            >
              <span className="font-mono font-medium">{key}</span>
              <span
                className={cn(
                  "break-all text-right font-mono",
                  isDefault ? "text-muted-foreground" : "text-primary",
                )}
              >
                {formatValue(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${value.map(formatValue).join(", ")}]`;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  return String(value);
}

function isValueEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isValueEqual(v, b[i]));
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) =>
      isValueEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    );
  }
  return false;
}
