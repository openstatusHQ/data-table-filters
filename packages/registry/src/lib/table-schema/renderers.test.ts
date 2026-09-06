import { describe, expect, it, vi } from "vitest";
import { col, resolveColumns } from "./col";
import { createTableSchema } from "./index";
import {
  applyRenderers,
  isNamedDisplayType,
  NAMED_DISPLAY_TYPES,
} from "./renderers";

function schema() {
  return createTableSchema({
    uuid: col.string().label("ID"),
    level: col.enum(["error", "info"]).label("Level").filterable("checkbox"),
    latency: col.number().label("Latency").display("bar", { max: 1000 }),
  }).definition;
}

const cell = () => null;
const sheetComponent = () => null;

describe("applyRenderers", () => {
  it("returns the same definition when there are no overrides", () => {
    const definition = schema();
    expect(applyRenderers(definition, {})).toBe(definition);
  });

  it("attaches a cell renderer to the named column", () => {
    const result = applyRenderers(schema(), { uuid: { cell } });
    expect(result.uuid!._renderers.cell).toBe(cell);
  });

  it("leaves other columns untouched, by reference", () => {
    const definition = schema();
    const result = applyRenderers(definition, { uuid: { cell } });
    expect(result.level).toBe(definition.level);
    expect(result.latency).toBe(definition.latency);
  });

  it("does not mutate the input definition", () => {
    const definition = schema();
    applyRenderers(definition, { uuid: { cell } });
    expect(definition.uuid!._renderers.cell).toBeUndefined();
  });

  it("merges rather than replaces, so a partial override keeps the rest", () => {
    const first = applyRenderers(schema(), { uuid: { cell, sheetComponent } });
    const replacementCell = () => null;
    const second = applyRenderers(first, { uuid: { cell: replacementCell } });

    expect(second.uuid!._renderers.cell).toBe(replacementCell);
    expect(second.uuid!._renderers.sheetComponent).toBe(sheetComponent);
  });

  it("leaves the descriptor untouched, so the schema still round-trips", () => {
    const definition = schema();
    const before = createTableSchema(definition).toJSON();
    const after = createTableSchema(
      applyRenderers(definition, { latency: { cell } }),
    ).toJSON();

    expect(after).toEqual(before);
  });

  it("keeps the descriptor's display as the serialized fallback", () => {
    // The whole point: a custom cell draws locally, but the column still
    // declares `bar` on the wire so another consumer renders something sane.
    const result = applyRenderers(schema(), { latency: { cell } });
    const [, , latency] = resolveColumns(result);
    expect(latency!.display.type).toBe("bar");
    expect(latency!.renderers.cell).toBe(cell);
  });

  it("warns for an override whose column does not exist", () => {
    const onUnknownKey = vi.fn();
    applyRenderers(schema(), { ghost: { cell } }, { onUnknownKey });
    expect(onUnknownKey).toHaveBeenCalledWith("ghost");
  });

  it("still applies the valid overrides alongside an unknown one", () => {
    const onUnknownKey = vi.fn();
    const result = applyRenderers(
      schema(),
      { ghost: { cell }, uuid: { cell } },
      { onUnknownKey },
    );
    expect(result.uuid!._renderers.cell).toBe(cell);
    expect(Object.keys(result)).toEqual(["uuid", "level", "latency"]);
  });

  it("attaches every renderer kind", () => {
    const filterComponent = () => null;
    const sheetCondition = () => true;
    const result = applyRenderers(schema(), {
      level: { cell, filterComponent, sheetComponent, sheetCondition },
    });

    expect(result.level!._renderers).toMatchObject({
      cell,
      filterComponent,
      sheetComponent,
      sheetCondition,
    });
  });

  it("works on a schema reconstructed from JSON", () => {
    // The real path: a manifest arrives, is deserialized, and the app adds the
    // one or two renderers it wants.
    const json = createTableSchema(schema()).toJSON();
    const { definition } = createTableSchema.fromJSON(json);
    const result = applyRenderers(definition, { uuid: { cell } });

    expect(result.uuid!._renderers.cell).toBe(cell);
    expect(Object.keys(result)).toEqual(["uuid", "level", "latency"]);
  });
});

describe("named display types", () => {
  it("recognises every type the descriptor can name", () => {
    for (const type of NAMED_DISPLAY_TYPES) {
      expect(isNamedDisplayType(type)).toBe(true);
    }
  });

  it("does not treat `custom` as a named type", () => {
    // `custom` carries a closure; it is precisely the one that cannot travel.
    expect(isNamedDisplayType("custom")).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(isNamedDisplayType("sparkline")).toBe(false);
  });
});
