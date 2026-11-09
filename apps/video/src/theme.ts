// The dark tokens of apps/web/src/styles/globals.css, verbatim. Nothing here is
// a new colour: change the site's tokens and copy them over.
export const colors = {
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  muted: "oklch(0.269 0 0)",
  mutedForeground: "oklch(0.708 0 0)",
  border: "oklch(1 0 0 / 10%)",
  input: "oklch(1 0 0 / 15%)",
  chart2: "oklch(0.556 0 0)",
  warning: "oklch(0.705 0.187 47.602)",
  error: "oklch(0.637 0.208 25.326)",
} as const;

// --radius: 0.5rem, at the 2x the recording is captured at.
export const radius = 16;

export const fonts = {
  sans: "Geist",
  mono: "Geist Mono",
} as const;

// The site's production URL (BASE_URL in apps/web/src/lib/metadata).
export const SITE = "data-table.openstatus.dev";
