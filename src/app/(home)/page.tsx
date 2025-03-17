import { Link } from "@/components/custom/link";
import { SocialsFooter } from "@/components/layout/socials-footer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";
import Image from "next/image";
import { default as NextLink } from "next/link";

export default function Home() {
  return (
    <div className="container mx-auto flex min-h-screen w-full flex-col gap-8 p-4 sm:p-8 xl:gap-12 xl:p-12">
      <div className="px-2.5">
        <Hero />
      </div>
      <div className="border-b border-dashed border-border" />
      <div className="grid gap-8 xl:grid-cols-2 xl:gap-12">
        <NextLink href="/default" className="group flex flex-col gap-2.5">
          <div className="flex flex-col justify-center rounded-lg border border-border/70 bg-muted/40 px-5 py-6 group-hover:border-border group-hover:bg-muted/50 md:px-10 md:py-12 xl:aspect-video">
            <div className="flex w-full flex-col gap-2.5 transition-all duration-300 group-hover:scale-[1.02]">
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
              <span className="underline decoration-yellow-500 decoration-wavy underline-offset-2">
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
            <div className="flex flex-col justify-center rounded-lg border border-border/70 bg-muted/40 px-5 py-6 group-hover:border-border group-hover:bg-muted/50 md:px-10 md:py-12 xl:aspect-video">
              <div className="flex w-full flex-row items-end gap-2.5 transition-all duration-300 group-hover:scale-[1.02] sm:divide-x">
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
                <span className="underline decoration-blue-500 decoration-wavy underline-offset-2">
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
      <div className="border-b border-dashed border-border" />
      <SocialsFooter />
    </div>
  );
}

function DefaultTable() {
  return (
    <div className="divide-y overflow-hidden rounded-lg border border-border">
      <div className="flex gap-2 px-2.5 py-2 hover:bg-muted [&>*:last-child]:bg-foreground/60 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30">
        <div className="size-2.5 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm sm:w-24" />
        <div className="h-2.5 w-16 rounded-sm" />
      </div>
      <div className="flex gap-2 px-2.5 py-2 hover:bg-muted [&>*:last-child]:bg-foreground/60 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30">
        <div className="size-2.5 rounded-sm" />
        <div className="h-2.5 w-16 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm sm:w-24" />
        <div className="h-2.5 w-16 rounded-sm" />
      </div>
      <div className="flex gap-2 px-2.5 py-2 hover:bg-muted [&>*:last-child]:bg-foreground/60 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30">
        <div className="size-2.5 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm sm:w-24" />
        <div className="h-2.5 w-16 rounded-sm" />
      </div>
      <div className="flex gap-2 px-2.5 py-2 hover:bg-muted [&>*:last-child]:bg-foreground/60 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30">
        <div className="size-2.5 rounded-sm" />
        <div className="h-2.5 w-16 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm sm:w-24" />
        <div className="h-2.5 w-16 rounded-sm" />
      </div>
    </div>
  );
}

function GridTable({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "divide-y overflow-hidden border border-l-0 border-border",
        className,
      )}
    >
      <div className="grid grid-cols-6 divide-x hover:bg-muted [&>*:last-child>div]:ml-auto [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:nth-child(odd)>div]:bg-muted-foreground/30">
        <div className="px-2.5 py-2">
          <div className="size-2.5 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-10" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm" />
        </div>
        <div className="col-span-2 px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-20" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-8" />
        </div>
      </div>
      <div className="grid grid-cols-6 divide-x hover:bg-muted [&>*:last-child>div]:ml-auto [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:nth-child(odd)>div]:bg-muted-foreground/30">
        <div className="px-2.5 py-2">
          <div className="size-2.5 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-10" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm" />
        </div>
        <div className="col-span-2 px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-20" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-8" />
        </div>
      </div>
      <div className="grid grid-cols-6 divide-x hover:bg-muted [&>*:last-child>div]:ml-auto [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:nth-child(odd)>div]:bg-muted-foreground/30">
        <div className="px-2.5 py-2">
          <div className="size-2.5 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-10" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm" />
        </div>
        <div className="col-span-2 px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-20" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-8" />
        </div>
      </div>
      <div className="grid grid-cols-6 divide-x hover:bg-muted [&>*:last-child>div]:ml-auto [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:nth-child(odd)>div]:bg-muted-foreground/30">
        <div className="px-2.5 py-2">
          <div className="size-2.5 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-10" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm" />
        </div>
        <div className="col-span-2 px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-20" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-8" />
        </div>
      </div>
      <div className="grid grid-cols-6 divide-x hover:bg-muted [&>*:last-child>div]:ml-auto [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:nth-child(odd)>div]:bg-muted-foreground/30">
        <div className="px-2.5 py-2">
          <div className="size-2.5 rounded-sm" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-10" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm" />
        </div>
        <div className="col-span-2 px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-20" />
        </div>
        <div className="px-2.5 py-2">
          <div className="h-2.5 w-full rounded-sm sm:w-8" />
        </div>
      </div>
    </div>
  );
}

