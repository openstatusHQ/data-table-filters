import { Series, useVideoConfig } from "remotion";
import { CodeScene, type Focus } from "./code";
import { recordingDuration, RecordingScene, type Marks } from "./recording";
import { Intro, Outro, UrlScene } from "./titles";

const SERVER = `
import { createTableManifest, createTableManifestHandler } from "@/lib/table-schema";

const handler = createTableManifestHandler(
  createTableManifest({
    schema: tableSchema,
    primaryKey: "uuid",
    rowLabel: "{method} {pathname}",
    capabilities: {
      facets: true,
      chart: true,
      actions: true,
    },
    actions: actionHandler.descriptors,
    defaults: { sort: { id: "date", desc: true }, size: 40 },
  }),
);

export const GET = (request: Request) => handler(request);
`;

const MANIFEST = `
{
  "version": 1,
  "schema": { "columns": [/* 18 columns: key, label, display, filter */] },
  "primaryKey": "uuid",
  "rowLabel": "{method} {pathname}",
  "capabilities": { "facets": true, "chart": true, "actions": true },
  "chart": { "columnKey": "date", "series": [/* success, warning, error */] },
  "actions": [
    { "id": "acknowledge", "label": "Acknowledge", "scope": ["row", "bulk", "filter"] },
    { "id": "delete", "label": "Delete", "scope": ["row", "bulk"],
      "variant": "destructive", "confirm": "Delete {count} {log|logs}?" }
  ],
  "defaults": { "sort": { "id": "date", "desc": true }, "size": 40 }
}
`;

const CLIENT = `
"use client";

import { DataTableRemote } from "@/components/data-table/data-table-remote";

export function Logs() {
  return <DataTableRemote manifestEndpoint="/logs/api/schema" />;
}
`;

const ACTIONS = `
// GET /logs/api?level=error
{
  "data": [
    { "uuid": "msg_1", "level": "error", "_actions": ["acknowledge", "delete"] }
  ],
  "meta": { "filterRowCount": 120, "facets": { … }, "actions": [ … ] },
  "nextCursor": 1794242728316
}

// POST /logs/api/actions/acknowledge
{ "scope": "ids", "ids": ["msg_1", "msg_7"], "cmd_id": "cmd_…" }

// → { "applied": 2 }
`;

type Code = {
  duration: number;
  eyebrow: string;
  title: string;
  file: string;
  code: string;
  focus: Focus[];
};

const server: Code = {
  duration: 10,
  eyebrow: "1 · the server",
  title: "Your endpoint describes itself",
  file: "app/logs/api/schema/route.ts",
  code: SERVER,
  focus: [
    { at: 0 },
    { at: 1.8, lines: [6, 7] },
    { at: 4, lines: [8, 12] },
    { at: 6, lines: [13, 14] },
    { at: 8 },
  ],
};

const manifest: Code = {
  duration: 10,
  eyebrow: "2 · the return value",
  title: "GET /logs/api/schema",
  file: "200 OK · application/json (abridged)",
  code: MANIFEST,
  focus: [
    { at: 0 },
    { at: 1.8, lines: [4, 5] },
    { at: 3.8, lines: [6, 7] },
    { at: 5.8, lines: [8, 12] },
    { at: 8 },
  ],
};

const client: Code = {
  duration: 7,
  eyebrow: "3 · the client",
  title: "No columns in your app",
  file: "app/logs/client.tsx",
  code: CLIENT,
  focus: [{ at: 0 }, { at: 1.8, lines: [6, 6] }, { at: 5 }],
};

const actions: Code = {
  duration: 10,
  eyebrow: "4 · row actions",
  title: "Rows say what applies. A click sends ids back.",
  file: "the list and action contract",
  code: ACTIONS,
  focus: [
    { at: 0 },
    { at: 1.8, lines: [4, 4] },
    { at: 4.2, lines: [10, 13] },
    { at: 7.8 },
  ],
};

const INTRO = 5;
const URL = 7;
const OUTRO = 7;

export type VideoProps = { marks: Marks | null };

const durations = (marks: Marks) => [
  INTRO,
  URL,
  server.duration,
  manifest.duration,
  client.duration,
  recordingDuration(marks),
  actions.duration,
  OUTRO,
];

export const totalFrames = (marks: Marks, fps: number) =>
  durations(marks).reduce((sum, s) => sum + Math.round(s * fps), 0);

export function Video({ marks }: VideoProps) {
  const { fps } = useVideoConfig();
  if (!marks) return null;
  const f = (s: number) => Math.round(s * fps);
  return (
    <Series>
      <Series.Sequence durationInFrames={f(INTRO)}>
        <Intro duration={INTRO} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={f(URL)}>
        <UrlScene duration={URL} />
      </Series.Sequence>
      {[server, manifest, client].map((scene) => (
        <Series.Sequence key={scene.file} durationInFrames={f(scene.duration)}>
          <CodeScene {...scene} />
        </Series.Sequence>
      ))}
      <Series.Sequence durationInFrames={f(recordingDuration(marks))}>
        <RecordingScene marks={marks} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={f(actions.duration)}>
        <CodeScene {...actions} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={f(OUTRO)}>
        <Outro duration={OUTRO} />
      </Series.Sequence>
    </Series>
  );
}
