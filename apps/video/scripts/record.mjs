#!/usr/bin/env node
// Record the /headless walkthrough the promo cuts to, from a running web app.
//
//   pnpm --filter web build && pnpm --filter web start   # seeded DATABASE_URL
//   pnpm --filter video record                           # --base http://localhost:3000
//
// Writes public/recording/{video.mp4,marks.json}. A mark is the time an element
// was acted on and its box in viewport pixels; the composition zooms on marks
// by name, so a re-recording keeps the camera on the same elements.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = flag("base", "http://localhost:3000");
const theme = flag("theme", "dark");
const VIEWPORT = { width: 1440, height: 900 };
const SCALE = 2;
const FPS = 30;

// Playwright is not a dependency: use the project's, else the global install.
async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const global = spawnSync("npm", ["root", "-g"]).stdout.toString().trim();
    return createRequire(join(global, "noop.js"))("playwright");
  }
}

// A plain arrow, drawn by the page so it sits in the screencast.
const cursorScript = () => {
  const mount = () => {
    const el = document.createElement("div");
    el.id = "__cursor";
    el.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fafafa" stroke="#0a0a0a" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    Object.assign(el.style, {
      position: "fixed",
      left: "0",
      top: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      transform: "translate(-100px,-100px)",
    });
    document.body.appendChild(el);
    addEventListener(
      "mousemove",
      (e) => {
        el.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`;
      },
      true,
    );
  };
  if (document.body) mount();
  else addEventListener("DOMContentLoaded", mount);
};

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  args: [`--force-device-scale-factor=${SCALE}`],
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  colorScheme: theme,
});
await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
await context.addInitScript(cursorScript);
const page = await context.newPage();

const out = join(root, "public", "recording");
const tmp = join(out, ".frames");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

// CDP screencast rather than Playwright's video: full-resolution frames with
// wall-clock timestamps that the marks share.
const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const file = join(tmp, `f${String(frames.length).padStart(6, "0")}.jpg`);
  writeFileSync(file, Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000 });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

const now = () => Date.now() / 1000;
const marks = {};
let mouse = { x: VIEWPORT.width / 2, y: VIEWPORT.height * 0.75 };

async function boxOf(locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error(`no box for ${locator}`);
  return [b.x, b.y, b.width, b.height];
}

async function mark(name, locator) {
  marks[name] = { t: now(), box: await boxOf(locator) };
}

// Glide, not jump: the cursor is part of the shot.
async function moveTo(locator, ms = 700) {
  const [x, y, w, h] = await boxOf(locator);
  await glide({ x: x + w / 2, y: y + h / 2 }, ms);
}

async function glide(to, ms = 700) {
  const steps = Math.round(ms / 16);
  for (let i = 1; i <= steps; i++) {
    const p = i / steps;
    const k = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
    await page.mouse.move(
      mouse.x + (to.x - mouse.x) * k,
      mouse.y + (to.y - mouse.y) * k,
    );
    await page.waitForTimeout(16);
  }
  mouse = to;
}

async function click(locator, name) {
  await moveTo(locator);
  if (name) await mark(name, locator);
  await page.waitForTimeout(250);
  await locator.click();
}

const wait = (ms) => page.waitForTimeout(ms);

await page.goto(`${base}/headless`, { waitUntil: "networkidle" });
await page.locator("tbody tr").first().waitFor();
await page.mouse.move(mouse.x, mouse.y);
await wait(800);

await cdp.send("Page.startScreencast", {
  format: "jpeg",
  quality: 92,
  maxWidth: VIEWPORT.width * SCALE,
  maxHeight: VIEWPORT.height * SCALE,
});
const startAt = now();
await wait(1500);

// 1. The manifest URL is the only input the page has.
const input = page.getByLabel("Manifest URL");
await moveTo(input);
await mark("endpoint", input);
await wait(2500);

// 2. Filters come from the schema.
await click(page.getByText("error", { exact: true }).first(), "level");
await wait(2500);

// 3. Row actions: the bulk bar shows what the server allows for the selection.
const checks = page.locator("tbody tr [role=checkbox]");
await click(checks.nth(0), "select");
await wait(400);
await click(checks.nth(1));
await wait(900);
const bar = page
  .getByText(/selected/i)
  .last()
  .locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
await mark("actions", bar);
// Down the checkbox column first: crossing a date cell opens its hover card.
const acknowledge = page.getByRole("button", { name: /acknowledge/i }).last();
const [, ackY, , ackH] = await boxOf(acknowledge);
await glide({ x: mouse.x, y: ackY + ackH / 2 }, 700);
await moveTo(acknowledge, 700);
await wait(3000);
await click(page.getByRole("button", { name: "Deselect all" }));
await wait(1000);

// 4. The row sheet: fields and title from the manifest.
await click(page.locator("tbody tr").nth(0).locator("td").nth(4), "row");
await wait(800);
await mark("sheet", page.getByRole("dialog").first());
await wait(3500);
await page.keyboard.press("Escape");
await wait(1200);

// 5. A different endpoint, the same component.
await click(input, "endpoint-edit");
await input.fill("");
await input.pressSequentially("/headless/api/orders/schema", { delay: 70 });
await wait(600);
await page.keyboard.press("Enter");
await page.waitForURL(/orders/);
await page.locator("tbody tr").first().waitFor();
await wait(600);
await mark("orders", page.locator("table").first());
await moveTo(page.locator("tbody tr").nth(4), 900);
await wait(3500);

const endAt = now();
await cdp.send("Page.stopScreencast");
await browser.close();

// Each frame lasts until the next one; the concat list keeps that timing.
const shown = frames.filter((f, i) => (frames[i + 1]?.t ?? endAt) > startAt);
const lines = shown.flatMap((f, i) => {
  const next = shown[i + 1]?.t ?? endAt;
  return [
    `file '${f.file}'`,
    `duration ${(next - Math.max(f.t, startAt)).toFixed(4)}`,
  ];
});
lines.push(`file '${shown.at(-1).file}'`);
writeFileSync(join(tmp, "frames.txt"), lines.join("\n"));

const ffmpeg = spawnSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  join(tmp, "frames.txt"),
  "-vf",
  "format=yuv420p",
  "-r",
  String(FPS),
  "-c:v",
  "libx264",
  "-crf",
  "14",
  "-movflags",
  "+faststart",
  join(out, "video.mp4"),
]);
rmSync(tmp, { recursive: true, force: true });
if (ffmpeg.status !== 0) {
  console.error(ffmpeg.stderr?.toString());
  process.exit(1);
}

const rel = Object.fromEntries(
  Object.entries(marks).map(([k, m]) => [
    k,
    { ...m, t: +(m.t - startAt).toFixed(3) },
  ]),
);
writeFileSync(
  join(out, "marks.json"),
  JSON.stringify(
    { viewport: VIEWPORT, duration: +(endAt - startAt).toFixed(3), marks: rel },
    null,
    2,
  ) + "\n",
);
console.log(
  `wrote ${join(out, "video.mp4")} (${(endAt - startAt).toFixed(1)}s)`,
);
