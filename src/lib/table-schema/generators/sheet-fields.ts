import type { SheetField } from "@/components/data-table/types";
import type { ColConfig, TableSchemaDefinition } from "../types";

function defaultDisplayForKind(kind: ColConfig["kind"]): string {
  switch (kind) {
    case "enum":
    case "array":
      return "badge";
    case "boolean":
      return "boolean";
    case "timestamp":
      return "timestamp";
    case "number":
      return "number";
    case "string":
    case "record":
    default:
      return "text";
  }
}

function getDisplayDescriptor(config: ColConfig): {
  type: string;
  unit?: string;
  colorMap?: Record<string, string>;
} {
  const type =
    config.display.type === "custom"
      ? defaultDisplayForKind(config.kind)
      : config.display.type;
  const desc: {
    type: string;
    unit?: string;
    colorMap?: Record<string, string>;
  } = { type };
  if (
    config.display.type === "number" &&
    "unit" in config.display &&
    config.display.unit
  ) {
    desc.unit = config.display.unit;
  }
  if (config.display.colorMap) {
    desc.colorMap = config.display.colorMap;
  }
  return desc;
}

/**
 * Generate SheetField[] from a table schema definition.
 *
 * Only includes fields where sheet !== null (.sheet() was called).
 * Sheet type is derived from the filter type, or "readonly" if not filterable.
 * Sheet label falls back to the column label if not overridden in .sheet({ label }).
 */
export function generateSheetFields<TData>(
  schema: TableSchemaDefinition,
): SheetField<TData>[] {
  const result: SheetField<TData>[] = [];

  for (const [key, builder] of Object.entries(schema)) {
    const config = builder._config;
    if (config.sheet === null) continue;

    const sheetConfig = config.sheet;
    const filterConfig = config.filter;

    // Derive sheet type from filter type, or "readonly" if not filterable
    const sheetType: SheetField<TData>["type"] =
      filterConfig?.type ?? "readonly";

    result.push({
      id: key as keyof TData,
      label: sheetConfig.label ?? config.label,
      type: sheetType,
      display: getDisplayDescriptor(config),
      component: sheetConfig.component as SheetField<TData>["component"],
      condition: sheetConfig.condition as SheetField<TData>["condition"],
      className: sheetConfig.className,
      skeletonClassName: sheetConfig.skeletonClassName,
    });
  }

  return result;
}
