import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";

export function DataTableLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Button
        className="fixed top-1.5 left-1.5 z-100 -translate-y-12 opacity-0 transition-all focus-visible:translate-y-0 focus-visible:opacity-100"
        asChild
      >
        <Link id="skip-to-content" href="#content">
          Skip to content
        </Link>
      </Button>
      {children}
    </>
  );
}

export function DataTableLayoutFloatingBar({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="group/pile fixed right-4 bottom-4 z-50 pt-1.5">
      {children}
    </div>
  );
}

export function DataTableLayoutFloatingAction({
  href,
  children,
  secondary,
}: React.ComponentProps<typeof Link> & { secondary?: boolean }) {
  const isInternal =
    href?.toString().startsWith("/") || href?.toString().startsWith("#");
  const externalLinkProps = !isInternal
    ? { target: "_blank", rel: "noreferrer" }
    : undefined;
  return (
    <Button
      asChild
      className={`group gap-0! [&_svg]:shrink! ${
        secondary
          ? "absolute top-0 -right-1.5 -z-10 opacity-70 transition-transform group-hover/pile:-translate-x-1.5 group-hover/pile:-translate-y-10 group-hover/pile:opacity-100"
          : ""
      }`}
    >
      <Link href={href} {...externalLinkProps}>
        <span className="mr-1">{children}</span>
        <ArrowRight className="relative mb-px inline h-4 w-0! transition-all group-hover:w-4!" />
        <ChevronRight className="relative mb-px inline h-4 w-4! transition-all group-hover:w-0!" />
      </Link>
    </Button>
  );
}
