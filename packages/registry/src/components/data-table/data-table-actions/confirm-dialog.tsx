"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@dtf/registry/components/ui/alert-dialog";
import type { ActionDescriptor } from "@dtf/registry/lib/actions/types";
import { LoaderCircle } from "lucide-react";
import * as React from "react";
import { interpolate } from "./utils";

/** The command awaiting the user's answer, as the dialog sees it. */
export type ConfirmingCommandView = {
  action: ActionDescriptor;
  /** How many rows the user was shown. */
  count: number;
  /** Selected rows the action does not apply to. */
  skipped: number;
  /** `filter` scope applies to every matching row, not a selection. */
  scope: "ids" | "filter";
  /** Set when the server answered `count_mismatch`. */
  actual?: number;
};

export function describeCommand(command: ConfirmingCommandView): {
  title: string;
  description: string | null;
} {
  const { action, count, skipped, scope, actual } = command;

  if (actual !== undefined) {
    return {
      title: `${action.label}: the matching set changed`,
      description: `You were shown ${count} ${plural(count, "row")}; the server now counts ${actual}. Apply to ${actual} ${plural(actual, "row")} anyway?`,
    };
  }

  const title = interpolate(
    action.confirm ?? `${action.label} {count} ${plural(count, "row")}?`,
    { count },
  );
  const parts: string[] = [];
  if (scope === "filter") {
    parts.push("Applies to every row matching the current filters.");
  }
  if (skipped > 0) {
    parts.push(
      `${skipped} selected ${plural(skipped, "row")} ${skipped === 1 ? "does" : "do"} not qualify and will be skipped.`,
    );
  }
  return { title, description: parts.length > 0 ? parts.join(" ") : null };
}

function plural(n: number, noun: string): string {
  return n === 1 ? noun : `${noun}s`;
}

export function DataTableActionsConfirmDialog({
  command,
  inFlight = false,
  onConfirm,
  onCancel,
}: {
  /** Open while non-null. */
  command: ConfirmingCommandView | null;
  /**
   * The confirmed request is on the wire. The dialog stays open with both
   * buttons disabled until it settles — the owner closes it by clearing
   * `command`, or swaps in a `count_mismatch` view.
   */
  inFlight?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Keep the last command on screen while the dialog animates out: `command`
  // is cleared before the exit transition ends, and an empty title flickers.
  const [view, setView] = React.useState(command);
  if (command !== null && command !== view) setView(command);

  const copy = view ? describeCommand(view) : null;
  const destructive = view?.action.variant === "destructive";

  return (
    <AlertDialog
      open={command !== null}
      onOpenChange={(open) => {
        // Escape and outside clicks don't abandon a request already sent.
        if (!open && !inFlight) onCancel();
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
          {copy?.description ? (
            <AlertDialogDescription>{copy.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={inFlight}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={inFlight}
            aria-busy={inFlight || undefined}
            onClick={(event) => {
              // Radix closes on click; the owner closes once the request lands.
              event.preventDefault();
              onConfirm();
            }}
          >
            {inFlight ? (
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
            ) : null}
            {view?.actual !== undefined
              ? "Apply anyway"
              : (view?.action.label ?? "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
