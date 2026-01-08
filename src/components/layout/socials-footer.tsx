import { Link } from "@/components/custom/link";
import { Bluesky } from "@/components/icons/bluesky";
import { Github } from "@/components/icons/github";
import { X } from "@/components/icons/x";
import { ModeToggle } from "@/components/theme/toggle-mode";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import NextLink from "next/link";

export function SocialsFooter() {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-center gap-2 p-1">
        <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
          <NextLink href="/">
            <Home className="h-4 w-4" />
          </NextLink>
        </Button>
        <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
          <NextLink href="https://github.com/openstatusHQ/data-table-filters">
            <Github className="h-4 w-4" />
          </NextLink>
        </Button>
        <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
          <NextLink href="https://twitter.com/openstatusHQ">
            <X className="h-4 w-4" />
          </NextLink>
        </Button>
        <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
          <NextLink href="https://bsky.app/profile/openstatus.dev">
            <Bluesky className="h-4 w-4" />
          </NextLink>
        </Button>
        <ModeToggle className="[&>svg]:h-4 [&>svg]:w-4" />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Powered by <Link href="https://openstatus.dev">OpenStatus</Link>
      </p>
    </div>
  );
}
