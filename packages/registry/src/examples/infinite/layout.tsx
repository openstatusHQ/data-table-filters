"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import * as React from "react";

/**
 * The providers the example needs, scoped to this route so nothing in the root
 * layout has to change. Move them up to `app/layout.tsx` once more than one
 * route uses them.
 *
 * `ThemeProvider` backs the theme selector in the footer. It renders its
 * children untouched when one is already mounted above it, so keeping it here
 * is safe in an app that sets up dark mode in the root layout. Add
 * `suppressHydrationWarning` to `<html>` in `app/layout.tsx` — the class it
 * writes before hydration is a mismatch React warns about otherwise.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
