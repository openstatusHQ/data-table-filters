import { ActionHandlerError } from "@dtf/registry/lib/drizzle/actions";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `POST /drizzle/api/actions/:id` maps `ActionHandlerError` to HTTP and gates
 * on `ALLOW_DEMO_ACTIONS`. The handler itself is covered against real Postgres
 * in `packages/registry/src/lib/drizzle/__tests__/actions.test.ts`; here it is
 * mocked so no database is needed.
 */

const mocked = vi.hoisted(() => ({
  execute:
    vi.fn<
      (
        id: string,
        body: unknown,
        options?: { actor?: string },
      ) => Promise<{ applied: number }>
    >(),
}));

vi.mock("../../actions", () => ({
  demoActionsEnabled: () => process.env.ALLOW_DEMO_ACTIONS === "1",
  actionHandler: {
    execute: mocked.execute,
    descriptors: [],
    annotate: (r: unknown[]) => r,
  },
}));

const { POST } = await import("../[id]/route");

function post(id: string, body: unknown, raw = false) {
  return POST(
    new NextRequest(`http://localhost/drizzle/api/actions/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ? (body as string) : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

const request = { scope: "ids", ids: ["u1"], cmd_id: "cmd_1" };

let previous: string | undefined;
beforeEach(() => {
  previous = process.env.ALLOW_DEMO_ACTIONS;
  process.env.ALLOW_DEMO_ACTIONS = "1";
  mocked.execute.mockReset();
});
afterEach(() => {
  if (previous === undefined) delete process.env.ALLOW_DEMO_ACTIONS;
  else process.env.ALLOW_DEMO_ACTIONS = previous;
});

describe("POST /drizzle/api/actions/[id]", () => {
  it("answers 403 and never reaches the handler when demo actions are off", async () => {
    delete process.env.ALLOW_DEMO_ACTIONS;
    const response = await post("acknowledge", request);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
    expect(mocked.execute).not.toHaveBeenCalled();
  });

  it("passes id, body and a route-resolved actor to the handler and returns its result", async () => {
    mocked.execute.mockResolvedValue({ applied: 1 });
    const response = await post("acknowledge", request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ applied: 1 });
    expect(mocked.execute).toHaveBeenCalledWith("acknowledge", request, {
      actor: "anonymous",
    });
  });

  it("answers 400 for a body that is not JSON", async () => {
    const response = await post("acknowledge", "{not json", true);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(mocked.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown_action", 404, undefined],
    ["scope_not_allowed", 400, undefined],
    ["invalid_request", 400, undefined],
    ["count_mismatch", 409, 7],
  ] as const)("maps %s to %i", async (code, status, actual) => {
    mocked.execute.mockRejectedValue(
      new ActionHandlerError(code, "nope", actual),
    );
    const response = await post("acknowledge", request);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(
      actual === undefined ? { error: code } : { error: code, actual },
    );
  });

  it("maps anything else to a 500 without leaking the message", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocked.execute.mockRejectedValue(new Error("connection refused"));
      const response = await post("acknowledge", request);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "failed" });
    } finally {
      error.mockRestore();
    }
  });
});
