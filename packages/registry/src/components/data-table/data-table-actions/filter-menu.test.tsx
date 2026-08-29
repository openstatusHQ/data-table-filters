// @vitest-environment jsdom

import { DataTableContext } from "@dtf/registry/components/data-table/data-table-provider";
import type { ActionDescriptor } from "@dtf/registry/lib/actions/types";
import { StoreContext } from "@dtf/registry/lib/store/context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataTableActionsFilterMenu, pickFilterValues } from "./filter-menu";
import { DataTableActionsProvider } from "./provider";

/**
 * The filter menu promises the server a number. This suite pins where that
 * number may come from: the host's `filterRows`, only while it describes the
 * filters currently in the store — never a stand-in, never a stale one.
 */

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const replay: ActionDescriptor = {
  id: "replay",
  label: "Replay",
  scope: ["filter"],
  href: "/api/actions/replay",
};

const filterFields = [{ value: "status" }, { value: "attempt" }];

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;
let calls: Array<{ href: string; body: Record<string, unknown> }>;

function fetcher(href: string, init?: RequestInit): Promise<Response> {
  calls.push({ href, body: JSON.parse(String(init?.body)) });
  return Promise.resolve(
    new Response(JSON.stringify({ applied: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

function mount(table: {
  filterRows?: number;
  isLoading?: boolean;
  state?: Record<string, unknown>;
}) {
  const state = table.state ?? { status: ["dead"], sort: "date.desc" };
  const store = {
    adapter: {
      subscribe: () => () => {},
      getSnapshot: () => ({ state, version: 0 }),
    },
    schema: {},
    tableId: "t",
  } as unknown as React.ContextType<typeof StoreContext>;
  const context = {
    filterFields,
    filterRows: table.filterRows,
    isLoading: table.isLoading,
  } as unknown as React.ContextType<typeof DataTableContext>;
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <StoreContext.Provider value={store}>
          <DataTableContext.Provider value={context}>
            <DataTableActionsProvider
              actions={[replay]}
              getRowId={(row: { id: string }) => row.id}
              fetcher={fetcher as typeof fetch}
            >
              <DataTableActionsFilterMenu />
            </DataTableActionsProvider>
          </DataTableContext.Provider>
        </StoreContext.Provider>
      </QueryClientProvider>,
    ),
  );
}

function trigger() {
  const el = container.querySelector<HTMLButtonElement>(
    "button[data-matching]",
  );
  if (!el) throw new Error("no menu trigger");
  return el;
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

beforeEach(() => {
  calls = [];
  queryClient = new QueryClient();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  queryClient.clear();
});

describe("pickFilterValues", () => {
  it("keeps active filter keys and drops table state and empty values", () => {
    expect(
      pickFilterValues(
        {
          status: ["dead"],
          attempt: null,
          event_type: "",
          regions: [],
          sort: "date.desc",
          uuid: "x",
        },
        ["status", "attempt", "event_type", "regions"],
      ),
    ).toEqual({ status: ["dead"], event_type: "" });
  });
});

describe("DataTableActionsFilterMenu", () => {
  it("sends the current filter values with the host's count as expected_count", async () => {
    mount({ filterRows: 40 });
    expect(trigger().disabled).toBe(false);
    expect(trigger().dataset.matching).toBe("40");
    act(() =>
      trigger().dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "mouse",
        }),
      ),
    );
    await flush();
    const item = document.querySelector<HTMLElement>('[role="menuitem"]');
    if (!item) throw new Error("menu did not open");
    act(() => item.click());
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toMatchObject({
      scope: "filter",
      filter: { status: ["dead"] },
      expected_count: 40,
    });
    expect(calls[0]!.body).not.toHaveProperty("sort");
  });

  it("stays disabled without a host-supplied count — a loaded-row count is not a promise", () => {
    mount({});
    expect(trigger().disabled).toBe(true);
    expect(trigger().dataset.matching).toBe("0");
  });

  it("stays disabled while the table is fetching — the count describes the previous query", () => {
    mount({ filterRows: 40, isLoading: true });
    expect(trigger().disabled).toBe(true);
    mount({ filterRows: 40, isLoading: false });
    expect(trigger().disabled).toBe(false);
  });
});
