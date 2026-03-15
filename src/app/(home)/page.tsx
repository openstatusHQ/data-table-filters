import { Link } from "@/components/custom/link";
import { SocialsFooter } from "@/components/layout/socials-footer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { default as NextLink } from "next/link";

export default function Home() {
  return (
    <div className="container mx-auto flex min-h-screen w-full flex-col gap-6 p-4 sm:p-6 xl:gap-8 xl:p-8">
      <div className="px-2.5">
        <Hero />
      </div>
      <div className="border-border border-b border-dashed" />
      <div className="grid gap-8 xl:grid-cols-2 xl:gap-12">
        <div className="relative">
          <Badge
            variant="outline"
            className="border-border bg-background absolute -top-3 right-3 border-dashed px-1.5 font-mono"
          >
            nuqs | zustand
          </Badge>
          <NextLink href="/infinite" className="group flex flex-col gap-2.5">
            <div className="border-border/70 bg-muted/40 group-hover:border-border group-hover:bg-muted/50 flex flex-col justify-center rounded-lg border px-5 py-6 md:px-10 md:py-12 xl:aspect-video">
              <div className="flex w-full flex-row items-end gap-2.5 transition-all duration-300 group-hover:scale-[1.02]">
                <div className="hidden sm:block">
                  <Controls className="w-24 border-b border-transparent!" />
                </div>
                <div className="flex flex-1 flex-col gap-2 sm:border-l">
                  <div className="flex flex-col gap-2 px-2.5">
                    <CommandInput />
                    <Timeline />
                    <Toolbar />
                  </div>
                  <GridTable className="border-l md:border-l-0" />
                </div>
              </div>
            </div>
            <div className="px-2.5 py-2">
              <p className="font-medium">Infinite Data-Table</p>
              <p className="text-muted-foreground text-sm">
                A{" "}
                <span className="relative inline-block font-medium text-green-700 italic transition-colors group-hover:text-green-50 dark:text-green-400 dark:group-hover:text-green-950">
                  <span className="absolute inset-0 scale-x-105 -skew-x-12 bg-green-500/10 transition-colors group-hover:bg-green-600 dark:bg-green-500/10 dark:group-hover:bg-green-400"></span>
                  <span className="relative">cooked&nbsp;</span>
                </span>{" "}
                infinite scroll data-table with a{" "}
                <span className="text-foreground font-medium">server-side</span>{" "}
                filter, row selection and live mode.
              </p>
            </div>
          </NextLink>
        </div>
        <div className="relative">
          <Badge
            variant="outline"
            className="border-border bg-background absolute -top-3 right-3 border-dashed px-1.5 font-mono"
          >
            nuqs | zustand
          </Badge>
          <NextLink href="/default" className="group flex flex-col gap-2.5">
            <div className="border-border/70 bg-muted/40 group-hover:border-border group-hover:bg-muted/50 flex flex-col justify-center rounded-lg border px-5 py-6 md:px-10 md:py-12 xl:aspect-video">
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
              <p className="font-medium">Default Data-Table</p>
              <p className="text-muted-foreground text-sm">
                A{" "}
                <span className="relative inline-block font-medium text-indigo-700 italic transition-colors group-hover:text-indigo-50 dark:text-indigo-400 dark:group-hover:text-indigo-950">
                  <span className="absolute inset-0 scale-x-105 -skew-x-12 bg-indigo-500/10 transition-colors group-hover:bg-indigo-600 dark:bg-indigo-500/10 dark:group-hover:bg-indigo-400"></span>
                  <span className="relative"> simple&nbsp;</span>
                </span>{" "}
                data-table with a{" "}
                <span className="text-foreground font-medium">client-side</span>{" "}
                filter and pagination.
              </p>
            </div>
          </NextLink>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <div className="grid gap-8 xl:grid-cols-2 xl:gap-12">
          <Changelog />
          <Examples />
        </div>
      </div>
      <div className="border-border border-b border-dashed" />
      <SocialsFooter />
    </div>
  );
}

