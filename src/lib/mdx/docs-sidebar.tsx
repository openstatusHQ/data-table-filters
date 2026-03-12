"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { SectionMeta } from "./get-content";

function SectionList({
  sections,
  currentSlug,
  onNavigate,
}: {
  sections: SectionMeta[];
  currentSlug: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1.5">
      {sections.map((section) => (
        <li
          key={section.slug}
          className={cn(
            "border-l-2",
            currentSlug === section.slug
              ? "border-foreground"
              : "border-transparent",
          )}
        >
          <Link
            href={`/docs/${section.slug}`}
            onClick={onNavigate}
            className={cn(
              "text-muted-foreground hover:text-foreground mr-1 ml-2 block rounded-sm p-0.5 text-sm transition-colors",
              currentSlug === section.slug && "text-foreground font-medium",
            )}
          >
            {section.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DocsSidebar({ sections }: { sections: SectionMeta[] }) {
  const pathname = usePathname();
  const currentSlug = pathname.split("/").pop() ?? "";
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="sticky top-10 hidden max-h-[calc(100vh-6rem)] overflow-y-auto md:block">
        <p className="mb-3 text-sm font-medium">Docs</p>
        <SectionList sections={sections} currentSlug={currentSlug} />
      </nav>

      {/* Mobile FAB + Sheet */}
      <div className="md:hidden">
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 left-4 z-40 h-12 w-12 rounded-full shadow-lg"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open docs navigation</span>
        </Button>

        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Docs</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6">
              <SectionList
                sections={sections}
                currentSlug={currentSlug}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
