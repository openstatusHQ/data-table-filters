import type { SchemaDefinition } from "@dtf/registry/lib/store/schema";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { deserializeFilters } from "./deserialize";
import { schemaToZod } from "./schema-to-zod";
import type { TableMCPConfig } from "./types";

function createServer<T extends SchemaDefinition, R = Record<string, unknown>>(
  config: TableMCPConfig<T, R>,
  filtersSchema: z.ZodObject<z.ZodRawShape>,
) {
  const server = new McpServer({
    name: config.name ?? "data-table",
    version: "1.0.0",
  });

  server.tool(
    "query_table",
    config.description,
    {
      filters: filtersSchema.optional(),
      format: z.enum(["json", "metadata"]).default("json"),
    },
    async ({ filters: rawFilters, format }) => {
      try {
        const filters = rawFilters
          ? deserializeFilters(config.schema, rawFilters)
          : {};

        const result = await config.getData({
          filters: filters as Parameters<typeof config.getData>[0]["filters"],
        });

        const output =
          format === "metadata"
            ? { total: result.total, facets: result.facets ?? {} }
            : { rows: result.rows, total: result.total };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output) }],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `getData failed: ${e instanceof Error ? e.message : String(e)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

export function createTableMCPHandler<
  T extends SchemaDefinition,
  R = Record<string, unknown>,
>(config: TableMCPConfig<T, R>) {
  const filtersSchema = schemaToZod(config.schema);

  return async function handler(request: Request): Promise<Response> {
    // A GET opens the standalone SSE stream for server-initiated messages.
    // This handler has none to send, and it closes its server as soon as the
    // response is returned — which would hand the client a stream that is
    // already at EOF, and some clients then reconnect in a loop. The spec's
    // answer for a server that doesn't offer that stream is 405, so routes can
    // keep exporting GET and get a correct reply.
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message:
              "Method Not Allowed: this server has no standalone SSE stream",
          },
          id: null,
        }),
        {
          status: 405,
          headers: {
            "content-type": "application/json",
            allow: "POST, DELETE",
          },
        },
      );
    }

    const server = createServer(config, filtersSchema);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await server.close();
    }
  };
}
