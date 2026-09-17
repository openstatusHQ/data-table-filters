import { Bluesky } from "@/components/icons/bluesky";
import { Github } from "@/components/icons/github";
import { X } from "@/components/icons/x";
import {
  Bug,
  Database,
  Globe,
  Home,
  Infinity,
  Laptop,
  Moon,
  Sparkles,
  Sun,
  Table,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type * as React from "react";

type Icon = LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>>;

/** One row in the ⌘K palette besides the docs: a page, a link, or a setting. */
export type PaletteAction = {
  label: string;
  icon: Icon;
  /** Words the search matches besides the label — "twitter" for X. */
  keywords?: string[];
} & (
  | { href: string; external?: boolean; theme?: never }
  | { theme: "light" | "dark" | "system"; href?: never; external?: never }
);

export type PaletteGroup = { heading: string; actions: PaletteAction[] };

export const REPO_URL = "https://github.com/openstatusHQ/data-table-filters";

/**
 * Everything the palette offers when there is no query, in the order it is
 * listed. The docs sections are a group of their own, rendered between
 * "Pages" and "Links" by the palette, since they come from the content dir.
 */
export const PALETTE_GROUPS: PaletteGroup[] = [
  {
    heading: "Pages",
    actions: [
      { label: "Home", href: "/", icon: Home, keywords: ["start", "landing"] },
      {
        label: "Infinite Data-Table",
        href: "/infinite",
        icon: Infinity,
        keywords: ["example", "scroll", "logs"],
      },
      {
        label: "Default Data-Table",
        href: "/default",
        icon: Table,
        keywords: ["example", "client", "pagination"],
      },
      {
        label: "Zero Config (Auto Inferred)",
        href: "/auto",
        icon: Zap,
        keywords: ["example", "schema", "DataTableAuto"],
      },
      {
        label: "Drizzle ORM (Postgres)",
        href: "/drizzle",
        icon: Database,
        keywords: ["example", "server", "sql", "database"],
      },
      {
        label: "Table Builder",
        href: "/builder",
        icon: Sparkles,
        keywords: ["example", "ai", "generate", "describe"],
      },
      {
        label: "OpenStatus Light Viewer",
        href: "/light",
        icon: Globe,
        keywords: ["example", "monitor"],
      },
    ],
  },
  {
    heading: "Links",
    actions: [
      {
        label: "GitHub",
        href: REPO_URL,
        external: true,
        icon: Github,
        keywords: ["repo", "repository", "source", "star"],
      },
      {
        label: "Report an issue",
        href: `${REPO_URL}/issues/new`,
        external: true,
        icon: Bug,
        keywords: ["bug", "feedback", "github"],
      },
      {
        label: "X",
        href: "https://x.com/openstatusHQ",
        external: true,
        icon: X,
        keywords: ["twitter", "openstatus", "follow"],
      },
      {
        label: "Bluesky",
        href: "https://bsky.app/profile/openstatus.dev",
        external: true,
        icon: Bluesky,
        keywords: ["bsky", "openstatus", "follow"],
      },
    ],
  },
  {
    heading: "Appearance",
    actions: [
      {
        label: "Light",
        theme: "light",
        icon: Sun,
        keywords: ["theme", "appearance", "mode", "toggle"],
      },
      {
        label: "Dark",
        theme: "dark",
        icon: Moon,
        keywords: ["theme", "appearance", "mode", "toggle"],
      },
      {
        label: "System",
        theme: "system",
        icon: Laptop,
        keywords: ["theme", "appearance", "mode", "toggle", "auto"],
      },
    ],
  },
];

/**
 * The groups that have a row matching `query`, each cut down to those rows.
 * Empty query, every group in full. A row matches when every word of the
 * query is a substring of its label or one of its keywords, so "dark theme"
 * finds Dark and "twitter" finds X.
 */
export function filterPaletteGroups(
  groups: PaletteGroup[],
  query: string,
): PaletteGroup[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return groups;

  return groups
    .map((group) => ({
      heading: group.heading,
      actions: group.actions.filter((action) => {
        const haystack = [action.label, ...(action.keywords ?? [])].map(
          (text) => text.toLowerCase(),
        );
        return words.every((word) =>
          haystack.some((text) => text.includes(word)),
        );
      }),
    }))
    .filter((group) => group.actions.length > 0);
}
