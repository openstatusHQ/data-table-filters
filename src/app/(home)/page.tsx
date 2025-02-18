import { cn } from "@/lib/utils";
import { default as NextLink } from "next/link";
import { Link } from "@/components/custom/link";
import { SocialsFooter } from "@/components/layout/socials-footer";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto w-full min-h-screen flex flex-col p-4 gap-8 sm:p-8 xl:gap-12 xl:p-12">
      <div className="px-2.5">
        <Hero />
      </div>
      <div className="border-dashed border-border border-b" />
      <div className="grid xl:grid-cols-2 gap-8 xl:gap-12">
        <NextLink href="/default" className="group flex flex-col gap-2.5">
          <div className="xl:aspect-video flex flex-col justify-center rounded-lg border border-border/70 group-hover:border-border bg-muted/40 group-hover:bg-muted/50 px-5 py-6 md:px-10 md:py-12">
            <div className="group-hover:scale-[1.02] transition-all duration-300 w-full flex flex-col gap-2.5">
              <div className="flex flex-1 flex-row items-end gap-2.5">
                <div className="-my-2 hidden sm:block">
                  <Controls className="w-24" />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <CommandInput />
                  <Toolbar />
                  <DefaultTable />
                  <Pagination />
                </div>
              </div>
            </div>
          </div>
          <div className="px-2.5 py-2">
            <p className="font-medium group-hover:underline">
              Default Data-Table
            </p>
            <p className="text-sm text-muted-foreground">
              A{" "}
              <span className="underline decoration-wavy underline-offset-2 decoration-yellow-500">
                simple
              </span>{" "}
              data-table with a{" "}
              <span className="font-medium text-foreground">client-side</span>{" "}
              filter and pagination.
            </p>
          </div>
        </NextLink>
        <div className="relative">
          <GuideBadgeLink className="absolute -top-3 right-3" />
          <NextLink href="/infinite" className="group flex flex-col gap-2.5">
            <div className="xl:aspect-video flex flex-col justify-center rounded-lg border border-border/70 group-hover:border-border bg-muted/40 group-hover:bg-muted/50 px-5 py-6 md:px-10 md:py-12">
              <div className="group-hover:scale-[1.02] transition-all duration-300 w-full flex flex-row items-end gap-2.5 sm:divide-x">
                <div className="hidden sm:block">
                  <Controls className="w-24 border-b border-transparent" />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-col gap-2 px-2.5">
                    <CommandInput />
                    <Timeline />
                    <Toolbar />
                  </div>
                  <GridTable className="border-l-1 md:border-l-0" />
                </div>
              </div>
            </div>
            <div className="px-2.5 py-2">
              <p className="font-medium group-hover:underline">
                Infinite Data-Table
              </p>
              <p className="text-sm text-muted-foreground">
                A{" "}
                <span className="underline decoration-wavy underline-offset-2 decoration-blue-500">
                  cooked
                </span>{" "}
                infinite scroll data-table with a{" "}
                <span className="font-medium text-foreground">server-side</span>{" "}
                filter and row selection.
              </p>
            </div>
          </NextLink>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <BlogPosts />
      </div>
      <div className="border-dashed border-border border-b" />
      <SocialsFooter />
    </div>
  );
}

function DefaultTable() {
  return (
    <div className="border border-border rounded-lg divide-y overflow-hidden">
      <div className="px-2.5 py-2 flex gap-2 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:last-child]:bg-foreground/60 hover:bg-muted">
        <div className="size-2.5 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm" />
        <div className="h-2.5 w-12 sm:w-24 rounded-sm" />
        <div className="h-2.5 w-16 rounded-sm" />
      </div>
      <div className="px-2.5 py-2 flex gap-2 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:last-child]:bg-foreground/60 hover:bg-muted">
        <div className="size-2.5 rounded-sm" />
        <div className="h-2.5 w-16 rounded-sm" />
        <div className="h-2.5 w-12 sm:w-24 rounded-sm" />
        <div className="h-2.5 w-16 rounded-sm" />
      </div>
      <div className="px-2.5 py-2 flex gap-2 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:last-child]:bg-foreground/60 hover:bg-muted">
        <div className="size-2.5 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm" />
        <div className="h-2.5 w-12 sm:w-24 rounded-sm" />
        <div className="h-2.5 w-16 rounded-sm" />
      </div>
      <div className="px-2.5 py-2 flex gap-2 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:last-child]:bg-foreground/60 hover:bg-muted">
        <div className="size-2.5 rounded-sm" />
        <div className="h-2.5 w-16 rounded-sm" />
        <div className="h-2.5 w-12 sm:w-24 rounded-sm" />
        <div className="h-2.5 w-16 rounded-sm" />
      </div>
    </div>
  );
}

