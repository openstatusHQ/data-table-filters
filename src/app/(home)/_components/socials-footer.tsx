import { ModeToggle } from "@/components/theme/toggle-mode";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, Github, Globe, Twitter } from "lucide-react";
import NextLink from "next/link";
import { Kbd } from "@/components/custom/kbd";
import { Link } from "@/components/custom/link";

export function SocialsFooter() {
  return (
    <div className="flex flex-col gap-2">
      <div className="w-full flex justify-center items-center gap-2 p-1">
        <ModeToggle className="[&>svg]:h-4 [&>svg]:w-4" />
        <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
          <NextLink href="https://github.com/openstatusHQ/data-table-filters">
            <Github className="h-4 w-4" />
          </NextLink>
        </Button>
        <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
          <NextLink href="https://twitter.com/openstatusHQ">
            <Twitter className="h-4 w-4" />
          </NextLink>
        </Button>
        <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
          <NextLink href="https://openstatus.dev">
            <Globe className="h-4 w-4" />
          </NextLink>
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="w-9 px-0">
              <Command className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="px-2 py-1 w-auto">
            <HotkeyOverview />
          </PopoverContent>
        </Popover>
      </div>
      <p className="text-muted-foreground text-xs text-center">
        Powered by{" "}
        <Link href="https://openstatus.dev" hideArrow>
          OpenStatus
        </Link>
      </p>
      <p className="text-muted-foreground text-[10px] text-center">
        The data is mocked. It is in active development. For feedback, please{" "}
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
    description: "Undo column state (order, visibility)",
  },
  { key: "Esc", description: "Reset table filters" },
  {
    key: ".",
    description: "Reset element focus to start",
  },
];

function HotkeyOverview() {
  return (
    <ul className="divide-y">
      {hotkeys.map((props) => {
        return (
          <li key={props.key} className="grid grid-cols-4 gap-2 py-0.5">
            <span className="col-span-1 text-left">
              <Kbd className="ml-1">
                <span className="mr-1">⌘</span>
                <span>{props.key}</span>
              </Kbd>
            </span>
            <span className="col-span-3 place-content-center text-muted-foreground text-xs">
              {props.description}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
