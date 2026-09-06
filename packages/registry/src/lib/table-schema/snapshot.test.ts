import { describe, expect, it } from "vitest";
import { col } from "./col";
import { createTableSchema } from "./index";
import { createTableManifest, TableManifestError } from "./manifest";
import { manifestToModule, pullManifestModule } from "./snapshot";

const tableSchema = createTableSchema({
  uuid: col.string().label("ID"),
  level: col.enum(["error", "info"]).label("Level").filterable("checkbox"),
});

const manifest = createTableManifest({
  schema: tableSchema,
  primaryKey: "uuid",
  capabilities: { facets: true },
});

const AT = new Date("2026-01-15T09:30:00.000Z");

describe("manifestToModule", () => {
  it("emits a module that exports a typed manifest", () => {
    const source = manifestToModule(manifest);

    expect(source).toContain(
      'import type { TableManifest } from "@dtf/registry/lib/table-schema";',
    );
    expect(source).toContain("export const manifest: TableManifest = {");
    expect(source.endsWith("\n")).toBe(true);
  });

  it("round-trips the manifest through the emitted JSON", () => {
    const source = manifestToModule(manifest);
    const json = source.slice(
      source.indexOf("{", source.indexOf("export const")),
      source.lastIndexOf("}") + 1,
    );

    expect(JSON.parse(json)).toEqual(manifest);
  });

  it("records the source and timestamp when given them", () => {
    const source = manifestToModule(manifest, {
      source: "https://api.example.com/logs/schema",
      generatedAt: AT,
    });

    expect(source).toContain("Source: https://api.example.com/logs/schema");
    expect(source).toContain("Generated: 2026-01-15T09:30:00.000Z");
  });

  it("accepts a pre-formatted timestamp string", () => {
    expect(manifestToModule(manifest, { generatedAt: "build-42" })).toContain(
      "Generated: build-42",
    );
  });

  it("omits the provenance lines it has no value for", () => {
    const source = manifestToModule(manifest);
    expect(source).not.toContain("Source:");
    expect(source).not.toContain("Generated:");
  });

  it("always warns that the snapshot can go stale", () => {
    expect(manifestToModule(manifest)).toContain("snapshot");
  });

  it("honours a custom export name", () => {
    expect(
      manifestToModule(manifest, { exportName: "logsManifest" }),
    ).toContain("export const logsManifest: TableManifest =");
  });

  it("refuses an export name that is not an identifier", () => {
    expect(() =>
      manifestToModule(manifest, { exportName: "logs-manifest" }),
    ).toThrow(/identifier/);
    expect(() => manifestToModule(manifest, { exportName: "" })).toThrow(
      /identifier/,
    );
  });

  it("honours a custom type import for the consuming app's layout", () => {
    expect(
      manifestToModule(manifest, { typeImport: "@/lib/table-schema" }),
    ).toContain('import type { TableManifest } from "@/lib/table-schema";');
  });

  it("validates on the way in rather than freezing a broken manifest", () => {
    // Snapshotting a bad answer would move the failure to a file nobody reads.
    expect(() => manifestToModule({ schema: { columns: [] } })).toThrow(
      TableManifestError,
    );
    expect(() => manifestToModule(null)).toThrow(TableManifestError);
  });

  it("normalizes as it snapshots, so a v0 schema is stored migrated", () => {
    const source = manifestToModule({
      schema: {
        columns: [{ key: "uuid", dataType: "string", label: "ID" }],
      },
      primaryKey: "uuid",
    });

    expect(source).toContain('"kind": "string"');
    expect(source).not.toContain("dataType");
  });

  it("is deterministic for the same input", () => {
    expect(manifestToModule(manifest, { generatedAt: AT })).toBe(
      manifestToModule(manifest, { generatedAt: AT }),
    );
  });
});

describe("pullManifestModule", () => {
  it("fetches and renders", async () => {
    const source = await pullManifestModule(
      "https://api.example.com/logs/schema",
      {
        fetch: (async () =>
          new Response(JSON.stringify(manifest))) as unknown as typeof fetch,
        generatedAt: AT,
      },
    );

    expect(source).toContain("export const manifest: TableManifest =");
    expect(source).toContain("Source: https://api.example.com/logs/schema");
    expect(source).toContain("Generated: 2026-01-15T09:30:00.000Z");
  });

  it("passes headers through, for a protected endpoint", async () => {
    let seen: HeadersInit | undefined;
    await pullManifestModule("https://api.example.com/logs/schema", {
      fetch: (async (_url: string, init?: RequestInit) => {
        seen = init?.headers;
        return new Response(JSON.stringify(manifest));
      }) as unknown as typeof fetch,
      headers: { authorization: "Bearer token" },
    });

    expect(seen).toEqual({ authorization: "Bearer token" });
  });

  it("throws with the status when the endpoint refuses", async () => {
    await expect(
      pullManifestModule("https://api.example.com/logs/schema", {
        fetch: (async () =>
          new Response("nope", {
            status: 403,
            statusText: "Forbidden",
          })) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/403/);
  });

  it("throws rather than writing a snapshot of a non-manifest", async () => {
    await expect(
      pullManifestModule("https://api.example.com/logs/schema", {
        fetch: (async () =>
          new Response(
            JSON.stringify({ hello: "world" }),
          )) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(TableManifestError);
  });
});
