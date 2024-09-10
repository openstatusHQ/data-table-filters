import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import { cn } from "@/lib/utils";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import PlausibleProvider from "next-plausible";

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
    images: ["/assets/data-table.png"],
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  openGraph: {
    type: "website",
    images: ["/assets/data-table.png"],
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
    <html lang="en">
      <PlausibleProvider domain="data-table.openstatus.dev">
        <body
          className={cn(
            "min-h-screen bg-background font-sans antialiased",
            fontSans.variable
          )}
        >
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </body>
      </PlausibleProvider>
    </html>
  );
}
