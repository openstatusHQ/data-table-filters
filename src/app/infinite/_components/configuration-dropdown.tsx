"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ADAPTER_COOKIE_NAME,
  PREFETCH_COOKIE_NAME,
} from "@/lib/constants/cookies";
import type { AdapterType } from "@/lib/store";
import { Cog } from "lucide-react";
import * as React from "react";

export function ConfigurationDropdown({
  prefetchEnabled: defaultPrefetchEnabled,
  adapterType: defaultAdapterType,
}: {
  prefetchEnabled: boolean;
  adapterType: AdapterType;
}) {
  const [prefetchEnabled, setPrefetchEnabled] = React.useState(
    defaultPrefetchEnabled,
  );
  const [adapterType, setAdapterType] =
    React.useState<AdapterType>(defaultAdapterType);

  const handlePrefetchChange = (value: string) => {
    const enabled = value === "true";
    // Set cookie with 1 year expiry
    document.cookie = `${PREFETCH_COOKIE_NAME}=${enabled}; path=/; max-age=31536000`;
    setPrefetchEnabled(enabled);
    // Refresh to apply the change
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const handleAdapterChange = (value: string) => {
    const adapter = value as AdapterType;
    // Set cookie with 1 year expiry
    document.cookie = `${ADAPTER_COOKIE_NAME}=${adapter}; path=/; max-age=31536000`;
    setAdapterType(adapter);
    // Refresh to apply the change
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <Cog className="h-4 w-4" />{" "}
          <span className="sr-only">Open configuration dropdown</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
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