function CommandInput() {
  return (
    <div className="flex justify-between rounded-lg border border-border px-2.5 py-2 hover:bg-muted">
      <div className="flex gap-2.5">
        <div className="h-2.5 w-12 rounded-sm bg-foreground/70" />
        <div className="h-2.5 w-8 rounded-sm bg-foreground/70" />
      </div>
      <div className="h-2.5 w-4 rounded-sm bg-muted-foreground/40" />
    </div>
  );
}

function Toolbar() {
  return (
    <div className="flex justify-between gap-2.5">
      <div className="h-2.5 w-8 rounded-sm bg-muted-foreground/40" />
      <div className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/40" />
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
              "flex-1 rounded-sm bg-muted-foreground/20 hover:bg-muted-foreground/30",
              height,
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
      <div className="flex flex-col gap-2 py-2">
        <div className="flex justify-between gap-2.5">
          <div className="h-2.5 w-10 rounded-sm bg-foreground/50" />
          <div className="size-2.5 rounded-sm bg-foreground/50" />
        </div>
        <div className="h-2.5 w-full rounded-sm bg-foreground/70" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="h-2.5 w-10 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
        <div className="size-2.5 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="h-2.5 w-10 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
        <div className="size-2.5 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="h-2.5 w-10 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
        <div className="size-2.5 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="h-2.5 w-10 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
        <div className="size-2.5 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="h-2.5 w-10 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
        <div className="size-2.5 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="h-2.5 w-10 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
        <div className="size-2.5 rounded-sm bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50" />
      </div>
    </div>
  );
}

function Pagination() {
  return (
    <div className="flex justify-end gap-2.5">
      <div className="h-2.5 w-8 rounded-sm bg-muted-foreground/30" />
      <div className="size-2.5 rounded-sm bg-foreground/50" />
      <div className="size-2.5 rounded-sm bg-foreground/50" />
      <div className="size-2.5 rounded-sm bg-foreground/70" />
      <div className="size-2.5 rounded-sm bg-foreground/70" />
    </div>
  );
}

function Hero() {
  return (
    <div className="flex flex-col-reverse items-start justify-between gap-8 sm:flex-row">
      <div className="max-w-4xl">
        <h1 className="mb-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Powerful <span className="text-nowrap">Data-Table</span> for React
        </h1>
        {/* REMINDER: text-balance produces layout shifts on iOS here - maybe due to arrow svg? */}
        <p className="max-w-[650px] text-lg text-muted-foreground">
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
        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-dashed border-border bg-white sm:h-12 sm:w-12"
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
    <ul className="grid gap-2">
      <li className="flex flex-col gap-0.5">
        <time className="font-mono text-sm text-muted-foreground">
          {new Date("03-16-2025").toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </time>
        <p className="text-foreground/80">
          Blog post about tanstack infinite query usage:{" "}
          <Link href="https://www.openstatus.dev/blog/live-mode-infinite-query">
            Live Mode
          </Link>
        </p>
      </li>
      <li className="flex flex-col gap-0.5">
        <time className="font-mono text-sm text-muted-foreground">
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
      </li>
    </ul>
  );
}

function GuideBadgeLink({ className }: { className?: string }) {
  return (
    <NextLink href="/guide" className={cn("group", className)}>
      <Badge
        variant="outline"
        className="border-dashed border-border bg-background pr-1.5"
      >
        Guide{" "}
        <ArrowRight className="relative mb-[1px] inline h-3 w-0 transition-all group-hover:w-3" />
        <ChevronRight className="relative mb-[1px] inline h-3 w-3 transition-all group-hover:w-0" />
      </Badge>
    </NextLink>
  );
}
