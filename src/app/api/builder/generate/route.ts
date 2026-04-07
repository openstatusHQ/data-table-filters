import { createAnthropic } from "@ai-sdk/anthropic";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import * as z from "zod";

const anthropic = createAnthropic({
  baseURL: "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

// Rate limiting — gracefully skipped if env vars are missing
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(5, "1 m"),
      })
    : null;

const inputSchema = z.object({
  description: z.string().min(1).max(500),
  rows: z.number().int().min(10).max(100).default(100),
});

/**
 * POST /api/builder/generate
 *
 * Body: { description: string, rows?: number }
 * Returns: Streamed text (JSON array of sample rows)
 *
 * The client reads the stream, parses the JSON, then calls POST /api/builder
 * for schema inference + caching.
 */
export async function POST(request: Request) {
  // Rate limit by IP
  if (ratelimit) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anonymous";
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 },
      );
    }
  }

  let input: z.infer<typeof inputSchema>;
  try {
    const body = await request.json();
    input = inputSchema.parse(body);
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid request. Provide a description (1-500 chars) and optional rows (10-100).",
      },
      { status: 400 },
    );
  }

  try {
    const result = streamText({
      model: anthropic("anthropic/claude-haiku-4-5-20251001"),
      system: `You generate realistic sample data for data tables. Output ONLY a valid JSON array (no wrapping object, no markdown fences) containing exactly ${input.rows} rows. Use semantically meaningful camelCase column names (e.g. statusCode, latency, region, createdAt, pathname). Include variety in values — don't repeat the same values across rows. For dates, use ISO 8601 strings. For IDs, use realistic formats. For enums/statuses, use 3-8 distinct values.`,
      prompt: input.description,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate data";
    const status = (error as { statusCode?: number })?.statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
