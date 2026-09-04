// @vitest-environment jsdom

import { DataTableContext } from "@dtf/registry/components/data-table/data-table-provider";
import type { ActionDescriptor } from "@dtf/registry/lib/actions/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataTableActionsBar } from "./bar";
import { DataTableActionsCell } from "./column";
// ── helpers ─────────────────────────────────────────────────────────────────
import { DataTableActionsProvider, useDataTableActions } from "./provider";

/**
 * The client half of the contract, end to end through the provider: a click
 * becomes one POST with a `cmd_id`, only eligible ids travel, confirmation is
 * driven by the descriptor, and a `count_mismatch` offers "apply anyway"
 * without the optimistic check.
 */

// React's act() warning is noise here: this is a jsdom test, not a renderer.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

const replay: ActionDescriptor = {
  id: "replay",
  label: "Replay",
  scope: ["row", "bulk", "filter"],
  href: "/api/actions/replay",
};
const discard: ActionDescriptor = {
  id: "discard",
  label: "Discard",
  scope: ["row", "bulk"],
  variant: "destructive",
  confirm: "Discard {count} messages?",
  href: "/api/actions/discard",
};

type Item = { id: string; _actions: string[] };
const rows: { original: Item }[] = [
  { original: { id: "a", _actions: ["replay", "discard"] } },
  { original: { id: "b", _actions: [] } },
  { original: { id: "c", _actions: ["replay"] } },
];

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;
let calls: Array<{ href: string; body: Record<string, unknown> }>;
let respond: (href: string) => Response | Promise<Response>;

function fetcher(href: string, init?: RequestInit): Promise<Response> {
  calls.push({ href, body: JSON.parse(String(init?.body)) });
  return Promise.resolve(respond(href));
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mount(
  ui: React.ReactNode,
  options: {
    actions?: ActionDescriptor[];
    queryKeyPrefix?: string;
    getRowLabel?: (row: Item) => string;
  } = {},
) {
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <DataTableActionsProvider<Item>
          actions={options.actions ?? [replay, discard]}
          getRowId={(row) => row.id}
          getRowLabel={options.getRowLabel}
          queryKeyPrefix={options.queryKeyPrefix ?? "demo"}
          fetcher={fetcher as typeof fetch}
        >
          {ui}
        </DataTableActionsProvider>
      </QueryClientProvider>,
    ),
  );
}

