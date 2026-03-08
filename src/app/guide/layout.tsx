import { Button } from "@/components/ui/button";
import { getAllSections, GuideSidebar } from "@/lib/mdx";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default async function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sections = await getAllSections("guide");

  return (
    <main className="container mx-auto flex min-h-screen w-full flex-col gap-6 p-4 sm:p-6 xl:gap-8 xl:p-8">
      <div className="flex items-center justify-between gap-2 pr-2.5">
        <Button asChild variant="link">
          <Link href="/">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        <Link
          href="https://openstatus.dev"
          target="_blank"
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-dashed border-border bg-white sm:h-12 sm:w-12"
        >
          <Image
            src="/logos/OpenStatus.png"
            alt="OpenStatus Logo"
            className="aspect-square object-cover p-1"
            fill
          />
        </Link>
      </div>
      <div className="border-b border-dashed border-border" />
      <div
        className={cn(
          "relative mx-auto max-w-6xl",
          "md:grid md:grid-cols-[220px_1fr] md:gap-8",
          "xl:grid-cols-[220px_1fr_220px]",
        )}
      >
        <GuideSidebar sections={sections} />
        {children}
      </div>
    </main>
  );
}
