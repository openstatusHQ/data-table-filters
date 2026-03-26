import { Link } from "@/components/custom/link";
import { SocialsFooter } from "@/components/layout/socials-footer";
import { Button } from "@/components/ui/button";
import { DocsSidebar, getAllSections } from "@/lib/mdx";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sections = await getAllSections("docs");

  return (
    <main className="container mx-auto flex min-h-screen w-full flex-col gap-6 p-4 sm:p-6 xl:gap-8 xl:p-8">
      <div className="flex items-center justify-between gap-2 pr-2.5">
        <Link href="/">
          <ChevronLeft className="relative mb-px inline h-4 w-4 transition-all group-hover:w-0" />
          <ArrowLeft className="relative mb-px inline h-4 w-0 transition-all group-hover:w-4" />
          Back
        </Link>
        <NextLink
          href="https://openstatus.dev"
          target="_blank"
          className="border-border relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-dashed bg-white sm:h-12 sm:w-12"
        >
          <Image
            src="/logos/OpenStatus.png"
            alt="OpenStatus Logo"
            className="aspect-square object-cover p-1"
            fill
          />
        </NextLink>
      </div>
      <div className="border-border border-b border-dashed" />
      <div
        className={cn(
          "relative mx-auto w-full max-w-6xl flex-1",
          "md:grid md:grid-cols-[220px_1fr] md:gap-8",
          "xl:grid-cols-[220px_1fr_220px]",
        )}
      >
        <DocsSidebar sections={sections} />
        {children}
      </div>
      <div className="border-border border-b border-dashed" />
      <SocialsFooter />
    </main>
  );
}
