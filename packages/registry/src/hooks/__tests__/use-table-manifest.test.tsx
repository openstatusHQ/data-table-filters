// @vitest-environment jsdom

import {
  createTableManifest,
  type TableManifest,
} from "@dtf/registry/lib/table-schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { col, createTableSchema } from "../../lib/table-schema";
import { tableManifestKey, useTableManifest } from "../use-table-manifest";

const tableSchema = createTableSchema({
  uuid: col.string().label("ID"),
  host: col.string().label("Host").filterable("input"),
});

const MANIFEST = createTableManifest({
  schema: tableSchema,
  primaryKey: "uuid",
  capabilities: { facets: true },
});

function manifestResponse(manifest: TableManifest = MANIFEST) {
  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

/** Renders the hook and reports every state it passes through. */
function renderHook(
  endpoint: string,
  options?: Parameters<typeof useTableManifest>[1],
) {
  const states: {
    status: string;
    manifest?: TableManifest;
    error?: Error | null;
  }[] = [];

  function Probe() {
    const query = useTableManifest(endpoint, options);
    states.push({
      status: query.status,
      manifest: query.data,
      error: query.error,
    });
    return null;
  }

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  /**
   * React Query settles off the render pass and the fetch chain has several
   * awaits in it, so pump the task queue until the query leaves `pending`
   * rather than guessing a fixed number of microtasks.
   */
  const settle = async () => {
    for (let i = 0; i < 25; i++) {
      if (states.at(-1) && states.at(-1)!.status !== "pending") return;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  };

  return {
    states,
    client,
    render: async () => {
      await act(async () => {
        root.render(
          <QueryClientProvider client={client}>
            <Probe />
          </QueryClientProvider>,
        );
      });
      await settle();
    },
  };
}

describe("useTableManifest", () => {
  it("fetches and parses the manifest", async () => {
    const fetchMock = vi.fn(async () => manifestResponse());
    const hook = renderHook("/api/schema", {
      fetch: fetchMock as unknown as typeof fetch,
    });

    await hook.render();

    const last = hook.states.at(-1)!;
    expect(last.status).toBe("success");
    expect(last.manifest?.primaryKey).toBe("uuid");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders from initialManifest without blocking on a fetch", async () => {
    // Never resolves: if the hook waited on it, there would be no data.
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    const hook = renderHook("/api/schema", {
      fetch: fetchMock as unknown as typeof fetch,
      initialManifest: MANIFEST,
    });

    await hook.render();

    expect(hook.states[0]!.status).toBe("success");
    expect(hook.states[0]!.manifest?.primaryKey).toBe("uuid");
  });

  it("does not fetch when disabled", async () => {
    const fetchMock = vi.fn(async () => manifestResponse());
    const hook = renderHook("/api/schema", {
      fetch: fetchMock as unknown as typeof fetch,
      initialManifest: MANIFEST,
      enabled: false,
    });

    await hook.render();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(hook.states.at(-1)!.manifest?.primaryKey).toBe("uuid");
  });

  it("surfaces a malformed manifest as an error rather than partial data", async () => {
    const hook = renderHook("/api/schema", {
      retry: false,
      fetch: (async () =>
        new Response(JSON.stringify({ nope: true }), {
          headers: { "content-type": "application/json" },
        })) as unknown as typeof fetch,
    });

    await hook.render();

    const last = hook.states.at(-1)!;
    expect(last.status).toBe("error");
    expect(last.manifest).toBeUndefined();
  });

  it("surfaces a non-2xx as an error", async () => {
    const hook = renderHook("/api/schema", {
      retry: false,
      fetch: (async () =>
        new Response("nope", { status: 500 })) as unknown as typeof fetch,
    });

    await hook.render();

    expect(hook.states.at(-1)!.status).toBe("error");
  });

  it("reads a manifest another caller seeded into the cache", async () => {
    const fetchMock = vi.fn(async () => manifestResponse());
    const hook = renderHook("/api/schema", {
      fetch: fetchMock as unknown as typeof fetch,
    });
    // What a server prefetch does: seed the key, skip the client round trip.
    hook.client.setQueryData(tableManifestKey("/api/schema"), MANIFEST);

    await hook.render();

    expect(hook.states[0]!.manifest?.primaryKey).toBe("uuid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keys the cache by endpoint, so two tables do not collide", () => {
    expect(tableManifestKey("/a/schema")).not.toEqual(
      tableManifestKey("/b/schema"),
    );
  });
});
