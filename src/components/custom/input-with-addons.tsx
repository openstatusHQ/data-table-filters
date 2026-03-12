import { cn } from "@/lib/utils";
import * as React from "react";

export interface InputWithAddonsProps extends React.ComponentProps<"input"> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  containerClassName?: string;
}

function InputWithAddons({
  leading,
  trailing,
  containerClassName,
  className,
  ...props
}: InputWithAddonsProps) {
  return (
    <div
      className={cn(
        "group border-input ring-offset-background focus-within:ring-ring flex h-10 w-full overflow-hidden rounded-md border bg-transparent text-sm focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-hidden",
        containerClassName,
      )}
    >
      {leading ? (
        <div className="border-input bg-muted/50 border-r px-3 py-2">
          {leading}
        </div>
      ) : null}
      <input
        className={cn(
          "bg-background placeholder:text-muted-foreground w-full rounded-md px-3 py-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      {trailing ? (
        <div className="border-input bg-muted/50 border-l px-3 py-2">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

export { InputWithAddons };
