import { Star } from "lucide-react";

export function DataTableCellStar({ value }: { value: boolean }) {
  if (value) {
    return <Star className="ml-auto h-4 w-4 fill-yellow-400 text-yellow-400" />;
  }
  return <Star className="text-muted-foreground/40 ml-auto h-4 w-4" />;
}