function GridTable({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border border-border divide-y border-l-0 overflow-hidden",
        className
      )}
    >
      <div className="grid grid-cols-6 divide-x [&>*:nth-child(odd)>div]:bg-muted-foreground/30 [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:last-child>div]:ml-auto hover:bg-muted">
        <div className="px-2.5 py-2">
          <div className="size-2.5 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full sm:w-10 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm" />
        </div>
        <div className="px-2.5 py-2 col-span-2">
          <div className="h-2.5 w-full sm:w-20 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full sm:w-8 rounded-sm" />
        </div>
      </div>
      <div className="grid grid-cols-6 divide-x [&>*:nth-child(odd)>div]:bg-muted-foreground/30 [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:last-child>div]:ml-auto hover:bg-muted">
        <div className="px-2.5 py-2">
          <div className="size-2.5 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full sm:w-10 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm" />
        </div>
        <div className="px-2.5 py-2 col-span-2">
          <div className="h-2.5 w-full sm:w-20 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full sm:w-8 rounded-sm" />
        </div>
      </div>
      <div className="grid grid-cols-6 divide-x [&>*:nth-child(odd)>div]:bg-muted-foreground/30 [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:last-child>div]:ml-auto hover:bg-muted">
        <div className="px-2.5 py-2">
          <div className="size-2.5 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full sm:w-10 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm" />
        </div>
        <div className="px-2.5 py-2 col-span-2">
          <div className="h-2.5 w-full sm:w-20 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full sm:w-8 rounded-sm" />
        </div>
      </div>
      <div className="grid grid-cols-6 divide-x [&>*:nth-child(odd)>div]:bg-muted-foreground/30 [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:last-child>div]:ml-auto hover:bg-muted">
        <div className="px-2.5 py-2">
          <div className="size-2.5 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full sm:w-10 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm" />
        </div>
        <div className="px-2.5 py-2 col-span-2">
          <div className="h-2.5 w-full sm:w-20 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full sm:w-8 rounded-sm" />
        </div>
      </div>
      <div className="grid grid-cols-6 divide-x [&>*:nth-child(odd)>div]:bg-muted-foreground/30 [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:last-child>div]:ml-auto hover:bg-muted">
        <div className="px-2.5 py-2">
          <div className="size-2.5 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full sm:w-10 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm" />
        </div>
        <div className="px-2.5 py-2 col-span-2">
          <div className="h-2.5 w-full sm:w-20 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full sm:w-8 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

function CommandInput() {
  return (
    <div className="flex justify-between border border-border rounded-lg px-2.5 py-2 hover:bg-muted">
      <div className="flex gap-2.5">
        <div className="bg-foreground/70 h-2.5 w-12 rounded-sm" />
        <div className="bg-foreground/70 h-2.5 w-8 rounded-sm" />
      </div>
      <div className="bg-muted-foreground/40 h-2.5 w-4 rounded-sm" />
    </div>
  );
}

function Toolbar() {
  return (
    <div className="flex justify-between gap-2.5">
      <div className="bg-muted-foreground/40 h-2.5 w-8 rounded-sm" />
      <div className="bg-muted-foreground/40 h-2.5 w-2.5 rounded-sm" />
    </div>
  );
}

