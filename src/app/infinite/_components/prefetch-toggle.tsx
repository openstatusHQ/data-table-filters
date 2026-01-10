"use client";

import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PREFETCH_COOKIE_NAME } from "@/lib/constants/cookies";
import { Server, ServerOff } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

export function PrefetchToggle() {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState<boolean | null>(null);

  // Read cookie on mount
  React.useEffect(() => {
    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${PREFETCH_COOKIE_NAME}=`))
      ?.split("=")[1];
    setEnabled(cookieValue === "true");
  }, []);

  const toggle = (pressed: boolean) => {
    // Set cookie with 1 year expiry
    document.cookie = `${PREFETCH_COOKIE_NAME}=${pressed}; path=/; max-age=31536000`;
    setEnabled(pressed);
    // Refresh to apply the change
    router.refresh();
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Toggle
            size="sm"
            variant="outline"
            pressed={enabled ?? false}
            onPressedChange={toggle}
          >
            {enabled ? (
              <Server className="h-4 w-4" />
            ) : (
              <ServerOff className="h-4 w-4" />
            )}
            <span className="sr-only">
              {enabled ? "Disable" : "Enable"} server prefetch
            </span>
          </Toggle>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-muted-foreground">
            Server prefetch:{" "}
            <strong className="font-medium text-foreground">
              {enabled ? "enabled" : "disabled"}
            </strong>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
