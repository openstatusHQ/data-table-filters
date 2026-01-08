import { Link } from "@/components/custom/link";
import { ArrowRight, ChevronRight } from "lucide-react";

export function TopBanner() {
  return (
    <div className="group border-b bg-muted/50 text-foreground">
      <div className="container mx-auto px-4 py-2 sm:px-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <p className="flex items-center justify-center gap-2">
            <Link href="/infinite" className="no-underline">
              <span className="font-semibold">New Example: </span>
              <span className="underline decoration-muted-foreground underline-offset-4 group-hover:decoration-foreground">
                Infinite Scroll
              </span>{" "}
              <span className="mr-1">Now Available, Inspired by Vercel</span>
              <ArrowRight className="relative mb-[1px] inline h-4 w-0 transition-all group-hover:w-4" />
              <ChevronRight className="relative mb-[1px] inline h-4 w-4 transition-all group-hover:w-0" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
