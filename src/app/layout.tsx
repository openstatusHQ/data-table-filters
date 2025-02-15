import type { Metadata } from "next";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import PlausibleProvider from "next-plausible";
import { ReactQueryProvider } from "@/providers/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

const TITLE = "Powerful Data-Table for React | OpenStatus";
const DESCRIPTION =
  "Flexible, fast, and easy-to-use filters with tanstack table, shadcn/ui and search params via nuqs.";

export const metadata: Metadata = {
  metadataBase: new URL("https://data-table.openstatus.dev"),
  title: TITLE,
  description: DESCRIPTION,
  twitter: {
    images: ["/assets/data-table-infinite.png"],
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  openGraph: {
    type: "website",
    images: ["/assets/data-table-infinite.png"],
    title: TITLE,
    description: DESCRIPTION,
  },
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
      {process.env.NODE_ENV === "development" ? (
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
