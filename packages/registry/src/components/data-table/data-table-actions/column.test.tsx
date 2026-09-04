import { describe, expect, it } from "vitest";
import { createActionsColumn } from "./column";

type Row = { id: string };

describe("createActionsColumn", () => {
  it("defaults to a hideable, non-resizable 40px column with id 'actions'", () => {
    const col = createActionsColumn<Row>();
    expect(col.id).toBe("actions");
    expect(col.size).toBe(40);
    expect(col.minSize).toBe(40);
    expect(col.maxSize).toBe(40);
    // Hideable so consumers can ship it hidden by default and let users
    // enable it from the view options.
    expect(col.enableHiding).toBe(true);
    expect(col.enableSorting).toBe(false);
    expect(col.enableResizing).toBe(false);
    expect(col.meta).toMatchObject({ label: "Actions", kind: "actions" });
  });

  it("honors id and size overrides", () => {
    const col = createActionsColumn<Row>({ id: "row-actions", size: 37 });
    expect(col.id).toBe("row-actions");
    expect(col.size).toBe(37);
    expect(col.minSize).toBe(37);
    expect(col.maxSize).toBe(37);
  });
});
