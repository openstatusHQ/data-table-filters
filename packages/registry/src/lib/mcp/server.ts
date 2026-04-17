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
