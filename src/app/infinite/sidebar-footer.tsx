import { ModeToggle } from "@/components/theme/toggle-mode";
import { Button } from "@/components/ui/button";
import { Github, Globe, Twitter } from "lucide-react";

export function SidebarFooter() {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-center items-center gap-2 p-1">
        <ModeToggle className="[&>svg]:h-4 [&>svg]:w-4" />
        <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
          <a
            href="https://github.com/openstatusHQ/data-table-filters"
            target="_blank"
          >
            <Github className="h-4 w-4" />
          </a>
        </Button>
        <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
          <a href="https://twitter.com/openstatusHQ" target="_blank">
            <Twitter className="h-4 w-4" />
          </a>
        </Button>
        <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
          <a href="https://openstatus.dev" target="_blank">
            <Globe className="h-4 w-4" />
          </a>
        </Button>
      </div>
      <p className="text-muted-foreground text-center text-sm">
        Powered by{" "}
        <a
          href="https://openstatus.dev"
          target="_blank"
          className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
        >
          OpenStatus
        </a>
      </p>
    </div>
  );
}