function DefaultTable() {
  return (
    <div className="border-border divide-y overflow-hidden rounded-lg border">
      <div className="hover:bg-muted [&>*:last-child]:bg-foreground/60 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30 flex gap-2 px-2.5 py-2">
        <div className="size-2.5 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm sm:w-24" />
        <div className="h-2.5 w-16 rounded-sm" />
      </div>
      <div className="hover:bg-muted [&>*:last-child]:bg-foreground/60 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30 flex gap-2 px-2.5 py-2">
        <div className="size-2.5 rounded-sm" />
        <div className="h-2.5 w-16 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm sm:w-24" />
        <div className="h-2.5 w-16 rounded-sm" />
      </div>
      <div className="hover:bg-muted [&>*:last-child]:bg-foreground/60 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30 flex gap-2 px-2.5 py-2">
        <div className="size-2.5 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm" />
        <div className="h-2.5 w-12 rounded-sm sm:w-24" />
        <div className="h-2.5 w-16 rounded-sm" />
      </div>
      <div className="hover:bg-muted [&>*:last-child]:bg-foreground/60 [&>*:not(:last-child):nth-child(even)]:bg-foreground/70 [&>*:not(:last-child):nth-child(odd)]:bg-muted-foreground/30 flex gap-2 px-2.5 py-2">
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
        "border-border divide-y overflow-hidden border border-l-0",
        className,
      )}
    >
      <div className="hover:bg-muted [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:nth-child(odd)>div]:bg-muted-foreground/30 grid grid-cols-6 divide-x [&>*:last-child>div]:ml-auto">
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
      <div className="hover:bg-muted [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:nth-child(odd)>div]:bg-muted-foreground/30 grid grid-cols-6 divide-x [&>*:last-child>div]:ml-auto">
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
      <div className="hover:bg-muted [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:nth-child(odd)>div]:bg-muted-foreground/30 grid grid-cols-6 divide-x [&>*:last-child>div]:ml-auto">
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
      <div className="hover:bg-muted [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:nth-child(odd)>div]:bg-muted-foreground/30 grid grid-cols-6 divide-x [&>*:last-child>div]:ml-auto">
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
      <div className="hover:bg-muted [&>*:nth-child(even)>div]:bg-foreground/70 [&>*:nth-child(odd)>div]:bg-muted-foreground/30 grid grid-cols-6 divide-x [&>*:last-child>div]:ml-auto">
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
    <div className="border-border hover:bg-muted flex justify-between rounded-lg border px-2.5 py-2">
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
// Pre-generate heights to avoid Math.random() during render
const BAR_HEIGHTS = Array.from(
  { length: BARS },
  () => ["h-2.5", "h-2", "h-1.5", "h-1"][Math.floor(Math.random() * 4)],
);

