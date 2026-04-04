import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import type { SchemaDefinition } from "@/lib/store/schema";
import type { TableMCPConfig } from "./types";
import { schemaToZod } from "./schema-to-zod";
import { deserializeFilters } from "./deserialize";

function createServer<
  T extends SchemaDefinition,
  R = Record<string, unknown>,
>(config: TableMCPConfig<T, R>, maxPageSize: number, filtersSchema: z.ZodObject<z.ZodRawShape>) {
  const server = new McpServer({
    name: config.name ?? "data-table",
    version: "1.0.0",
  });

  server.tool(
    "query_table",
    config.description,
    {
      filters: filtersSchema.optional(),
      page: z.number().int().default(1),
      pageSize: z.number().int().default(50).refine((n) => n <= maxPageSize, {
        message: `pageSize must be <= ${maxPageSize}`,
      }),
      format: z.enum(["json", "stats"]).default("json"),
    },
    async ({ filters: rawFilters, page, pageSize, format }) => {
      try {
        const filters = rawFilters
          ? deserializeFilters(config.schema, rawFilters)
          : {};

        const result = await config.getData({
          filters: filters as Parameters<typeof config.getData>[0]["filters"],
          page,
          pageSize,
        });

        const output =
          format === "stats"
            ? { total: result.total, facets: result.facets ?? {} }
            : { rows: result.rows, total: result.total, page, pageSize };

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
  const maxPageSize = config.maxPageSize ?? 500;
  const filtersSchema = schemaToZod(config.schema);

  return async function handler(request: Request): Promise<Response> {
    const server = createServer(config, maxPageSize, filtersSchema);
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
