import { col } from "./col";
import type {
  ColBuilder,
  ColConfig,
  ColumnDescriptor,
  DisplayConfig,
  FilterDescriptor,
  SchemaJSON,
  SerializableDisplayConfig,
  SheetDescriptor,
  TableSchemaDefinition,
} from "./types";

// ── Serialization (schema → JSON) ────────────────────────────────────────────

function serializeFilter(filter: ColConfig["filter"]): FilterDescriptor | null {
  if (!filter) return null;
  const descriptor: FilterDescriptor = {
    type: filter.type,
    defaultOpen: filter.defaultOpen,
    commandDisabled: filter.commandDisabled,
  };
  if (filter.options) {
    descriptor.options = filter.options.map((o) => ({
      label: o.label,
      value: o.value as string | number | boolean,
    }));
  }
  if (filter.min !== undefined) descriptor.min = filter.min;
  if (filter.max !== undefined) descriptor.max = filter.max;
  // filter.component and filter.presets are functions/complex objects — stripped
  return descriptor;
}

function serializeSheet(sheet: ColConfig["sheet"]): SheetDescriptor | null {
  if (!sheet) return null;
  const descriptor: SheetDescriptor = {};
  if (sheet.label) descriptor.label = sheet.label;
  if (sheet.className) descriptor.className = sheet.className;
  if (sheet.skeletonClassName)
    descriptor.skeletonClassName = sheet.skeletonClassName;
  // sheet.component and sheet.condition are functions — stripped
  return descriptor;
}

function serializeDisplay(display: DisplayConfig): SerializableDisplayConfig {
  switch (display.type) {
    case "custom":
      // Custom renderers are not serializable — fall back to text
      return { type: "text" };
    case "number": {
      const d: SerializableDisplayConfig = { type: "number" };
      if (display.unit)
        (d as { type: "number"; unit?: string }).unit = display.unit;
      if (display.colorMap)
        (d as { colorMap?: Record<string, string> }).colorMap =
          display.colorMap;
      return d;
    }
    case "bar": {
      const d = { type: "bar" as const, min: display.min, max: display.max };
      return {
        ...d,
        ...(display.unit ? { unit: display.unit } : {}),
        ...(display.colorMap ? { colorMap: display.colorMap } : {}),
      };
    }
    case "heatmap": {
      const d = {
        type: "heatmap" as const,
        min: display.min,
        max: display.max,
      };
      return {
        ...d,
        ...(display.color ? { color: display.color } : {}),
        ...(display.colorMap ? { colorMap: display.colorMap } : {}),
      };
    }
    default: {
      const d: SerializableDisplayConfig = { type: display.type };
      if (display.colorMap)
        (d as { colorMap?: Record<string, string> }).colorMap =
          display.colorMap;
      return d;
    }
  }
}

export function serializeSchema(definition: TableSchemaDefinition): SchemaJSON {
  const columns: ColumnDescriptor[] = Object.entries(definition).map(
    ([key, builder]) => {
      const c = builder._config;
      const descriptor: ColumnDescriptor = {
        key,
        label: c.label,
        dataType: c.kind,
        optional: c.optional,
        hidden: c.hidden,
        sortable: c.sortable,
        display: serializeDisplay(c.display),
        filter: serializeFilter(c.filter),
        sheet: serializeSheet(c.sheet),
      };
      if (c.description) descriptor.description = c.description;
      if (c.enumValues) descriptor.enumValues = c.enumValues;
      if (c.arrayItem) {
        descriptor.arrayItemType = {
          dataType: c.arrayItem.kind,
          ...(c.arrayItem.enumValues
            ? { enumValues: c.arrayItem.enumValues }
            : {}),
        };
      }
      if (c.size !== undefined) descriptor.size = c.size;
      if (c.hideHeader) descriptor.hideHeader = true;
      if (c.enableHiding === false) descriptor.enableHiding = false;
      return descriptor;
    },
  );
  return { columns };
}

// ── Deserialization (JSON → schema) ─────────────────────────────────────────
//
// Reconstructs col.* builders from a SchemaJSON descriptor.
// Limitation: custom renderers (display.cell, filter.component, sheet.component,
// sheet.condition) are not serialized and therefore cannot be reconstructed.
// Columns with display.type === "custom" fall back to the col kind's default
// display. Developers can override renderers on the returned builders.

