# AI Filters

**Install:** `npx shadcn@latest add https://data-table-filters.com/r/data-table-filter-command-ai.json`

## Overview

AI-powered filter inference that translates natural language queries into structured table filters. Provider-agnostic — the library ships prompt generation, Zod output schemas, and streaming helpers. You bring your own LLM.

## Library Exports (`@/lib/ai`)

| Export                                     | Purpose                                                      |
| ------------------------------------------ | ------------------------------------------------------------ |
| `generateAIContext(schema)`                | Structured field metadata from table schema                  |
| `generateAIPrompt(schema, { now? })`       | Ready-to-use LLM system prompt                               |
| `generateAIOutputSchema(schema)`           | Zod schema for LLM structured output                         |
| `diffPartialState(prev, next, schema)`     | Type-aware stream diffing for progressive filter application |
| `parseAIResponse(schema, response)`        | Final validation + ISO→Date conversion                       |
| `isStructuredQuery(input, schema)`         | Detect `key:value` vs natural language                       |
| `createAIFilterHandler({ model, schema })` | Factory for Next.js API route POST handler                   |

## API Route Setup

### Direct Provider (recommended for most users)

```ts
// app/api/ai-filters/route.ts
import { anthropic } from "@ai-sdk/anthropic";
import { createAIFilterHandler } from "@/lib/ai";
import { tableSchema } from "../table-schema";

export const POST = createAIFilterHandler({
  model: anthropic("claude-sonnet-4-20250514"),
  schema: tableSchema.definition,
});
```

Requires `ANTHROPIC_API_KEY` in `.env`. Swap `anthropic(...)` for any Vercel AI SDK provider: `openai("gpt-4o-mini")`, `google("gemini-2.0-flash")`, etc.

### Vercel AI Gateway (used by the live demo)

```ts
// app/api/ai-filters/route.ts
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAIFilterHandler } from "@/lib/ai";
import { tableSchema } from "../table-schema";

const anthropic = createAnthropic({
  baseURL: "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

export const POST = createAIFilterHandler({
  model: anthropic("anthropic/claude-sonnet-4-20250514"),
  schema: tableSchema.definition,
});
```

Requires `AI_GATEWAY_API_KEY` in `.env`.

## Component Wiring

Replace `DataTableFilterCommand` with `DataTableFilterAICommand`:

```tsx
import { DataTableFilterAICommand } from "@/components/data-table/data-table-filter-command-ai";

<DataTableInfinite
  commandSlot={
    <DataTableFilterAICommand
      schema={filterSchema.definition}
      tableSchema={tableSchema.definition}
      api="/api/ai-filters"
      tableId="my-table"
    />
  }
/>;
```

### Props

| Prop          | Type                    | Description                                   |
| ------------- | ----------------------- | --------------------------------------------- |
| `schema`      | `SchemaDefinition`      | BYOS schema for structured query parsing      |
| `tableSchema` | `TableSchemaDefinition` | Table schema for AI context generation        |
| `api`         | `string`                | API endpoint that streams AI results          |
| `tableId`     | `string`                | localStorage namespace (default: `"default"`) |

## How It Works

1. User types in command palette
2. On Enter: `isStructuredQuery()` checks if input is `key:value` format
   - **Yes** → existing structured parser handles it instantly
   - **No** → palette closes, AI call fires
3. API route streams structured JSON via `streamObject`
4. Client applies filters progressively via `diffPartialState`:
   - `input`/`checkbox`: applied immediately, updated as values grow
   - `slider`/`timerange`: wait for both tuple values before applying
5. On stream end: `parseAIResponse` validates the complete object

## UI Differences from Base Command Palette

- Placeholder: `Try "5xx errors in production last 24h"…`
- `↵ infer` hint (right-aligned) when input is natural language
- Footer switches to `✦ describe your query to infer filters`
- `isPending` spinner when AI is streaming

## Schema Considerations

### `description` fields improve AI accuracy

Descriptions are essential for AI filtering. Without them, the AI only sees field names and types. Add `.description()` to columns for better inference:

```ts
host: col.string().label("Host").description("Origin server hostname").filterable("input"),
latency: col.number().label("Latency").description("Response time in ms").filterable("slider", { min: 0, max: 5000, unit: "ms" }),
```

### `commandDisabled` fields are still available to AI

Fields with `.commandDisabled()` are hidden from manual command palette suggestions but **still included in the AI prompt**. This is intentional — some fields (like date ranges) are hard to use with `key:value` syntax but easy to express in natural language (e.g., _"last 24 hours"_).

## Dependencies

- `ai` — Vercel AI SDK (server-side `streamObject`)
- `@ai-sdk/react` — Client-side `useObject` hook
- `@ai-sdk/<provider>` — Your chosen LLM provider
- `zod` — Output schema generation

## Building Custom Integrations

If you don't use Vercel AI SDK, use the library exports directly:

```ts
// Generate prompt + schema
const prompt = generateAIPrompt(tableSchema.definition, { now: new Date() });
const schema = generateAIOutputSchema(tableSchema.definition);

// Your custom LLM call returns a JSON object
const response = await yourLLM({ system: prompt, schema });

// Validate + apply
const state = parseAIResponse(tableSchema.definition, response);
if (state) {
  for (const [key, value] of Object.entries(state)) {
    adapter.setField(key, value);
  }
}
```

## Documentation

The dedicated docs page lives at `src/content/docs/09-ai-filters.mdx` (route: `/docs/ai-filters`). It covers installation, prerequisites, API route setup (direct Anthropic + Vercel AI Gateway), client integration, how it works, schema considerations, and customization. AI filter mentions also appear in:

- `01-quick-start.mdx` — registry blocks table
- `02-table-schema.mdx` — `description` and `commandDisabled` + AI behavior
- `04-ui-components.mdx` — command palette section
- `07-drizzle-orm.mdx` — file checklist and API route step
- `10-full-example.mdx` — render step with `commandSlot`
