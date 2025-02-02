import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Button
        className="fixed left-1.5 top-1.5 z-[100] opacity-0 transition-all focus-visible:translate-y-0 -translate-y-12 focus-visible:opacity-100"
        asChild
      >
        <Link id="skip-to-content" href="#content">
          Skip to content
        </Link>
      </Button>
      {children}
      <div className="fixed right-4 bottom-4 z-50">
        <Button asChild className="group">
          <a
            href="https://github.com/openstatusHQ/data-table-filters"
            target="_blank"
            rel="noreferrer"
          >
            <span className="mr-1">View GitHub Repo</span>
            <ArrowRight className="relative mb-[1px] inline h-4 w-0 transition-all group-hover:w-4" />
            <ChevronRight className="relative mb-[1px] inline h-4 w-4 transition-all group-hover:w-0" />
          </a>
        </Button>
      </div>
    </>
  );
}
