import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SheetField } from "../types";

interface SheetDetailsContentSkeletonProps<TData> {
  fields: SheetField<TData>[];
}

export function SheetDetailsContentSkeleton<TData>({
  fields,
}: SheetDetailsContentSkeletonProps<TData>) {
  return (
    <dl className="divide-y">
      {fields.map((field) => (
        <div
          key={field.id.toString()}
          className="flex gap-4 py-2 text-sm justify-between items-center"
        >
          <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
          <div>
            <Skeleton className={cn("h-5 w-52", field.skeletonClassName)} />
          </div>
        </div>
      ))}
    </dl>
  );
}
