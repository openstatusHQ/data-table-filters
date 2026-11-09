# video

A Remotion promo for the headless table (`/headless`, `data-table-remote`):
the manifest URL, the server config, the manifest it returns, the one-line
client, a recorded walkthrough, and the row-action contract.

Colours are the dark tokens of `apps/web/src/styles/globals.css`
(`src/theme.ts`); fonts are Geist and Geist Mono from the web app.

## Record

The walkthrough is recorded from a production build with a seeded database
and demo actions on (`.env.local` with `DATABASE_URL`):

```bash
pnpm --filter web db:drizzle:migrate && pnpm --filter web db:drizzle:seed
pnpm --filter web build
ALLOW_DEMO_ACTIONS=1 pnpm --filter web start
pnpm --filter video record   # writes public/recording/{video.mp4,marks.json}
```

Needs Playwright and ffmpeg. The camera and captions in `src/recording.tsx`
follow marks by name, so a re-recording keeps them on the same elements.

## Render

```bash
pnpm --filter video studio   # preview
pnpm --filter video render   # out/headless.mp4, 1920×1080, 30fps
```

Without network access to Remotion's browser download, pass
`--browser-executable` with a local Chrome Headless Shell.
