import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SheetField } from "../types";

interface SheetDetailsContentSkeletonProps<TData, TMeta> {
  fields: SheetField<TData, TMeta>[];
}

export function SheetDetailsContentSkeleton<TData, TMeta>({
  fields,
}: SheetDetailsContentSkeletonProps<TData, TMeta>) {
  return (
    <dl className="divide-y">
      {fields.map((field) => (
        <div
          key={field.id.toString()}
          className="flex items-center justify-between gap-4 py-2 text-sm"
        >
          <dt className="text-muted-foreground shrink-0">{field.label}</dt>
          <div>
            <Skeleton className={cn("h-5 w-52", field.skeletonClassName)} />
          </div>
        </div>
      ))}
    </dl>
  );
}
