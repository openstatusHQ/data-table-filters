// Simple seeded PRNG (LCG) for deterministic data generation
function createRng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

const CATEGORIES = ["tech", "design", "news", "tools", "reference"] as const;

const TAGS = [
  "frontend",
  "backend",
  "ai",
  "oss",
  "tutorial",
  "video",
  "blog",
  "docs",
  "api",
  "devtools",
] as const;

const BOOKMARK_ENTRIES: { name: string; url: string }[] = [
  { name: "React Performance Patterns", url: "https://reactpatterns.dev" },
  { name: "CSS Grid Complete Guide", url: "https://css-grid.guide" },
  { name: "TypeScript Deep Dive", url: "https://ts-deepdive.com" },
  { name: "Tailwind CSS Docs", url: "https://tailwindcss.com/docs" },
  { name: "Next.js App Router Guide", url: "https://nextjs-guide.dev" },
  { name: "TanStack Table Docs", url: "https://tanstack.com/table" },
  { name: "Drizzle ORM Quickstart", url: "https://orm.drizzle.team" },
  { name: "Zustand State Management", url: "https://zustand-docs.dev" },
  { name: "Vitest Testing Framework", url: "https://vitest.dev" },
  { name: "Figma Design System Tips", url: "https://figma-tips.design" },
  { name: "Vercel Deployment Guide", url: "https://vercel.com/guides" },
  { name: "PostgreSQL Performance Tuning", url: "https://pgtuning.dev" },
  { name: "Radix UI Primitives", url: "https://radix-ui.com" },
  { name: "shadcn/ui Components", url: "https://ui.shadcn.com" },
  { name: "MDN Web Docs", url: "https://developer.mozilla.org" },
  { name: "Node.js Best Practices", url: "https://node-best.dev" },
  { name: "Docker Cheatsheet", url: "https://docker-cheat.dev" },
  { name: "Git Branching Strategies", url: "https://git-branching.guide" },
  { name: "Web Accessibility Handbook", url: "https://a11y-handbook.org" },
  { name: "GraphQL Schema Design", url: "https://graphql-schema.guide" },
  { name: "Rust for JS Developers", url: "https://rust-for-js.dev" },
  { name: "Python Data Science Toolkit", url: "https://py-data-toolkit.org" },
  { name: "AWS Lambda Patterns", url: "https://lambda-patterns.dev" },
  { name: "Kubernetes Quick Reference", url: "https://k8s-quickref.io" },
  { name: "Redis Caching Strategies", url: "https://redis-cache.guide" },
  { name: "WebSocket Real-Time Guide", url: "https://ws-realtime.dev" },
  { name: "OAuth 2.0 Simplified", url: "https://oauth-simple.dev" },
  { name: "SVG Animation Cookbook", url: "https://svg-animations.art" },
  { name: "Framer Motion Examples", url: "https://framer-examples.dev" },
  { name: "Storybook Component Docs", url: "https://storybook.js.org" },
  { name: "ESLint Config Guide", url: "https://eslint-config.guide" },
  { name: "Prettier Formatting Rules", url: "https://prettier-rules.dev" },
  { name: "pnpm vs npm vs yarn", url: "https://pkg-managers.dev" },
  { name: "Vite Build Tool Docs", url: "https://vite.dev/guide" },
  { name: "Turborepo Monorepo Setup", url: "https://turbo-setup.dev" },
  { name: "Zod Validation Library", url: "https://zod.dev" },
  { name: "tRPC End-to-End Types", url: "https://trpc.io" },
  { name: "Prisma ORM Guide", url: "https://prisma.io/docs" },
  { name: "Supabase Getting Started", url: "https://supabase.com/docs" },
  { name: "PlanetScale Database Guide", url: "https://planetscale-guide.dev" },
  { name: "Cloudflare Workers Intro", url: "https://cf-workers.dev" },
  { name: "Deno Fresh Framework", url: "https://fresh.deno.dev" },
  { name: "Bun Runtime Overview", url: "https://bun.sh/docs" },
  { name: "Astro Static Site Builder", url: "https://astro.build/docs" },
  { name: "SvelteKit Full-Stack Guide", url: "https://kit.svelte.dev" },
  { name: "Remix Data Loading Patterns", url: "https://remix-patterns.dev" },
  { name: "Hono Edge Framework", url: "https://hono.dev" },
  { name: "htmx Hypermedia Approach", url: "https://htmx.org/docs" },
  { name: "Alpine.js Lightweight Interactivity", url: "https://alpinejs.dev" },
  { name: "Three.js 3D Web Graphics", url: "https://threejs.org/docs" },
  { name: "D3.js Data Visualization", url: "https://d3js.org" },
  { name: "Chart.js Simple Charts", url: "https://chartjs.org/docs" },
  { name: "Recharts React Charting", url: "https://recharts.org" },
  { name: "Mapbox GL JS Guide", url: "https://mapbox-guide.dev" },
  { name: "Stripe Payment Integration", url: "https://stripe.com/docs" },
  { name: "Resend Email API", url: "https://resend.com/docs" },
  { name: "Upstash Serverless Redis", url: "https://upstash.com/docs" },
  { name: "Clerk Auth for Next.js", url: "https://clerk.com/docs" },
  { name: "Auth.js Authentication", url: "https://authjs.dev" },
  { name: "Sentry Error Monitoring", url: "https://docs.sentry.io" },
  { name: "PostHog Product Analytics", url: "https://posthog.com/docs" },
  { name: "Linear Issue Tracking", url: "https://linear.app/docs" },
  { name: "Notion API Reference", url: "https://developers.notion.com" },
  { name: "Slack Bot Development", url: "https://api.slack.com" },
  { name: "GitHub Actions CI/CD", url: "https://github-actions.guide" },
  { name: "Playwright E2E Testing", url: "https://playwright.dev" },
  { name: "Cypress Component Testing", url: "https://cypress.io/docs" },
  { name: "React Testing Library", url: "https://testing-library.com" },
  { name: "MSW Mock Service Worker", url: "https://mswjs.io" },
  { name: "Chromatic Visual Testing", url: "https://chromatic.com/docs" },
  { name: "Lottie Web Animations", url: "https://lottie-web.dev" },
  { name: "GSAP Animation Platform", url: "https://gsap.com/docs" },
  { name: "Sass Preprocessor Guide", url: "https://sass-lang.com/guide" },
  { name: "PostCSS Plugin Ecosystem", url: "https://postcss.org" },
  { name: "CSS Modules Best Practices", url: "https://css-modules.guide" },
  { name: "Emotion Styled Components", url: "https://emotion.sh/docs" },
  { name: "Stitches CSS-in-JS", url: "https://stitches.dev" },
  { name: "Panda CSS Zero-Runtime", url: "https://panda-css.com" },
  { name: "UnoCSS Instant Engine", url: "https://unocss.dev" },
  { name: "Open Props CSS Variables", url: "https://open-props.style" },
  { name: "Color Theory for UI Design", url: "https://color-theory.design" },
  { name: "Typography Scale Calculator", url: "https://type-scale.com" },
  { name: "Responsive Design Patterns", url: "https://responsive.design" },
  { name: "Dark Mode Implementation", url: "https://dark-mode.guide" },
  { name: "Intersection Observer API", url: "https://intersection-obs.dev" },
  { name: "Web Workers Guide", url: "https://web-workers.guide" },
  { name: "Service Worker Offline", url: "https://sw-offline.dev" },
  { name: "IndexedDB Storage Guide", url: "https://indexeddb.guide" },
  { name: "Web Crypto API Reference", url: "https://web-crypto.guide" },
  { name: "WebGL Fundamentals", url: "https://webgl-fundamentals.org" },
  { name: "WASM Getting Started", url: "https://wasm-start.dev" },
  { name: "Edge Computing Overview", url: "https://edge-computing.guide" },
  { name: "Microservices Architecture", url: "https://microservices.guide" },
  { name: "Event-Driven Design", url: "https://event-driven.dev" },
  { name: "Domain-Driven Design Intro", url: "https://ddd-intro.dev" },
  { name: "Clean Architecture in TS", url: "https://clean-arch-ts.dev" },
  { name: "SOLID Principles Guide", url: "https://solid-principles.dev" },
  { name: "Design Patterns Illustrated", url: "https://patterns.dev" },
  { name: "Refactoring Techniques", url: "https://refactoring.guru" },
  { name: "Code Review Best Practices", url: "https://code-review.guide" },
  { name: "Technical Writing Guide", url: "https://tech-writing.dev" },
  { name: "Open Source Contributing", url: "https://oss-contributing.guide" },
];

const NOW = new Date("2026-03-20T12:00:00Z").getTime();
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function generateBookmarks(count: number) {
  const rng = createRng(42);
  const entries = BOOKMARK_ENTRIES;

  return Array.from({ length: count }, (_, i) => {
    const entry = entries[i % entries.length]!;
    const suffix =
      i >= entries.length ? ` ${Math.floor(i / entries.length) + 1}` : "";

    const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)]!;
    const rating = Math.floor(rng() * 5) + 1;
    const favorite = rng() < 0.2;

    // Pick 1-3 random tags
    const tagCount = Math.floor(rng() * 3) + 1;
    const shuffled = [...TAGS].sort(() => rng() - 0.5);
    const tags = shuffled.slice(0, tagCount);

    // Spread timestamps over last 90 days
    const offset = Math.floor(rng() * NINETY_DAYS_MS);
    const marked_at = new Date(NOW - offset).toISOString();

    return {
      favorite,
      name: `${entry.name}${suffix}`,
      url: entry.url,
      category,
      rating,
      marked_at,
      tags,
    };
  });
}

export const bookmarks = generateBookmarks(200);
