import { Link } from "@/components/custom/link";
import { Bluesky } from "@/components/icons/bluesky";
import { Github } from "@/components/icons/github";
import { X } from "@/components/icons/x";
import { ModeToggle } from "@/components/theme/toggle-mode";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import NextLink from "next/link";

export function Footer() {
  return (
    <footer className="flex flex-col gap-1">
      <div className="flex items-center justify-center gap-2 p-1">
        <Button variant="ghost" size="icon" asChild>
          <NextLink href="/">
            <Home />
          </NextLink>
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <NextLink href="https://github.com/openstatusHQ/data-table-filters">
            <Github />
          </NextLink>
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <NextLink href="https://twitter.com/openstatusHQ">
            <X />
          </NextLink>
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <NextLink href="https://bsky.app/profile/openstatus.dev">
            <Bluesky />
          </NextLink>
        </Button>
        <ModeToggle />
      </div>
      <p className="text-muted-foreground text-center text-sm">
        Powered by <Link href="https://openstatus.dev">OpenStatus</Link>
      </p>
    </footer>
  );
}
