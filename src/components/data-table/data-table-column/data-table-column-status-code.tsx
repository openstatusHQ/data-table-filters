import { getStatusColor } from "@/lib/request/status-code";
import { cn } from "@/lib/utils";
import { Minus } from "lucide-react";

export function DataTableColumnStatusCode({
  value,
}: {
  value?: number | string;
}) {
  if (!value) {
    return <Minus className="h-4 w-4 text-muted-foreground/50" />;
  }
  if (typeof value === "number") {
    const colors = getStatusColor(value);
    return <div className={cn("font-mono", colors.text)}>{value}</div>;
  }
  return <div className="text-muted-foreground">{value}</div>;
}
