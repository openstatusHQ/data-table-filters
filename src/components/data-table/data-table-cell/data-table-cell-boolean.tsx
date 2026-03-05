import { Check, Minus } from "lucide-react";

export function DataTableCellBoolean({ value }: { value: boolean }) {
  if (value) {
    return <Check className="ml-auto h-4 w-4 text-foreground" />;
  }
  return <Minus className="ml-auto h-4 w-4 text-muted-foreground/50" />;
}
