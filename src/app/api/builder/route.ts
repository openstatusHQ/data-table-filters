import type { SchemaJSON } from "@/lib/table-schema";
import { inferSchemaFromJSON } from "@/lib/table-schema/infer";
import { NextResponse } from "next/server";
import {
  storeBuilderData,
  updateBuilderData,
  updateBuilderSchema,
} from "./cache";

/**
 * POST /api/builder
 *
 * Body: { data: unknown[], schema?: SchemaJSON, message?: string }
 * Returns: { schema: SchemaJSON, dataId: string }
 *
 * Infers schema from data, stores data + schema in server-side cache,
 * and returns the schema along with a dataId for subsequent paginated queries.
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
    const dataId = storeBuilderData(
      body.data as Record<string, unknown>[],
      schema,
    );
    return NextResponse.json({ schema, dataId });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

/**
 * PATCH /api/builder
 *
 * Body: { dataId: string, schema: SchemaJSON }
 * Returns: { success: true }
 *
 * Updates the server-side schema for an existing dataset without re-uploading data.
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      dataId: string;
      schema: SchemaJSON;
    };

    if (!body.dataId || !body.schema) {
      return NextResponse.json(
        { error: "dataId and schema are required" },
        { status: 400 },
      );
    }

    const updated = updateBuilderSchema(body.dataId, body.schema);
    if (!updated) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

/**
 * PUT /api/builder
 *
 * Body: { dataId: string, data: unknown[] }
 * Returns: { success: true }
 *
 * Replaces data in an existing cache entry without creating a new dataId.
 * Used during AI streaming to grow rows without remounting the table.
 */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      dataId: string;
      data: unknown[];
    };

    if (!body.dataId || !Array.isArray(body.data)) {
      return NextResponse.json(
        { error: "dataId and data array are required" },
        { status: 400 },
      );
    }

    const updated = updateBuilderData(
      body.dataId,
      body.data as Record<string, unknown>[],
    );
    if (!updated) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
