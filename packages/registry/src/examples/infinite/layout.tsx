"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import * as React from "react";

/**
 * The two providers the table needs, scoped to this route so nothing in the
 * root layout has to change. Move them up to `app/layout.tsx` once more than
 * one route uses them.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>{children}</NuqsAdapter>
    </QueryClientProvider>
  );
}
