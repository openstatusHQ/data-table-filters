import { describe, expect, it } from "vitest";
import { quickStartBlocks, quickStartSample } from "./harness";

// The install harness reads the Quick Start page rather than a hard-coded
// block list, so these pin what it reads: the fenced install command names
// real blocks by their directory name, and the sample it pastes exists.

describe("quickStartBlocks", () => {
  it("reads the two Quick Start blocks from the namespaced install command", () => {
    expect(quickStartBlocks()).toEqual(["data-table", "data-table-schema"]);
  });
});

describe("quickStartSample", () => {
  it("is the tsx the Quick Start tells a reader to paste", () => {
    expect(quickStartSample()).toContain("DataTableAuto");
  });
});
