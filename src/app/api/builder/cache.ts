import type { SchemaJSON } from "@/lib/table-schema";

type BuilderCacheEntry = {
  data: Record<string, unknown>[];
  schemaJson: SchemaJSON;
};

const cache = new Map<string, BuilderCacheEntry>();

export function storeBuilderData(
  data: Record<string, unknown>[],
  schemaJson: SchemaJSON,
): string {
  const dataId = crypto.randomUUID();
  cache.set(dataId, { data, schemaJson });
  return dataId;
}

export function getBuilderData(dataId: string): BuilderCacheEntry | undefined {
  return cache.get(dataId);
}

export function updateBuilderSchema(
  dataId: string,
  schemaJson: SchemaJSON,
): boolean {
  const entry = cache.get(dataId);
  if (!entry) return false;
  entry.schemaJson = schemaJson;
  return true;
}