export function deserializeSchema(json: SchemaJSON): TableSchemaDefinition {
  const definition: TableSchemaDefinition = {};

  for (const col_ of json.columns) {
    // 1. Pick the right col.* factory.
    // F is typed as `any` on the variable so we can call filterable() dynamically
    // without knowing the col kind at compile time — this is intentional since
    // deserializeSchema is a runtime operation reading from JSON.

    let builder: ColBuilder<unknown, any> =
      col_.dataType === "select"
        ? col.select()
        : col_.dataType === "enum" && col_.enumValues
          ? col.enum(col_.enumValues as readonly string[])
          : col_.dataType === "array" &&
              col_.arrayItemType?.dataType === "enum" &&
              col_.arrayItemType.enumValues
            ? col.array(
                col.enum(col_.arrayItemType.enumValues as readonly string[]),
              )
            : col_.dataType === "boolean"
              ? col.boolean()
              : col_.dataType === "timestamp"
                ? col.timestamp()
                : col_.dataType === "number"
                  ? col.number()
                  : col_.dataType === "record"
                    ? col.record()
                    : col.string();

    // 2. Label + description
    builder = builder.label(col_.label);
    if (col_.description) builder = builder.description(col_.description);

    // 3. Display
    const display = col_.display;
    if (display.type === "number") {
      const opts: { unit?: string; colorMap?: Record<string, string> } = {};
      if (display.unit) opts.unit = display.unit;
      if (display.colorMap) opts.colorMap = display.colorMap;
      builder = builder.display(
        "number",
        Object.keys(opts).length > 0 ? opts : undefined,
      );
    } else if (display.type === "bar") {
      builder = builder.display("bar", {
        min: display.min,
        max: display.max,
        ...(display.unit ? { unit: display.unit } : {}),
        ...(display.colorMap ? { colorMap: display.colorMap } : {}),
      });
    } else if (display.type === "heatmap") {
      builder = builder.display("heatmap", {
        min: display.min,
        max: display.max,
        ...(display.color ? { color: display.color } : {}),
        ...(display.colorMap ? { colorMap: display.colorMap } : {}),
      });
    } else if (
      display.type === "text" ||
      display.type === "code" ||
      display.type === "boolean" ||
      display.type === "star" ||
      display.type === "badge" ||
      display.type === "timestamp" ||
      display.type === "status-code" ||
      display.type === "level-indicator"
    ) {
      builder = builder.display(
        display.type,
        display.colorMap ? { colorMap: display.colorMap } : undefined,
      );
    }

    // 4. Filter
    if (col_.filter === null) {
      builder = builder.notFilterable();
    } else {
      const f = col_.filter;
      if (f.type === "slider" && f.min !== undefined && f.max !== undefined) {
        builder = builder.filterable("slider", { min: f.min, max: f.max });
      } else if (f.type === "checkbox") {
        builder = builder.filterable("checkbox", {
          ...(f.options ? { options: f.options } : {}),
        });
      } else if (f.type === "timerange") {
        builder = builder.filterable("timerange");
      } else {
        builder = builder.filterable("input");
      }
      if (f.defaultOpen) builder = builder.defaultOpen();
      if (f.commandDisabled) builder = builder.commandDisabled();
    }

    // 5. Structural modifiers
    // sheetOnly() sets both enableHiding: false AND hidden: true.
    // enableHiding: false alone (e.g. col.select()) should NOT trigger sheetOnly().
    if (col_.enableHiding === false && col_.hidden) {
      builder = builder.sheetOnly();
    } else if (col_.hidden) {
      builder = builder.hidden();
    }
    if (col_.hideHeader) builder = builder.hideHeader();
    if (col_.sortable) builder = builder.sortable();
    if (col_.optional) builder = builder.optional();
    if (col_.size !== undefined) builder = builder.size(col_.size);

    // 6. Sheet
    if (col_.sheet !== null) {
      builder = builder.sheet({
        ...(col_.sheet.label ? { label: col_.sheet.label } : {}),
        ...(col_.sheet.className ? { className: col_.sheet.className } : {}),
        ...(col_.sheet.skeletonClassName
          ? { skeletonClassName: col_.sheet.skeletonClassName }
          : {}),
      });
    }

    definition[col_.key] = builder;
  }

  return definition;
}
