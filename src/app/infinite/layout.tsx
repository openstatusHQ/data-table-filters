import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
