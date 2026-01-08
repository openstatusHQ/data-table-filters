import { cn } from "@/lib/utils";
import * as React from "react";

export interface InputWithAddonsProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  containerClassName?: string;
}

const InputWithAddons = React.forwardRef<
  HTMLInputElement,
  InputWithAddonsProps
>(({ leading, trailing, containerClassName, className, ...props }, ref) => {
  return (
    <div
      className={cn(
        "group flex h-10 w-full overflow-hidden rounded-md border border-input bg-transparent text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        containerClassName,
      )}
    >
      {leading ? (
        <div className="border-r border-input bg-muted/50 px-3 py-2">
          {leading}
        </div>
      ) : null}
      <input
        className={cn(
          "w-full rounded-md bg-background px-3 py-2 placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
      {trailing ? (
        <div className="border-l border-input bg-muted/50 px-3 py-2">
          {trailing}
        </div>
      ) : null}
    </div>
  );
});
InputWithAddons.displayName = "InputWithAddons";

export { InputWithAddons };