async function flush() {
  // Let the mutation promise chain settle.
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function button(actionId: string) {
  const el = container.querySelector<HTMLButtonElement>(
    `button[data-action="${actionId}"]`,
  );
  if (!el) throw new Error(`no button for ${actionId}`);
  return el;
}

/** The disabled reason lives on the wrapper: a disabled button shows no title. */
function reason(actionId: string) {
  return button(actionId).parentElement!.title;
}

function dialog() {
  return document.querySelector<HTMLElement>('[role="alertdialog"]');
}

function dialogButton(text: string) {
  const buttons = Array.from(
    dialog()?.querySelectorAll<HTMLButtonElement>("button") ?? [],
  );
  const el = buttons.find((b) => b.textContent?.trim() === text);
  if (!el) {
    throw new Error(
      `no dialog button "${text}" among ${buttons.map((b) => b.textContent).join(", ")}`,
    );
  }
  return el;
}

beforeEach(() => {
  calls = [];
  respond = () => json(200, { applied: 1 });
  toast.success.mockClear();
  toast.warning.mockClear();
  toast.error.mockClear();
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

describe("DataTableActionsBar", () => {
  it("renders one button per bulk action with eligible and skipped counts", () => {
    mount(<DataTableActionsBar rows={rows} />);
    expect(button("replay").dataset).toMatchObject({
      eligible: "2",
      skipped: "1",
    });
    expect(button("replay").disabled).toBe(false);
    expect(button("discard").dataset).toMatchObject({
      eligible: "1",
      skipped: "2",
    });
    expect(container.querySelector('button[data-action="purge"]')).toBeNull();
  });

  it("disables a button when no selected row qualifies, and says why", () => {
    mount(<DataTableActionsBar rows={[rows[1]!]} />);
    expect(button("replay").disabled).toBe(true);
    expect(reason("replay")).toMatch(/Select a row/);
  });

  it("refuses a selection past the server's `maxIds` with the limit as the reason", () => {
    mount(<DataTableActionsBar rows={rows} />, {
      actions: [{ ...replay, maxIds: 1 }, discard],
    });
    // Two eligible for replay, one for discard.
    expect(button("replay").disabled).toBe(true);
    expect(button("replay").dataset).toHaveProperty("overLimit");
    expect(reason("replay")).toMatch(/at most 1 rows/);
    expect(button("discard").disabled).toBe(false);
    expect(reason("discard")).toBe("");
    expect(button("discard").dataset).not.toHaveProperty("overLimit");
    act(() => button("replay").click());
    expect(calls).toEqual([]);
  });

  it("renders nothing when no action is bulk-scoped", () => {
    mount(<DataTableActionsBar rows={rows} />, {
      actions: [{ ...replay, scope: ["filter"] }],
    });
    expect(container.querySelector("button")).toBeNull();
  });

  it("sends only the eligible ids with a fresh cmd_id, then invalidates the prefix", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    respond = () => json(200, { applied: 2 });
    mount(<DataTableActionsBar rows={rows} />);

    act(() => button("replay").click());
    await flush();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.href).toBe("/api/actions/replay");
    expect(calls[0]!.body).toMatchObject({ scope: "ids", ids: ["a", "c"] });
    expect(calls[0]!.body.cmd_id).toMatch(/^cmd_/);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["demo"] });
    expect(toast.success).toHaveBeenCalledWith("Replay: applied to 2");
    expect(dialog()).toBeNull();
  });

  it("warns when the server applied to fewer rows than were sent", async () => {
    respond = () => json(200, { applied: 1 });
    mount(<DataTableActionsBar rows={rows} />);
    act(() => button("replay").click());
    await flush();
    expect(toast.warning).toHaveBeenCalledWith("Replay: applied to 1 of 2");
  });

  it("asks for confirmation when the descriptor carries `confirm`, with the skipped note", async () => {
    mount(<DataTableActionsBar rows={rows} />);

    act(() => button("discard").click());
    await flush();

    expect(calls).toHaveLength(0);
    expect(dialog()?.textContent).toContain("Discard 1 messages?");
    expect(dialog()?.textContent).toContain(
      "2 selected rows do not qualify and will be skipped.",
    );

    act(() => dialogButton("Discard").click());
    await flush();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toMatchObject({ scope: "ids", ids: ["a"] });
    expect(dialog()).toBeNull();
  });

  it("keeps the confirmation open, buttons disabled, until the request settles", async () => {
    let resolve!: (response: Response) => void;
    respond = () => new Promise<Response>((r) => (resolve = r));
    mount(<DataTableActionsBar rows={rows} />);

    act(() => button("discard").click());
    await flush();
    act(() => dialogButton("Discard").click());
    await flush();

    // Sent, but not yet answered: still open and no longer interactive.
    expect(calls).toHaveLength(1);
    expect(dialog()).not.toBeNull();
    expect(dialogButton("Discard").disabled).toBe(true);
    expect(dialogButton("Cancel").disabled).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();

    act(() => {
      dialog()?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    await flush();
    expect(dialog()).not.toBeNull();

    resolve(json(200, { applied: 1 }));
    await flush();

    expect(dialog()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("Discard: applied to 1");
  });

  it("keeps the title while the dialog animates out", async () => {
    // jsdom has no CSS animations, so Radix unmounts closed content at once.
    // Report one per `data-state` — Presence only suspends the unmount when
    // the name changes on close — and the content stays mounted until
    // `animationend`: the window in which an emptied title flickers.
    const getComputedStyle = window.getComputedStyle;
    const spy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element, pseudo) => {
        const styles = getComputedStyle.call(window, element, pseudo);
        return new Proxy(styles, {
          get: (target, key) =>
            key === "animationName"
              ? `${element.getAttribute("data-state")}-animation`
              : Reflect.get(target, key),
        });
      });
    try {
      mount(<DataTableActionsBar rows={rows} />);
      act(() => button("discard").click());
      await flush();
      act(() => dialogButton("Cancel").click());
      await flush();

      const closing = document.querySelector<HTMLElement>(
        '[data-slot="alert-dialog-content"]',
      );
      expect(closing?.getAttribute("data-state")).toBe("closed");
      expect(closing?.textContent).toContain("Discard 1 messages?");
    } finally {
      spy.mockRestore();
    }
  });

  it("closes the confirmation when the request fails", async () => {
    respond = () => json(500, { error: "failed" });
    mount(<DataTableActionsBar rows={rows} />);
    act(() => button("discard").click());
    await flush();
    act(() => dialogButton("Discard").click());
    await flush();
    expect(dialog()).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Discard failed: failed");
  });

  it("cancelling the confirmation sends nothing", async () => {
    mount(<DataTableActionsBar rows={rows} />);
    act(() => button("discard").click());
    await flush();
    act(() => dialogButton("Cancel").click());
    await flush();
    expect(calls).toHaveLength(0);
    expect(dialog()).toBeNull();
  });

  it("clears the table selection once the action landed — not before, not on failure", async () => {
    const resetRowSelection = vi.fn();
    const tableContext = {
      table: { resetRowSelection },
    } as unknown as React.ContextType<typeof DataTableContext>;
    const withTable = (ui: React.ReactNode) => (
      <DataTableContext.Provider value={tableContext}>
        {ui}
      </DataTableContext.Provider>
    );

    respond = () => json(500, { error: "failed" });
    mount(withTable(<DataTableActionsBar rows={rows} />));
    act(() => button("replay").click());
    await flush();
    expect(resetRowSelection).not.toHaveBeenCalled();

    respond = () => json(200, { applied: 2 });
    act(() => button("replay").click());
    await flush();
    expect(resetRowSelection).toHaveBeenCalledTimes(1);
  });

  it("reports the guard's shortfall on a filter-scoped action as success, not as a warning", async () => {
    respond = () => json(200, { applied: 12 });
    mount(
      <DataTableActionsBarLikeFilter action={replay} filter={{}} count={40} />,
    );
    act(() => button("replay").click());
    await flush();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      "Replay: applied to 12 of 40 matching",
    );
  });

  it("surfaces a server failure as a toast", async () => {
    respond = () => json(500, { error: "failed" });
    mount(<DataTableActionsBar rows={rows} />);
    act(() => button("replay").click());
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Replay failed: failed");
  });
});

