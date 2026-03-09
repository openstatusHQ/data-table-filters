import type { Metadata } from "next";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import { ReactQueryProvider } from "@/providers/react-query";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import PlausibleProvider from "next-plausible";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export const metadata: Metadata = {
  ...defaultMetadata,
  twitter: { ...twitterMetadata },
  openGraph: { ...ogMetadata },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      {process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_REACT_SCAN === "true" ? (
        <head>
          <script
            src="https://unpkg.com/react-scan/dist/auto.global.js"
            async
          />
        </head>
      ) : null}
      <body className="min-h-screen bg-background antialiased">
        <PlausibleProvider domain="data-table.openstatus.dev">
          <ReactQueryProvider>
            <NuqsAdapter>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                {children}
                <Toaster richColors />
              </ThemeProvider>
            </NuqsAdapter>
          </ReactQueryProvider>
        </PlausibleProvider>
      </body>
    </html>
  );
}