function Timeline() {
  return (
    <div className="flex items-end gap-px">
      {BAR_HEIGHTS.map((height, i) => {
        return (
          <div
            key={i}
            className={cn(
              "bg-muted-foreground/20 hover:bg-muted-foreground/30 flex-1 rounded-sm",
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
    <div className={cn("divide-y divide-transparent!", className)}>
      <div className="flex flex-col gap-2 py-2">
        <div className="flex justify-between gap-2.5">
          <div className="bg-foreground/50 h-2.5 w-10 rounded-sm" />
          <div className="bg-foreground/50 size-2.5 rounded-sm" />
        </div>
        <div className="bg-foreground/70 h-2.5 w-full rounded-sm" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
      <div className="group/controls flex justify-between gap-2.5 py-2">
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 h-2.5 w-10 rounded-sm" />
        <div className="bg-muted-foreground/30 group-hover/controls:bg-muted-foreground/50 size-2.5 rounded-sm" />
      </div>
    </div>
  );
}

function Pagination() {
  return (
    <div className="flex justify-end gap-2.5">
      <div className="bg-muted-foreground/30 h-2.5 w-8 rounded-sm" />
      <div className="bg-foreground/50 size-2.5 rounded-sm" />
      <div className="bg-foreground/50 size-2.5 rounded-sm" />
      <div className="bg-foreground/70 size-2.5 rounded-sm" />
      <div className="bg-foreground/70 size-2.5 rounded-sm" />
    </div>
  );
}

function Hero() {
  return (
    <div className="flex flex-col-reverse items-start justify-between gap-8 sm:flex-row">
      <div className="max-w-4xl space-y-3">
        <h1 className="text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
          Powerful <span className="text-nowrap">Data-Table</span> for React
        </h1>
        {/* REMINDER: text-balance produces layout shifts on iOS here - maybe due to arrow svg? */}
        <h2 className="text-muted-foreground max-w-[900px] sm:text-xl">
          Extensible, fast, and easy-to-use filters with{" "}
          <Link href="https://tanstack.com/table" className="text-nowrap">
            tanstack table
          </Link>
          ,{" "}
          <Link href="https://ui.shadcn.com" className="text-nowrap">
            shadcn/ui
          </Link>{" "}
          and state management via{" "}
          <Link href="https://nuqs.47ng.com">nuqs</Link> (url-based) or{" "}
          <Link href="https://zustand.docs.pmnd.rs/getting-started/introduction">
            zustand
          </Link>{" "}
          (client-side). Open Source on{" "}
          <Link href="https://github.com/openstatusHQ/data-table-filters">
            GitHub
          </Link>
          .
        </h2>
        <p className="text-foreground max-w-[900px] text-balance italic sm:text-lg">
          <span className="mr-2">
            It&apos;s not a library. It&apos;s a playbook. Stop hand-rolling
            data tables. Copy proven patterns, install the agent skill,
            ship.{" "}
          </span>
          <NextLink
            href="/docs/introduction"
            className="group text-foreground hover:text-background relative inline-block font-medium"
          >
            <span className="bg-muted group-hover:bg-foreground absolute inset-0 scale-x-105 -skew-x-12"></span>
            <span className="relative">Learn more in the Docs.&nbsp;</span>
          </NextLink>
        </p>
      </div>
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
  );
}

const changelog: {
  date: Date;
  description: React.ReactNode;
}[] = [
  {
    date: new Date("03-14-2026"),
    description: (
      <>
        New <Link href="/docs/introduction">documentation</Link> page to help
        you get started
      </>
    ),
  },
  {
    date: new Date("03-30-2025"),
    description: (
      <>
        Blog post about vercel-edge-ping UI:{" "}
        <Link href="https://www.openstatus.dev/blog/openstatus-light-viewer">
          OpenStatus Light Viewer
        </Link>
      </>
    ),
  },
  {
    date: new Date("03-16-2025"),
    description: (
      <>
        Blog post about tanstack infinite query usage:{" "}
        <Link href="https://www.openstatus.dev/blog/live-mode-infinite-query">
          Live Mode
        </Link>
      </>
    ),
  },
  {
    date: new Date("02-02-2025"),
    description: (
      <>
        Blog post about features and caveats:{" "}
        <Link href="https://openstatus.dev/blog/data-table-redesign">
          The React data-table I always wanted
        </Link>
      </>
    ),
  },
];

function Changelog() {
  return (
    <div className="grid gap-2">
      <p className="font-medium">Changelog</p>
      <ul className="grid gap-2">
        {changelog.map((item, i) => {
          return (
            <li key={i} className="flex flex-col gap-0.5">
              <time className="text-muted-foreground font-mono text-sm">
                {item.date.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <p className="text-foreground/80">{item.description}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Examples() {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">More Examples</p>
      <ul
        role="list"
        className="marker:text-muted-foreground grid list-inside list-disc gap-2"
      >
        <li>
          <Link href="/light">OpenStatus Light Viewer</Link>
        </li>
        <li>
          <Link href="/builder">Table Builder</Link>
        </li>
        <li>
          <Link href="/drizzle">Drizzle ORM (Postgres)</Link>
        </li>
      </ul>
    </div>
  );
}
