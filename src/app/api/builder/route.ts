import type { SchemaJSON } from "@/lib/table-schema";
import { inferSchemaFromJSON } from "@/lib/table-schema/infer";
import { NextResponse } from "next/server";

/**
 * POST /api/builder
 *
 * Body: { data: unknown[], schema?: SchemaJSON, message?: string }
 * Returns: { schema: SchemaJSON }
 *
 * Currently calls inferSchemaFromJSON(data).
 * When AI is added: swap the body with an LLM call using schema and message.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      data: unknown[];
      schema?: SchemaJSON;
      message?: string;
    };

    if (!Array.isArray(body.data)) {
      return NextResponse.json(
        { error: "data must be an array" },
        { status: 400 },
      );
    }

    const schema = inferSchemaFromJSON(body.data);
    return NextResponse.json({ schema });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
