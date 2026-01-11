/**
 * DataTable DevTools
 *
 * Debugging panel for filter state, similar to React Query DevTools.
 */

"use client";

import { cn } from "@/lib/utils";
import { Bug, Copy, Pause, Play, RotateCcw, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useStoreContext } from "../context";
import { useFilterActions } from "../hooks/useFilterActions";
import { useFilterState } from "../hooks/useFilterState";
import { HistoryPanel, type HistoryEntry } from "./HistoryPanel";
import { StateInspector } from "./StateInspector";

export interface DevToolsProps {
  /**
   * Position of the DevTools panel
   */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";

  /**
   * Start with panel open
   */
  defaultOpen?: boolean;

  /**
   * Initial panel height
   */
  initialHeight?: number;
}

/**
 * DevTools component for debugging filter state
 *
 * @example
 * ```typescript
 * import { DevTools } from '@/lib/store/devtools';
 *
 * function App() {
 *   return (
 *     <>
 *       <DataTableStoreProvider adapter={adapter}>
 *         <DataTable />
 *       </DataTableStoreProvider>
 *       <DevTools position="bottom-right" />
 *     </>
 *   );
 * }
 * ```
 */
export function DevTools({
  position = "bottom-right",
  defaultOpen = false,
  initialHeight = 300,
}: DevToolsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [height, setHeight] = useState(initialHeight);
  const [activeTab, setActiveTab] = useState<"state" | "history">("state");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);

  // Only render in development
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <DevToolsContent
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      height={height}
      setHeight={setHeight}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      history={history}
      setHistory={setHistory}
      copied={copied}
      setCopied={setCopied}
      position={position}
    />
  );
}

function DevToolsContent({
  isOpen,
  setIsOpen,
  height,
  setHeight,
  activeTab,
  setActiveTab,
  history,
  setHistory,
  copied,
  setCopied,
  position,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  height: number;
  setHeight: (height: number) => void;
  activeTab: "state" | "history";
  setActiveTab: (tab: "state" | "history") => void;
  history: HistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
  copied: boolean;
  setCopied: (copied: boolean) => void;
  position: DevToolsProps["position"];
}) {
  const context = useStoreContext();

  // Return early if no context (not wrapped in provider)
  if (!context) {
    return (
      <DevToolsToggle
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        position={position}
        disabled
      />
    );
  }

  return (
    <DevToolsWithContext
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      height={height}
      setHeight={setHeight}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      history={history}
      setHistory={setHistory}
      copied={copied}
      setCopied={setCopied}
      position={position}
    />
  );
}

function DevToolsWithContext({
  isOpen,
  setIsOpen,
  height,
  activeTab,
  setActiveTab,
  history,
  setHistory,
  copied,
  setCopied,
  position,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  height: number;
  setHeight: (height: number) => void;
  activeTab: "state" | "history";
  setActiveTab: (tab: "state" | "history") => void;
  history: HistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
  copied: boolean;
  setCopied: (copied: boolean) => void;
  position: DevToolsProps["position"];
}) {
  const state = useFilterState<Record<string, unknown>>();
  const { resetAllFilters, pause, resume, isPaused } = useFilterActions();
  const context = useStoreContext();
  const defaults = context?.adapter.getDefaults() as Record<string, unknown>;
  const tableId = context?.tableId || "unknown";
  const paused = isPaused();

  // Track state changes in history
  useEffect(() => {
    setHistory((prev) => {
      // Avoid duplicate entries
      const lastEntry = prev[prev.length - 1];
      if (
        lastEntry &&
        JSON.stringify(lastEntry.state) === JSON.stringify(state)
      ) {
        return prev;
      }

      return [
        ...prev.slice(-49), // Keep last 50 entries
        {
          timestamp: Date.now(),
          state: structuredClone(state),
        },
      ];
    });
  }, [state, setHistory]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(state, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [state, setCopied]);

  const handleReset = useCallback(() => {
    resetAllFilters();
  }, [resetAllFilters]);

  const handleTogglePause = useCallback(() => {
    if (paused) {
      resume();
    } else {
      pause();
    }
  }, [paused, pause, resume]);

  const positionClasses = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
  };

  if (!isOpen) {
    return (
      <DevToolsToggle
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        position={position}
      />
    );
  }

  return (
    <div
      className={cn(
        "fixed z-50 w-80 rounded-lg border bg-background shadow-lg",
        positionClasses[position || "bottom-right"],
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Filter DevTools</span>
          <span className="text-xs text-muted-foreground">({tableId})</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded p-1 hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab("state")}
          className={cn(
            "flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
            activeTab === "state"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          State
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
            activeTab === "history"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div className="overflow-auto p-3" style={{ maxHeight: height }}>
        {activeTab === "state" && (
          <StateInspector state={state} defaults={defaults} />
        )}
        {activeTab === "history" && <HistoryPanel history={history} />}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleReset}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Reset to defaults"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Copy state as JSON"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleTogglePause}
            className={cn(
              "rounded p-1.5 hover:bg-muted",
              paused
                ? "text-yellow-500"
                : "text-muted-foreground hover:text-foreground",
            )}
            title={paused ? "Resume updates" : "Pause updates"}
          >
            {paused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          {copied && <span className="text-green-500">Copied!</span>}
          {paused && <span className="text-yellow-500">Paused</span>}
        </div>
      </div>
    </div>
  );
}

function DevToolsToggle({
  isOpen,
  setIsOpen,
  position,
  disabled,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  position: DevToolsProps["position"];
  disabled?: boolean;
}) {
  const positionClasses = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
  };

  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      disabled={disabled}
      className={cn(
        "fixed z-50 rounded-full bg-primary p-2 text-primary-foreground shadow-lg transition-transform hover:scale-110",
        positionClasses[position || "bottom-right"],
        disabled && "cursor-not-allowed opacity-50",
      )}
      title={disabled ? "No DataTableStoreProvider found" : "Open DevTools"}
    >
      <Bug className="h-5 w-5" />
    </button>
  );
}
