import { ModeToggle } from "@/components/theme/toggle-mode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  ChevronRight,
  Github,
  Globe,
  LoaderCircle,
  Twitter,
} from "lucide-react";
import Link from "next/link";

import * as React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* START TOP BANNER */}
      <div className="group bg-foreground text-background">
        <div className="container mx-auto px-4 py-2 sm:px-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <p className="flex items-center justify-center gap-2">
              <Link href="/i">
                <span>New Example: </span>
                <span className="underline underline-offset-4 decoration-dashed">
                  Infinite Scroll
                </span>{" "}
                <span className="mr-1">Now Available, Inspired by Vercel</span>
                <ArrowRight className="relative mb-[1px] inline h-4 w-0 transition-all group-hover:w-4" />
                <ChevronRight className="relative mb-[1px] inline h-4 w-4 transition-all group-hover:w-0" />
              </Link>
            </p>
          </div>
        </div>
      </div>
      {/* END TOP BANNER */}
      <main className="container mx-auto flex min-h-screen flex-col gap-4 p-4 sm:p-16">
        <div className="sm:sticky top-0 flex w-full max-w-7xl mx-auto">
          <div className="sm:absolute sm:top-2 sm:-right-12 gap-2 p-1 flex-1 flex sm:flex-col justify-center items-center">
            <ModeToggle />
            <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
              <a
                href="https://github.com/openstatusHQ/data-table-filters"
                target="_blank"
              >
                <Github />
              </a>
            </Button>
            <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
              <a href="https://twitter.com/openstatusHQ" target="_blank">
                <Twitter />
              </a>
            </Button>
            <Button variant="ghost" size="sm" className="w-9 px-0" asChild>
              <a href="https://openstatus.dev" target="_blank">
                <Globe />
              </a>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:gap-8 w-full max-w-7xl mx-auto relative min-h-full h-full rounded-lg border border-border/50 bg-background/50 p-4 backdrop-blur-[2px] sm:p-8">
          <div className="grid gap-1">
            <h1 className="text-3xl font-semibold text-foreground">
              Data-Table Filters
            </h1>
            <p className="text-muted-foreground">
              Powered by{" "}
              <a
                href="https://tanstack.com/table"
                target="_blank"
                className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
              >
                tanstack table
              </a>{" "}
              and{" "}
              <a
                href="https://ui.shadcn.com"
                target="_blank"
                className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
              >
                shadcn ui
              </a>{" "}
              with controls and{" "}
              <a
                href="http://cmdk.paco.me/"
                target="_blank"
                className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
              >
                cmdk
              </a>{" "}
              using search params via{" "}
              <a
                href="https://nuqs.47ng.com"
                target="_blank"
                className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
              >
                nuqs
              </a>
              . <br />
              Code available on{" "}
              <a
                href="https://github.com/openstatusHQ/data-table-filters"
                className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
              >
                GitHub
              </a>
              .
            </p>
          </div>
          <Separator />
          {/* ------------------- */}
          {children}
          {/* ------------------- */}
          <Badge
            variant="outline"
            className="absolute -top-2.5 left-4 bg-background sm:left-8"
          >
            Work in progress
          </Badge>
        </div>
        <p className="text-muted-foreground text-center">
          Powered by{" "}
          <a
            href="https://openstatus.dev"
            target="_blank"
            className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
          >
            OpenStatus
          </a>
        </p>
      </main>
    </>
  );
}
