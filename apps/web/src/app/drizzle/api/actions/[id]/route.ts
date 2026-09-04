import { ActionHandlerError } from "@dtf/registry/lib/drizzle/actions";
import { NextRequest } from "next/server";
import { actionHandler, demoActionsEnabled } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * `POST /drizzle/api/actions/:id` — one command.
 *
 * The body is `ActionRequest`; the response is `{ applied }` or an
 * `ActionError`. The actor is whoever this route authenticated — the demo has
 * no auth, so it records "anonymous". A real deployment resolves the session
 * here and passes it through; the handler never trusts a body field.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!demoActionsEnabled()) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await actionHandler.execute(id, body, {
      actor: "anonymous",
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ActionHandlerError) {
      return Response.json(error.toJSON(), { status: error.status });
    }
    console.error(`[drizzle/api/actions/${id}] failed:`, error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
