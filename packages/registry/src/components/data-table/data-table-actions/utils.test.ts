import type {
  ActionDescriptor,
  ActionRequest,
} from "@dtf/registry/lib/actions/types";
import { describe, expect, it, vi } from "vitest";
import { describePending } from "./confirm-dialog";
import { pickFilterValues } from "./filter-menu";
import {
  ActionRequestError,
  actionsForScope,
  interpolate,
  newCommandId,
  partitionRows,
  postAction,
  rowActionsOf,
  rowScopedActions,
} from "./utils";

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
const purge: ActionDescriptor = {
  id: "purge",
  label: "Purge",
  scope: ["filter"],
  href: "/api/actions/purge",
};
const actions = [replay, discard, purge];

describe("interpolate", () => {
  it("replaces known placeholders and leaves unknown ones", () => {
    expect(interpolate("Discard {count} of {total}?", { count: 3 })).toBe(
      "Discard 3 of {total}?",
    );
  });

  it("only reads own properties — prototype names are not variables", () => {
    expect(interpolate("{constructor} {toString}", { count: 1 })).toBe(
      "{constructor} {toString}",
    );
  });
});

describe("rowActionsOf", () => {
  it("reads the server stamp and tolerates its absence or garbage", () => {
    expect(rowActionsOf({ _actions: ["a", "b"] })).toEqual(["a", "b"]);
    expect(rowActionsOf({})).toEqual([]);
    expect(rowActionsOf(null)).toEqual([]);
    expect(rowActionsOf({ _actions: "a" })).toEqual([]);
    expect(rowActionsOf({ _actions: ["a", 1, null] })).toEqual(["a"]);
  });
});

describe("scope helpers", () => {
  it("actionsForScope", () => {
    expect(actionsForScope(actions, "bulk").map((a) => a.id)).toEqual([
      "replay",
      "discard",
    ]);
    expect(actionsForScope(actions, "filter").map((a) => a.id)).toEqual([
      "replay",
      "purge",
    ]);
  });

  it("rowScopedActions is descriptor order ∩ row stamp ∩ row scope", () => {
    expect(
      rowScopedActions(actions, ["purge", "discard", "replay"]).map(
        (a) => a.id,
      ),
    ).toEqual(["replay", "discard"]);
    expect(rowScopedActions(actions, ["nope"])).toEqual([]);
  });

  it("partitionRows keeps eligible rows and counts the rest", () => {
    const rows = [
      { original: { id: 1, _actions: ["replay"] } },
      { original: { id: 2, _actions: [] } },
      { original: { id: 3, _actions: ["replay", "discard"] } },
    ];
    const { eligible, skipped } = partitionRows(rows, "replay", rowActionsOf);
    expect(eligible.map((r) => r.original.id)).toEqual([1, 3]);
    expect(skipped).toBe(1);
    expect(partitionRows([], "replay", rowActionsOf)).toEqual({
      eligible: [],
      skipped: 0,
    });
  });
});

describe("newCommandId", () => {
  it("is unique and prefixed", () => {
    const a = newCommandId();
    const b = newCommandId();
    expect(a).toMatch(/^cmd_/);
    expect(a).not.toBe(b);
  });
});

describe("postAction", () => {
  const request: ActionRequest = {
    scope: "ids",
    ids: ["a"],
    cmd_id: "cmd_1",
  };

  function fetcher(status: number, body: unknown) {
    return vi.fn(
      async () =>
        new Response(body === undefined ? null : JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    ) as unknown as typeof fetch;
  }

  it("POSTs JSON to href and returns applied", async () => {
    const fetch = fetcher(200, { applied: 2 });
    await expect(postAction("/x/replay", request, fetch)).resolves.toEqual({
      applied: 2,
    });
    const [href, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(href).toBe("/x/replay");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it("maps a known error code and carries `actual`", async () => {
    const error = await postAction(
      "/x",
      request,
      fetcher(409, { error: "count_mismatch", actual: 7 }),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ActionRequestError);
    expect(error).toMatchObject({
      code: "count_mismatch",
      status: 409,
      actual: 7,
    });
  });

  it("treats a 2xx without a numeric `applied` as a failure, never as 'applied to 0'", async () => {
    for (const [status, body] of [
      [204, undefined],
      [200, { ok: true }],
      [200, { applied: "2" }],
    ] as const) {
      const error = await postAction(
        "/x",
        request,
        fetcher(status, body),
      ).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ActionRequestError);
      expect(error).toMatchObject({ code: "failed", status });
    }
  });

  it("maps an unknown or absent body to `failed`", async () => {
    const e1 = await postAction("/x", request, fetcher(500, undefined)).catch(
      (e: unknown) => e,
    );
    expect(e1).toMatchObject({ code: "failed", status: 500 });
    const e2 = await postAction(
      "/x",
      request,
      fetcher(502, { error: "gateway" }),
    ).catch((e: unknown) => e);
    expect(e2).toMatchObject({ code: "failed", status: 502 });
  });
});

describe("pickFilterValues", () => {
  it("keeps only active filter keys", () => {
    expect(
      pickFilterValues(
        {
          level: ["error"],
          host: null,
          regions: [],
          latency: [0, 100],
          sort: { id: "date", desc: true },
          cursor: new Date(0),
        },
        ["level", "host", "regions", "latency"],
      ),
    ).toEqual({ level: ["error"], latency: [0, 100] });
  });
});

describe("describePending", () => {
  it("interpolates the descriptor's confirm copy", () => {
    expect(
      describePending({ action: discard, count: 3, skipped: 0, scope: "ids" }),
    ).toEqual({ title: "Discard 3 messages?", description: null });
  });

  it("falls back to a generic title and pluralises", () => {
    expect(
      describePending({ action: replay, count: 1, skipped: 0, scope: "ids" })
        .title,
    ).toBe("Replay 1 row?");
    expect(
      describePending({ action: replay, count: 2, skipped: 0, scope: "ids" })
        .title,
    ).toBe("Replay 2 rows?");
  });

  it("mentions skipped rows and filter scope", () => {
    expect(
      describePending({ action: discard, count: 7, skipped: 3, scope: "ids" })
        .description,
    ).toBe("3 selected rows do not qualify and will be skipped.");
    expect(
      describePending({ action: discard, count: 7, skipped: 1, scope: "ids" })
        .description,
    ).toBe("1 selected row does not qualify and will be skipped.");
    expect(
      describePending({
        action: replay,
        count: 40,
        skipped: 0,
        scope: "filter",
      }).description,
    ).toBe("Applies to every row matching the current filters.");
  });

  it("explains a count mismatch with the server's number", () => {
    expect(
      describePending({
        action: replay,
        count: 40,
        skipped: 0,
        scope: "filter",
        actual: 38,
      }),
    ).toEqual({
      title: "Replay: the matching set changed",
      description:
        "You were shown 40 rows; the server now counts 38. Apply to 38 rows anyway?",
    });
  });
});
