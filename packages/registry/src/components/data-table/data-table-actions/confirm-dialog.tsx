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
import { interpolate } from "./utils";

export type PendingCommandView = {
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

export function describePending(pending: PendingCommandView): {
  title: string;
  description: string | null;
} {
  const { action, count, skipped, scope, actual } = pending;

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
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingCommandView | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const copy = pending ? describePending(pending) : null;
  const destructive = pending?.action.variant === "destructive";

  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
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
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {pending?.actual !== undefined
              ? "Apply anyway"
              : (pending?.action.label ?? "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
