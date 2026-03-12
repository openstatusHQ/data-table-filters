"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { TOCItem } from "./get-content";

export function TableOfContents({ headings }: { headings: TOCItem[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const elements = headings
      .map((h) => document.getElementById(h.slug))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "0px 0px -80% 0px" },
    );

    for (const el of elements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  return (
    <nav className="sticky top-10 hidden max-h-[calc(100vh-6rem)] overflow-y-auto text-sm xl:block">
      <p className="mb-3 font-medium">On this page</p>
      <ul className="space-y-1.5">
        {headings.map((heading) => (
          <li
            key={heading.slug}
            className={cn(
              "border-l-2",
              activeId === heading.slug
                ? "border-foreground"
                : "border-transparent",
            )}
            style={{ paddingLeft: `${(heading.depth - 2) * 12}px` }}
          >
            <a
              href={`#${heading.slug}`}
              className={cn(
                "ml-2 mr-1 block truncate rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground",
                activeId === heading.slug && "font-medium text-foreground",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