const BARS = 50;
function Timeline() {
  return (
    <div className="flex items-end gap-px">
      {Array.from({ length: BARS }).map((_, i) => {
        const height = ["h-2.5", "h-2", "h-1.5", "h-1"][
          Math.floor(Math.random() * 4)
        ];
        return (
          <div
            key={i}
            className={cn(
              "bg-muted-foreground/20 flex-1 rounded-sm hover:bg-muted-foreground/30",
              height
            )}
          />
        );
      })}
    </div>
  );
}

function Controls({ className }: { className?: string }) {
  return (
    <div className={cn("divide-y divide-transparent", className)}>
      <div className="py-2 flex flex-col gap-2">
        <div className="flex gap-2.5 justify-between">
          <div className="bg-foreground/50 h-2.5 w-10 rounded-sm" />
          <div className="bg-foreground/50 size-2.5 rounded-sm" />
        </div>
        <div className="bg-foreground/70 h-2.5 w-full rounded-sm" />
      </div>
      <div className="group/controls py-2 flex gap-2.5 justify-between">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
      <div className="group/controls py-2 flex gap-2.5 justify-between">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
      <div className="group/controls py-2 flex gap-2.5 justify-between">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
      <div className="group/controls py-2 flex gap-2.5 justify-between">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
      <div className="group/controls py-2 flex gap-2.5 justify-between">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
      <div className="group/controls py-2 flex gap-2.5 justify-between">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
    </div>
  );
}

function Pagination() {
  return (
    <div className="flex gap-2.5 justify-end">
      <div className="h-2.5 w-8 bg-muted-foreground/30 rounded-sm" />
      <div className="size-2.5 bg-foreground/50 rounded-sm" />
      <div className="size-2.5 bg-foreground/50 rounded-sm" />
      <div className="size-2.5 bg-foreground/70 rounded-sm" />
      <div className="size-2.5 bg-foreground/70 rounded-sm" />
    </div>
  );
}

function Hero() {
  return (
    <div className="flex flex-col-reverse items-start justify-between gap-8 sm:flex-row">
      <div className="max-w-4xl">
        <h1 className="font-bold tracking-tight text-foreground mb-4 text-3xl sm:text-4xl md:text-5xl text-balance">
          Powerful <span className="text-nowrap">Data-Table</span> for React
        </h1>
        {/* REMINDER: text-balance produces layout shifts on iOS here - maybe due to arrow svg? */}
        <p className="text-lg text-muted-foreground max-w-[650px]">
          Extensible, fast, and easy-to-use filters with{" "}
          <Link href="https://tanstack.com/table" className="text-nowrap">
            tanstack table
          </Link>
          ,{" "}
          <Link href="https://ui.shadcn.com" className="text-nowrap">
            shadcn/ui
          </Link>{" "}
          and search params via <Link href="https://nuqs.47ng.com">nuqs</Link>.
          Open Source on{" "}
          <Link href="https://github.com/openstatusHQ/data-table-filters">
            GitHub
          </Link>
          .
        </p>
      </div>
      <NextLink
        href="https://openstatus.dev"
        target="_blank"
        className="relative h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-full overflow-hidden border border-border border-dashed bg-white"
      >
        <Image
          src="/logos/OpenStatus.png"
          alt="OpenStatus Logo"
          className="aspect-square object-cover p-1"
          fill
        />
      </NextLink>
    </div>
  );
}

function BlogPosts() {
  return (
    <div className="flex flex-col gap-1">
      <time className="font-mono text-muted-foreground text-sm">
        {new Date("02-02-2025").toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </time>
      <p className="text-foreground/80">
        Blog post about features and caveats:{" "}
        <Link href="http://openstatus.dev/blog/data-table-redesign">
          The React data-table I always wanted
        </Link>
      </p>
    </div>
  );
}

function GuideBadgeLink({ className }: { className?: string }) {
  return (
    <NextLink href="/guide" className={cn("group", className)}>
      <Badge
        variant="outline"
        className="border-dashed border-border pr-1.5 bg-background"
      >
        Guide{" "}
        <ArrowRight className="relative mb-[1px] inline h-3 w-0 transition-all group-hover:w-3" />
        <ChevronRight className="relative mb-[1px] inline h-3 w-3 transition-all group-hover:w-0" />
      </Badge>
    </NextLink>
  );
}
