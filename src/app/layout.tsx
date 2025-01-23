import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import { cn } from "@/lib/utils";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import PlausibleProvider from "next-plausible";
import { ReactQueryProvider } from "@/providers/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const TITLE = "Data Table | OpenStatus";
const DESCRIPTION =
  "Powered by tanstack table and shadcn ui with controls and cmdk using search params as state via nuqs.";

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
    <html lang="en" suppressHydrationWarning>
      <PlausibleProvider domain="data-table.openstatus.dev">
        <ReactQueryProvider>
          <NuqsAdapter>
            <body
              className={cn(
                "min-h-screen bg-background font-sans antialiased",
                fontSans.variable
              )}
            >
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
              >
                {children}
                <Toaster richColors />
              </ThemeProvider>
            </body>
          </NuqsAdapter>
        </ReactQueryProvider>
      </PlausibleProvider>
    </html>
  );
}