describe("count_mismatch", () => {
  /** A filter-scoped trigger, without pulling the table store into the test. */
  function FilterTrigger({ count }: { count: number }) {
    return (
      <DataTableActionsBarLikeFilter
        action={replay}
        filter={{ level: ["error"] }}
        count={count}
      />
    );
  }

  it("reopens the dialog with the server's number and resends without expected_count", async () => {
    let attempts = 0;
    respond = () => {
      attempts += 1;
      return attempts === 1
        ? json(409, { error: "count_mismatch", actual: 38 })
        : json(200, { applied: 38 });
    };
    mount(<FilterTrigger count={40} />);

    act(() => button("replay").click());
    await flush();

    expect(calls[0]!.body).toMatchObject({
      scope: "filter",
      filter: { level: ["error"] },
      expected_count: 40,
    });
    expect(dialog()?.textContent).toContain("the matching set changed");
    expect(dialog()?.textContent).toContain("now counts 38");
    expect(toast.error).not.toHaveBeenCalled();

    act(() => dialogButton("Apply anyway").click());
    await flush();

    expect(calls).toHaveLength(2);
    expect(calls[1]!.body).not.toHaveProperty("expected_count");
    expect(calls[1]!.body).toMatchObject({
      scope: "filter",
      filter: { level: ["error"] },
    });
    expect(calls[1]!.body.cmd_id).not.toBe(calls[0]!.body.cmd_id);
    expect(toast.success).toHaveBeenCalledWith(
      "Replay: applied to 38 of 38 matching",
    );
  });
});

