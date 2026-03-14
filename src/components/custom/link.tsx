import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import React from "react";

export interface LinkProps extends NextLinkProps {
  className?: string;
  children?: React.ReactNode;
  hideArrow?: boolean;
}

function Link({ className, href, children, hideArrow, ...props }: LinkProps) {
  const isInternal =
    href?.toString().startsWith("/") || href?.toString().startsWith("#");
  const externalLinkProps = !isInternal
    ? { target: "_blank", rel: "noreferrer" }
    : undefined;

  return (
    <NextLink
      className={cn(
        "group text-foreground decoration-border hover:decoration-foreground underline underline-offset-4",
        "focus-visible:border-ring focus-visible:ring-ring/50 rounded-md transition-all outline-none focus-visible:ring-[3px]",
        className,
      )}
      href={href}
      {...externalLinkProps}
      {...props}
    >
      {children}
      {!isInternal && !hideArrow ? (
        <ArrowUpRight className="text-muted-foreground group-hover:text-foreground ml-0.5 inline-block h-4 w-4 group-hover:translate-x-px group-hover:-translate-y-px" />
      ) : null}
    </NextLink>
  );
}

export { Link };
