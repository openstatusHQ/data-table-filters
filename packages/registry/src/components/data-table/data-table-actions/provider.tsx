"use client";

import type {
  ActionDescriptor,
  ActionRequest,
  ActionResponse,
} from "@dtf/registry/lib/actions/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import {
  DataTableActionsConfirmDialog,
  type PendingCommandView,
} from "./confirm-dialog";
import {
  ActionRequestError,
  newCommandId,
  postAction,
  rowActionsOf,
} from "./utils";

type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

/** A request minus the `cmd_id` the provider stamps on at send time. */
export type ActionRequestInput = DistributiveOmit<ActionRequest, "cmd_id">;

export type TriggerMeta = {
  /** How many rows the user was shown. */
  count: number;
  /** Selected rows the action does not apply to. */
  skipped?: number;
  /** Runs after a 2xx — e.g. clear the selection the action consumed. */
  onApplied?: () => void;
};

export type AppliedEvent = {
  action: ActionDescriptor;
  request: ActionRequest;
  response: ActionResponse;
};

export type DataTableActionsContextValue<TData = unknown> = {
  actions: ActionDescriptor[];
  getRowId: (row: TData) => string;
  getRowActions: (row: TData) => string[];
  /**
   * Start an action. Opens the confirmation if the descriptor asks for one,
   * otherwise sends immediately. A `count_mismatch` reopens the dialog with
   * the server's number and offers to apply anyway.
   */
  trigger: (
    action: ActionDescriptor,
    request: ActionRequestInput,
    meta: TriggerMeta,
  ) => void;
  isPending: boolean;
};

const DataTableActionsContext =
  React.createContext<DataTableActionsContextValue<never> | null>(null);

export function useDataTableActions<TData = unknown>() {
  const context = React.useContext(DataTableActionsContext);
  if (!context) {
    throw new Error(
      "useDataTableActions must be used within a DataTableActionsProvider",
    );
  }
  return context as unknown as DataTableActionsContextValue<TData>;
}

type PendingCommand = PendingCommandView & {
  request: ActionRequestInput;
  onApplied?: () => void;
};

export type DataTableActionsProviderProps<TData> = {
  /** From `meta.actions`. `undefined` while loading renders no buttons. */
  actions?: ActionDescriptor[];
  getRowId: (row: TData) => string;
  /** Defaults to the server's `_actions` stamp. */
  getRowActions?: (row: TData) => string[];
  /**
   * The first element of the table's query key. Every page under it is
   * invalidated after a successful action, so rows that no longer match
   * leave the view.
   */
  queryKeyPrefix?: string;
  onApplied?: (event: AppliedEvent) => void;
  /** Injected in tests. */
  fetcher?: typeof fetch;
  children: React.ReactNode;
};

export function DataTableActionsProvider<TData>({
  actions,
  getRowId,
  getRowActions,
  queryKeyPrefix,
  onApplied,
  fetcher,
  children,
}: DataTableActionsProviderProps<TData>) {
  const queryClient = useQueryClient();
  const [pending, setPending] = React.useState<PendingCommand | null>(null);

  const mutation = useMutation({
    mutationFn: (variables: {
      action: ActionDescriptor;
      request: ActionRequest;
      meta: TriggerMeta;
    }) => postAction(variables.action.href, variables.request, fetcher),
    onSuccess: (response, { action, request, meta }) => {
      if (request.scope === "filter") {
        // The client counted the filter-only set; the server applied within
        // the action's guard. A smaller number is the guard at work, not a
        // partial failure.
        toast.success(
          `${action.label}: applied to ${response.applied} of ${meta.count} matching`,
        );
      } else if (response.applied < request.ids.length) {
        // Only eligible ids were sent, so a shortfall means rows changed
        // between fetch and click.
        toast.warning(
          `${action.label}: applied to ${response.applied} of ${request.ids.length}`,
        );
      } else {
        toast.success(`${action.label}: applied to ${response.applied}`);
      }
      if (queryKeyPrefix) {
        void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
      }
      meta.onApplied?.();
      onApplied?.({ action, request, response });
    },
    onError: (error, { action, request, meta }) => {
      if (
        error instanceof ActionRequestError &&
        error.code === "count_mismatch" &&
        request.scope === "filter"
      ) {
        const { cmd_id: _cmdId, ...input } = request;
        setPending({
          action,
          request: input,
          count: meta.count,
          skipped: meta.skipped ?? 0,
          scope: "filter",
          actual: error.actual ?? 0,
          onApplied: meta.onApplied,
        });
        return;
      }
      toast.error(`${action.label} failed: ${error.message}`);
    },
  });

  // `mutate` is referentially stable; the result object is not, and depending
  // on it would rebuild `trigger` — and the context value — on every render.
  const { mutate, isPending } = mutation;

  const send = React.useCallback(
    (
      action: ActionDescriptor,
      request: ActionRequestInput,
      meta: TriggerMeta,
    ) => {
      mutate({
        action,
        request: { ...request, cmd_id: newCommandId() } as ActionRequest,
        meta,
      });
    },
    [mutate],
  );

  const trigger = React.useCallback<
    DataTableActionsContextValue<TData>["trigger"]
  >(
    (action, request, meta) => {
      if (action.confirm) {
        setPending({
          action,
          request,
          count: meta.count,
          skipped: meta.skipped ?? 0,
          scope: request.scope,
          onApplied: meta.onApplied,
        });
        return;
      }
      send(action, request, meta);
    },
    [send],
  );

  const confirm = React.useCallback(() => {
    if (!pending) return;
    const { action, request, count, skipped, actual, onApplied } = pending;
    setPending(null);
    if (actual !== undefined && request.scope === "filter") {
      // The user accepted the server's number: drop the optimistic check.
      const { expected_count: _expected, ...rest } = request;
      send(action, rest, { count: actual, skipped, onApplied });
      return;
    }
    send(action, request, { count, skipped, onApplied });
  }, [pending, send]);

  const cancel = React.useCallback(() => setPending(null), []);

  const value = React.useMemo<DataTableActionsContextValue<TData>>(
    () => ({
      actions: actions ?? [],
      getRowId,
      getRowActions: getRowActions ?? rowActionsOf,
      trigger,
      isPending,
    }),
    [actions, getRowId, getRowActions, trigger, isPending],
  );

  return (
    <DataTableActionsContext.Provider
      value={value as unknown as DataTableActionsContextValue<never>}
    >
      {children}
      <DataTableActionsConfirmDialog
        pending={pending}
        onConfirm={confirm}
        onCancel={cancel}
      />
    </DataTableActionsContext.Provider>
  );
}
