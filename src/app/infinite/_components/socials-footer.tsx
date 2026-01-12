import { Link } from "@/components/custom/link";
import { Bluesky } from "@/components/icons/bluesky";
import { Github } from "@/components/icons/github";
import { X } from "@/components/icons/x";
import { ModeToggle } from "@/components/theme/toggle-mode";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ADAPTER_COOKIE_NAME,
  PREFETCH_COOKIE_NAME,
} from "@/lib/constants/cookies";
import type { AdapterType } from "@/lib/store";
import { Book, Cog, Command } from "lucide-react";
import NextLink from "next/link";
import { useState } from "react";

export function SocialsFooter({
  showConfigurationDropdown,
  prefetchEnabled,
  adapterType,
}: {
  showConfigurationDropdown: boolean;
  prefetchEnabled: boolean;
  adapterType: AdapterType;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid w-full grid-cols-3 items-center justify-center gap-2 p-1 md:grid-cols-6">
        <Button variant="ghost" size="sm" className="h-8 w-8 px-0" asChild>
          <NextLink href="https://github.com/openstatusHQ/data-table-filters">
            <Github className="h-4 w-4" />
          </NextLink>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 px-0" asChild>
          <NextLink href="https://twitter.com/openstatusHQ">
            <X className="h-4 w-4" />
          </NextLink>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 px-0" asChild>
          <NextLink href="https://bsky.app/profile/openstatus.dev">
            <Bluesky className="h-4 w-4" />
          </NextLink>
        </Button>
        <ModeToggle className="h-8 w-8 [&>svg]:h-4 [&>svg]:w-4" />
        <HotkeyDropdown />
        {showConfigurationDropdown ? (
          <ConfigurationDropdown
            prefetchEnabled={prefetchEnabled}
            adapterType={adapterType}
          />
        ) : (
          <Button variant="ghost" size="sm" className="h-8 w-8 px-0" asChild>
            <NextLink href="/guide">
              <Book className="h-4 w-4" />
            </NextLink>
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Powered by{" "}
        <Link href="https://openstatus.dev" hideArrow>
          OpenStatus
        </Link>
      </p>
      <p className="text-center text-[10px] text-muted-foreground">
        The project is in active development. For feedback, please{" "}
        <Link
          href="https://github.com/openstatusHQ/data-table-filters/issues/new"
          className="text-muted-foreground"
          hideArrow
        >
          open an issue
        </Link>{" "}
        on GitHub.
      </p>
    </div>
  );
}

const hotkeys = [
  { key: "K", description: "Toggle command input" },
  { key: "B", description: "Toggle sidebar controls" },
  {
    key: "U",
    description: "Reset column (order, visibility)",
  },
  {
    key: "J",
    description: "Toggle live mode",
  },
  { key: "Esc", description: "Reset table filters" },
  {
    key: ".",
    description: "Reset element focus to start",
  },
];

function HotkeyDropdown() {
  const triggerHotkey = (key: string) => {
    const eventKey = key === "Esc" ? "Escape" : key.toLowerCase();
    const event = new KeyboardEvent("keydown", {
      key: eventKey,
      metaKey: key !== "Esc" && key !== ".",
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
          <Command className="h-4 w-4" />
          <span className="sr-only">Open keyboard shortcuts</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuLabel>Keyboard Shortcuts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hotkeys.map((hotkey) => (
          <DropdownMenuItem
            key={hotkey.key}
            onClick={() => triggerHotkey(hotkey.key)}
          >
            {hotkey.description}
            <DropdownMenuShortcut>⌘{hotkey.key}</DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ConfigurationDropdown({
  prefetchEnabled: defaultPrefetchEnabled,
  adapterType: defaultAdapterType,
}: {
  prefetchEnabled: boolean;
  adapterType: AdapterType;
}) {
  const [prefetchEnabled, setPrefetchEnabled] = useState(
    defaultPrefetchEnabled,
  );
  const [adapterType, setAdapterType] =
    useState<AdapterType>(defaultAdapterType);

  const handlePrefetchChange = (value: string) => {
    const enabled = value === "true";
    // Set cookie with 1 year expiry
    document.cookie = `${PREFETCH_COOKIE_NAME}=${enabled}; path=/; max-age=31536000`;
    setPrefetchEnabled(enabled);
    // Refresh to apply the change (clear search params to reset state)
    if (typeof window !== "undefined") {
      window.location.href = window.location.pathname;
    }
  };

  const handleAdapterChange = (value: string) => {
    const adapter = value as AdapterType;
    // Set cookie with 1 year expiry
    document.cookie = `${ADAPTER_COOKIE_NAME}=${adapter}; path=/; max-age=31536000`;
    setAdapterType(adapter);
    // Refresh to apply the change (clear search params to reset state)
    if (typeof window !== "undefined") {
      window.location.href = window.location.pathname;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 px-0 [&>svg]:h-4 [&>svg]:w-4"
        >
          <Cog className="h-4 w-4" />
          <span className="sr-only">Open configuration dropdown</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Adapter Type</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={adapterType}
          onValueChange={handleAdapterChange}
        >
          <DropdownMenuRadioItem value="nuqs">Nuqs</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="zustand">Zustand</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Prefetch Server Side</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={prefetchEnabled ? "true" : "false"}
          onValueChange={handlePrefetchChange}
        >
          <DropdownMenuRadioItem value="true">Enabled</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="false">Disabled</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
