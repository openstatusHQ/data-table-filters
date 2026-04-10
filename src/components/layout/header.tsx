import { Link } from "@/components/custom/link";
import { DocsSearch, SectionMeta } from "@/lib/mdx";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { Github } from "../icons/github";
import { Button } from "../ui/button";

interface HeaderProps {
  page: "home" | "docs";
  sections: SectionMeta[];
}

export function Header({ page, sections }: HeaderProps) {
  return (
    <header className="flex min-w-0 items-center justify-between gap-4">
      <div>
        {page !== "home" ? (
          <Link href="/">
            <ChevronLeft className="relative mb-px inline h-4 w-4 transition-all group-hover:w-0" />
            <ArrowLeft className="relative mb-px inline h-4 w-0 transition-all group-hover:w-4" />
            Back
          </Link>
        ) : undefined}
      </div>
      <div className="flex min-w-0 items-center gap-2.5">
        <div>
          <Button variant="ghost" className="group hidden sm:flex" asChild>
            <NextLink href="https://github.com/openstatusHQ/data-table-filters">
              <Github />
              <span className="text-muted-foreground group-hover:text-foreground font-mono">
                1.9k
              </span>
            </NextLink>
          </Button>
        </div>
        <div className="sm:w-48">
          <DocsSearch sections={sections} />
        </div>
        <NextLink
          href="https://openstatus.dev"
          target="_blank"
          className="border-border relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-dashed bg-white"
        >
          <Image
            src="/logos/OpenStatus.png"
            alt="OpenStatus Logo"
            className="aspect-square object-cover p-1"
            fill
          />
        </NextLink>
      </div>
    </header>
  );
}
