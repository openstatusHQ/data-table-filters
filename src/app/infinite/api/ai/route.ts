import { createAIFilterHandler } from "@/lib/ai/create-ai-filter-handler";
import { createAnthropic } from "@ai-sdk/anthropic";
import { tableSchema } from "../../table-schema";

const anthropic = createAnthropic({
  baseURL: "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

export const POST = createAIFilterHandler({
  model: anthropic("anthropic/claude-opus-4.5"),
  schema: tableSchema.definition,
});
