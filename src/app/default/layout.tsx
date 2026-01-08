import { SocialsFooter } from "@/components/layout/socials-footer";
import * as React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container mx-auto flex min-h-screen flex-col gap-4 p-4 sm:p-8">
      <div className="relative mx-auto flex h-full min-h-full w-full max-w-7xl flex-col gap-4 rounded-lg border border-border/50 bg-background/50 p-4 backdrop-blur-[2px] sm:gap-8 sm:p-8">
        {children}
      </div>
      <SocialsFooter />
    </main>
  );
}
