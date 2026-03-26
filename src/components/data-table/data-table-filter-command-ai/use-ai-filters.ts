import {
  diffPartialState,
  generateAIOutputSchema,
  isStructuredQuery,
  parseAIResponse,
} from "@/lib/ai";
import type { TableSchemaDefinition } from "@/lib/table-schema";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useCallback, useEffect, useRef } from "react";

export type UseAIFiltersOptions = {
  /** The API endpoint that streams AI filter results */
  api: string;
  /** Table schema definition for generating the output schema and detecting structured queries */
  tableSchema: TableSchemaDefinition;
  /** Called for each progressively completed field */
  onField: (key: string, value: unknown) => void;
  /** Called with the final validated state on stream end */
  onFinish: (state: Record<string, unknown>) => void;
  /** Called when the AI call fails */
  onError?: (error: Error) => void;
  /** Called before AI filters are applied — use to reset existing filters */
  onStart?: () => void;
};

export function useAIFilters({
  api,
  tableSchema,
  onField,
  onFinish,
  onError,
  onStart,
}: UseAIFiltersOptions) {
  const prevRef = useRef<Record<string, unknown>>({});
  const outputSchema = generateAIOutputSchema(tableSchema);

  const { submit, object, isLoading, error } = useObject({
    api,
    schema: outputSchema,
    onFinish({ object }) {
      if (!object) return;
      const validated = parseAIResponse(
        tableSchema,
        object as Record<string, unknown>,
      );
      if (validated) {
        console.log("[ai-filters] final →", validated);
        onFinish(validated);
      }
      prevRef.current = {};
    },
    onError(error) {
      prevRef.current = {};
      onError?.(error);
    },
  });

  // Progressive application via diffPartialState
  useEffect(() => {
    if (!object) return;
    const next = object as Record<string, unknown>;
    const completed = diffPartialState(prevRef.current, next, tableSchema);
    for (const { key, value } of completed) {
      console.log(`[ai-filters] stream → ${key}:`, value);
      onField(key, value);
    }
    prevRef.current = { ...next };
  }, [object]); // eslint-disable-line react-hooks/exhaustive-deps

  const infer = useCallback(
    (query: string): boolean => {
      if (isStructuredQuery(query, tableSchema)) return false;
      const trimmed = query.trim();
      if (!trimmed) return false;

      console.log("[ai-filters] infer →", trimmed);
      onStart?.();
      prevRef.current = {};
      submit({ query: trimmed });
      return true;
    },
    [submit, tableSchema, onStart],
  );

  return { infer, isLoading, error };
}