describe("DataTableActionsCell", () => {
  it("renders a menu trigger only when the row has row-scoped actions", () => {
    mount(
      <>
        <div data-row="a">
          <DataTableActionsCell row={rows[0]!} />
        </div>
        <div data-row="b">
          <DataTableActionsCell row={rows[1]!} />
        </div>
      </>,
    );
    expect(
      container.querySelector(
        '[data-row="a"] button[aria-label="Row actions"]',
      ),
    ).not.toBeNull();
    expect(container.querySelector('[data-row="b"] button')).toBeNull();
  });

  // The row id is the internal key the wire uses; a composite or opaque one
  // reads as noise, so only a host-supplied label names the row.
  it("names the row from getRowLabel, never from the row id", () => {
    mount(<DataTableActionsCell row={rows[0]!} />, {
      getRowLabel: (row) => `log ${row.id.toUpperCase()}`,
    });
    expect(
      container.querySelector('button[aria-label="Actions for log A"]'),
    ).not.toBeNull();
    expect(container.querySelector('button[aria-label="Actions for a"]')).toBe(
      null,
    );
  });

  it("keeps Enter and click on the trigger away from the row's own handlers", () => {
    const rowClick = vi.fn();
    const rowKeyDown = vi.fn();
    mount(
      <div onClick={rowClick} onKeyDown={rowKeyDown}>
        <DataTableActionsCell row={rows[0]!} />
      </div>,
    );
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Row actions"]',
    )!;
    act(() => {
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      trigger.click();
    });
    expect(rowKeyDown).not.toHaveBeenCalled();
    expect(rowClick).not.toHaveBeenCalled();
  });

  // Only the keys that open the row are stopped: swallowing the rest would
  // silently kill app-level shortcuts while focus sits in the cell.
  it("lets every other key bubble past the cell", () => {
    const rowKeyDown = vi.fn();
    mount(
      <div onKeyDown={rowKeyDown}>
        <DataTableActionsCell row={rows[0]!} />
      </div>,
    );
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Row actions"]',
    )!;
    act(() => {
      for (const key of ["k", "Escape", "ArrowDown", "j"]) {
        trigger.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true }),
        );
      }
    });
    expect(rowKeyDown).toHaveBeenCalledTimes(4);
  });
});

describe("concurrent triggers", () => {
  /** A surface that ignores `isPending`, as a custom one might. */
  function RawTrigger({ action }: { action: ActionDescriptor }) {
    const { trigger } = useDataTableActions();
    return (
      <button
        data-action={action.id}
        onClick={() =>
          trigger(action, { scope: "ids", ids: ["a"] }, { count: 1 })
        }
      >
        {action.label}
      </button>
    );
  }

  // The dialog is shared state; only the request it submitted may close it.
  it("keeps a confirmation opened mid-flight when an earlier action settles", async () => {
    let release!: (response: Response) => void;
    const inFlight = new Promise<Response>((resolve) => {
      release = resolve;
    });
    respond = () => inFlight;

    mount(
      <>
        <RawTrigger action={replay} />
        <RawTrigger action={discard} />
      </>,
    );

    // An unconfirmed action goes straight to the wire and stays there.
    act(() => button("replay").click());
    await flush();
    expect(calls).toHaveLength(1);

    // While it hangs, a confirmed action opens the dialog.
    act(() => button("discard").click());
    await flush();
    expect(dialog()?.textContent).toContain("Discard 1 messages?");

    act(() => release(json(200, { applied: 1 })));
    await flush();

    expect(toast.success).toHaveBeenCalledWith("Replay: applied to 1");
    expect(dialog()?.textContent).toContain("Discard 1 messages?");
    expect(calls).toHaveLength(1);
  });

  it("still closes the dialog when its own request settles", async () => {
    mount(<RawTrigger action={discard} />);
    act(() => button("discard").click());
    await flush();
    expect(dialog()).not.toBeNull();

    act(() => dialogButton("Discard").click());
    await flush();

    expect(calls).toHaveLength(1);
    expect(dialog()).toBeNull();
  });

  it("closes the dialog when its own request fails", async () => {
    respond = () => json(500, { error: "failed" });
    mount(<RawTrigger action={discard} />);
    act(() => button("discard").click());
    await flush();
    act(() => dialogButton("Discard").click());
    await flush();

    expect(toast.error).toHaveBeenCalledWith("Discard failed: failed");
    expect(dialog()).toBeNull();
  });
});

function DataTableActionsBarLikeFilter({
  action,
  filter,
  count,
}: {
  action: ActionDescriptor;
  filter: Record<string, unknown>;
  count: number;
}) {
  const { trigger } = useDataTableActions();
  return (
    <button
      data-action={action.id}
      onClick={() =>
        trigger(
          action,
          { scope: "filter", filter, expected_count: count },
          { count },
        )
      }
    >
      {action.label}
    </button>
  );
}
