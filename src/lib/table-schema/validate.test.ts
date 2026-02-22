import { describe, expect, it } from "vitest";
import { col } from "./col";
import { validateSchema } from "./validate";

describe("validateSchema", () => {
  it("throws when a column is missing a label", () => {
    const def = { name: col.string() }; // no .label()
    expect(() => validateSchema(def)).toThrowError(
      '[createTableSchema] Column "name" is missing a label.',
    );
  });

  it("includes a capitalised fix hint in the missing-label error", () => {
    const def = { hostName: col.string() };
    expect(() => validateSchema(def)).toThrowError("HostName");
  });

  it("throws when slider min > max", () => {
    const def = {
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 100, max: 10 }),
    };
    expect(() => validateSchema(def)).toThrowError(
      "slider min (100) must be less than max (10)",
    );
  });

  it("throws when slider min and max are missing (undefined)", () => {
    // Inject a broken config directly to simulate what runtime fromJSON might produce
    const builder = col
      .number()
      .label("Latency")
      .filterable("slider", { min: 0, max: 5000 });
    // Override the filter to remove min/max
    const brokenConfig = {
      ...builder._config,
      filter: { ...builder._config.filter!, min: undefined, max: undefined },
    };
    const def = { latency: { _config: brokenConfig } as typeof builder };
    expect(() => validateSchema(def)).toThrowError(
      "slider filter is missing min/max bounds",
    );
  });

  it("does NOT throw when slider min equals max", () => {
    // min === max is edge-case but only min > max is rejected
    const def = {
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 50, max: 50 }),
    };
    expect(() => validateSchema(def)).not.toThrow();
  });

  it("does not throw for a valid schema with multiple column types", () => {
    const def = {
      name: col.string().label("Name"),
      count: col
        .number()
        .label("Count")
        .filterable("slider", { min: 0, max: 100 }),
      active: col.boolean().label("Active"),
      date: col.timestamp().label("Date"),
    };
    expect(() => validateSchema(def)).not.toThrow();
  });

  it("does not throw for a notFilterable column (filter is null)", () => {
    const def = { id: col.string().label("ID").notFilterable() };
    expect(() => validateSchema(def)).not.toThrow();
  });

  it("validates every column — throws on the second if first is valid", () => {
    const def = {
      valid: col.string().label("Valid"),
      unlabeled: col.number(), // missing label
    };
    expect(() => validateSchema(def)).toThrowError('"unlabeled"');
  });
});
