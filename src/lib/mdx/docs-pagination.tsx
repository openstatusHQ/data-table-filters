import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SectionMeta } from "./get-content";

export function DocsPagination({
  sections,
  currentSlug,
}: {
  sections: SectionMeta[];
  currentSlug: string;
}) {
  const currentIndex = sections.findIndex((s) => s.slug === currentSlug);
  const prev = currentIndex > 0 ? sections[currentIndex - 1] : null;
  const next =
    currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;

  return (
    <div className="not-prose border-border flex items-center justify-between gap-4 border-t border-dashed pt-6">
      {prev ? (
        <Link
          href={`/docs/${prev.slug}`}
          className="group text-muted-foreground hover:text-foreground flex items-center text-sm transition-colors"
        >
          <ChevronLeft className="relative mb-px inline h-4 w-4 transition-all group-hover:w-0" />
          <ArrowLeft className="relative mb-px inline h-4 w-0 transition-all group-hover:w-4" />
          <span>{prev.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className="group text-muted-foreground hover:text-foreground flex items-center text-sm transition-colors"
        >
          <span>{next.title}</span>
          <ArrowRight className="relative mb-px inline h-4 w-0 transition-all group-hover:w-4" />
          <ChevronRight className="relative mb-px inline h-4 w-4 transition-all group-hover:w-0" />
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
