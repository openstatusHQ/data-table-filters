import { describe, expect, it } from "vitest";
import { field } from "../../schema/field";
import {
  getFilterSliceKeys,
  createFilterSlice,
  getFilterSliceFromState,
} from "./slice";

// ── getFilterSliceKeys ───────────────────────────────────────────────────────

describe("getFilterSliceKeys", () => {
  it("generates namespaced keys from tableId", () => {
    const keys = getFilterSliceKeys("my-table");
    expect(keys.state).toBe("filters_my-table");
    expect(keys.paused).toBe("filters_my-table_paused");
    expect(keys.pending).toBe("filters_my-table_pending");
    expect(keys.setFilters).toBe("setFilters_my-table");
    expect(keys.resetFilters).toBe("resetFilters_my-table");
    expect(keys.pauseFilters).toBe("pauseFilters_my-table");
    expect(keys.resumeFilters).toBe("resumeFilters_my-table");
  });

  it("generates different keys for different tableIds", () => {
    const keys1 = getFilterSliceKeys("table-a");
    const keys2 = getFilterSliceKeys("table-b");
    expect(keys1.state).not.toBe(keys2.state);
  });
});

// ── createFilterSlice ────────────────────────────────────────────────────────

describe("createFilterSlice", () => {
  const schema = {
    level: field.array(field.stringLiteral(["error", "warn"] as const)),
    path: field.string(),
  };

  function createMockStore() {
    let state: Record<string, unknown> = {};
    const set = (partial: Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown>)) => {
      if (typeof partial === "function") {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
    };
    const get = () => state;

    const slice = createFilterSlice(schema, "test", set, get);
    state = { ...slice };

    return { state: () => state, set, get, slice };
  }

  it("initializes with schema defaults", () => {
    const { state } = createMockStore();
    expect(state()["filters_test"]).toEqual({ level: [], path: null });
  });

  it("initializes paused=false and pending=null", () => {
    const { state } = createMockStore();
    expect(state()["filters_test_paused"]).toBe(false);
    expect(state()["filters_test_pending"]).toBeNull();
  });

  it("setFilters updates state", () => {
    const { state } = createMockStore();
    const setFilters = state()["setFilters_test"] as (p: any) => void;
    setFilters({ level: ["error"] });
    expect((state()["filters_test"] as any).level).toEqual(["error"]);
  });

  it("setFilters stores to pending when paused", () => {
    const { state } = createMockStore();
    const pauseFilters = state()["pauseFilters_test"] as () => void;
    pauseFilters();

    const setFilters = state()["setFilters_test"] as (p: any) => void;
    setFilters({ level: ["error"] });

    // State unchanged, pending has the update
    expect((state()["filters_test"] as any).level).toEqual([]);
    expect(state()["filters_test_pending"]).toEqual({ level: ["error"] });
  });

  it("resumeFilters applies pending changes", () => {
    const { state } = createMockStore();
    const pauseFilters = state()["pauseFilters_test"] as () => void;
    const setFilters = state()["setFilters_test"] as (p: any) => void;
    const resumeFilters = state()["resumeFilters_test"] as () => void;

    pauseFilters();
    setFilters({ level: ["warn"] });
    resumeFilters();

    expect((state()["filters_test"] as any).level).toEqual(["warn"]);
    expect(state()["filters_test_paused"]).toBe(false);
    expect(state()["filters_test_pending"]).toBeNull();
  });

  it("resumeFilters with no pending changes just unpauses", () => {
    const { state } = createMockStore();
    const pauseFilters = state()["pauseFilters_test"] as () => void;
    const resumeFilters = state()["resumeFilters_test"] as () => void;

    pauseFilters();
    resumeFilters();

    expect(state()["filters_test_paused"]).toBe(false);
    expect((state()["filters_test"] as any).level).toEqual([]);
  });

  it("resetFilters resets specific fields to defaults", () => {
    const { state } = createMockStore();
    const setFilters = state()["setFilters_test"] as (p: any) => void;
    const resetFilters = state()["resetFilters_test"] as (fields?: string[]) => void;

    setFilters({ level: ["error"], path: "test" });
    resetFilters(["level"]);

    expect((state()["filters_test"] as any).level).toEqual([]);
    expect((state()["filters_test"] as any).path).toBe("test");
  });

  it("resetFilters without fields resets all to defaults", () => {
    const { state } = createMockStore();
    const setFilters = state()["setFilters_test"] as (p: any) => void;
    const resetFilters = state()["resetFilters_test"] as () => void;

    setFilters({ level: ["error"], path: "test" });
    resetFilters();

    expect(state()["filters_test"]).toEqual({ level: [], path: null });
  });

  it("accepts initialState override", () => {
    let state: Record<string, unknown> = {};
    const set = (partial: any) => { state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) }; };
    const get = () => state;

    const slice = createFilterSlice(schema, "t", set, get, { level: ["warn"] });
    state = { ...slice };

    expect((state["filters_t"] as any).level).toEqual(["warn"]);
  });
});

// ── getFilterSliceFromState ──────────────────────────────────────────────────

describe("getFilterSliceFromState", () => {
  it("returns null when slice is not in state", () => {
    expect(getFilterSliceFromState({}, "unknown")).toBeNull();
  });

  it("extracts filter slice from state", () => {
    const state: Record<string, unknown> = {
      "filters_test": { level: [] },
      "filters_test_paused": false,
      "filters_test_pending": null,
      "setFilters_test": () => {},
      "resetFilters_test": () => {},
      "pauseFilters_test": () => {},
      "resumeFilters_test": () => {},
    };
    const slice = getFilterSliceFromState(state, "test");
    expect(slice).not.toBeNull();
    expect(slice!.filters).toEqual({ level: [] });
    expect(slice!.filtersPaused).toBe(false);
    expect(slice!.filtersPending).toBeNull();
    expect(typeof slice!.setFilters).toBe("function");
    expect(typeof slice!.resetFilters).toBe("function");
    expect(typeof slice!.pauseFilters).toBe("function");
    expect(typeof slice!.resumeFilters).toBe("function");
  });
});
