import { ModeToggle } from "@/components/theme/toggle-mode";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import NextLink from "next/link";

export function SocialsFooter() {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-center items-center gap-2 p-1">
        <ModeToggle className="[&>svg]:h-4 [&>svg]:w-4" />
        <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
          <NextLink href="https://github.com/premieroctet/access-log-ui">
            <Github className="h-4 w-4" />
          </NextLink>
        </Button>
      </div>
    </div>
  );
}
