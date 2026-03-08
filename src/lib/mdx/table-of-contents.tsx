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
    <nav className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto text-sm xl:block">
      <p className="mb-3 font-medium">On this page</p>
      <ul className="space-y-1.5">
        {headings.map((heading) => (
          <li
            key={heading.slug}
            className="relative"
            style={{ paddingLeft: `${(heading.depth - 2) * 12}px` }}
          >
            {activeId === heading.slug && (
              <div className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full bg-foreground" />
            )}
            <a
              href={`#${heading.slug}`}
              className={cn(
                "mx-1 block truncate rounded-md py-0.5 pl-2 pr-1 text-muted-foreground transition-colors hover:text-foreground",
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
