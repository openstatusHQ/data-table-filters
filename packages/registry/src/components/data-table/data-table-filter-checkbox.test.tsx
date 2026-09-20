import { DataTableFilterCheckbox } from "@dtf/registry/components/data-table/data-table-filter-checkbox";
import { DataTableContext } from "@dtf/registry/components/data-table/data-table-provider";
import type { CheckboxOptionProps } from "@dtf/registry/components/data-table/types";
import type { ContextType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

// The filter reads four things off the context; a real table adds nothing to
// what is under test here.
const context = {
  table: { getColumn: () => undefined },
  columnFilters: [],
  isLoading: false,
} as unknown as ContextType<typeof DataTableContext>;

describe("DataTableFilterCheckbox", () => {
  it("hands the option component the options it is rendered in", () => {
    // Options can come from facets, after the component was created: anything
    // that depends on the siblings (label alignment) has to get them here.
    const options = [
      { label: "info", value: "info" },
      { label: "warning", value: "warning" },
    ];
    const seen: CheckboxOptionProps[] = [];

    renderToStaticMarkup(
      <DataTableContext.Provider value={context}>
        <DataTableFilterCheckbox
          type="checkbox"
          label="Level"
          value="level"
          options={options}
          component={(props) => {
            seen.push(props);
            return <span>{props.label}</span>;
          }}
        />
      </DataTableContext.Provider>,
    );

    expect(seen.map((props) => props.label)).toEqual(["info", "warning"]);
    for (const props of seen) expect(props.options).toBe(options);
  });
});
