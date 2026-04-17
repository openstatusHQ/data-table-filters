import { Button } from "@/components/ui/button";
import { useDataTable } from "@dtf/registry/components/data-table/data-table-provider";
import { LoaderCircle, RefreshCcw } from "lucide-react";

interface RefreshButtonProps {
  onClick: () => void;
}

export function RefreshButton({ onClick }: RefreshButtonProps) {
  const { isLoading } = useDataTable();

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={isLoading}
      onClick={onClick}
      className="shadow-none"
    >
      {isLoading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCcw className="h-4 w-4" />
      )}
      <span className="sr-only">Refresh data</span>
    </Button>
  );
}
