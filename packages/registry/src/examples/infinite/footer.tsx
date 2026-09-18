"use client";

import { buttonVariants } from "@dtf/registry/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@dtf/registry/components/ui/dropdown-menu";
import { Github, Keyboard } from "lucide-react";

/**
 * The chords `useHotKey` registers for the example. The hook only fires with
 * `⌘`/`Ctrl` held — that includes `Escape` — so every one of these is a chord
 * and can be replayed from the menu.
 */
export const SHORTCUTS = [
  { key: "k", label: "Toggle command input" },
  { key: "b", label: "Toggle filter controls" },
  { key: "u", label: "Reset column order and visibility" },
  { key: "Escape", label: "Reset table filters" },
] as const;

export type Shortcut = (typeof SHORTCUTS)[number];

/** Plain keys the table and the row sheet respond to. Listed, not replayed. */
export const NAVIGATION = [
  { keys: "↑ ↓", label: "Previous / next row (sheet open)" },
  { keys: "Enter", label: "Open the focused row" },
  { keys: "Esc", label: "Close the row sheet" },
] as const;

/**
 * Replays a chord as the keydown `useHotKey` listens for, so picking it from
 * the menu does the same thing as pressing it.
 */
export function triggerShortcut(key: Shortcut["key"]) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, metaKey: true, bubbles: true }),
  );
}

export function formatShortcut(key: Shortcut["key"]) {
  return `⌘${key === "Escape" ? "Esc" : key.toUpperCase()}`;
}

/**
 * The sidebar footer: a GitHub link and the shortcuts list, with a
 * "Powered by openstatus" line. Delete it along with the rest of
 * `app/example` — or keep whatever is useful in your own footer slot.
 */
export function Footer() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-muted-foreground text-xs">
        Powered by{" "}
        <a
          href="https://openstatus.dev"
          target="_blank"
          rel="noreferrer"
          className="text-foreground decoration-border hover:decoration-foreground underline underline-offset-4"
        >
          openstatus
        </a>
      </p>
      <div className="flex items-center gap-1">
        {/* No `asChild` here, on purpose: this file ships as `registry:file`,
            which the shadcn CLI copies verbatim, so its Base UI codemod
            (`asChild` → `render`) never runs on it. The link and the menu
            trigger take the button styles directly instead. */}
        <a
          href="https://github.com/openstatusHQ/data-table-filters"
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <Github />
          <span className="sr-only">View on GitHub</span>
        </a>
        <ShortcutsMenu />
      </div>
    </div>
  );
}

function ShortcutsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
      >
        <Keyboard />
        <span className="sr-only">Keyboard shortcuts</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Shortcuts</DropdownMenuLabel>
          {SHORTCUTS.map((shortcut) => (
            <DropdownMenuItem
              key={shortcut.key}
              onClick={() => triggerShortcut(shortcut.key)}
            >
              {shortcut.label}
              <DropdownMenuShortcut>
                {formatShortcut(shortcut.key)}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Navigation</DropdownMenuLabel>
          {NAVIGATION.map((item) => (
            <DropdownMenuItem key={item.keys} disabled>
              {item.label}
              <DropdownMenuShortcut>{item.keys}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
