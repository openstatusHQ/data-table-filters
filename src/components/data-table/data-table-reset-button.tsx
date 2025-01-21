import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Table } from "@tanstack/react-table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/custom/kbd";
import { useEffect } from "react";

interface DataTableResetButtonProps<TData> {
  table: Table<TData>;
}

export function DataTableResetButton<TData>({
  table,
}: DataTableResetButtonProps<TData>) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        table.resetColumnFilters();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
          >
            <X className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>
            Reset filters with{" "}
            <Kbd className="ml-1 text-muted-foreground group-hover:text-accent-foreground">
              <span className="mr-0.5">⌘</span>
              <span>Esc</span>
            </Kbd>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
