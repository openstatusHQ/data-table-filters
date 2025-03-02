How we optimize our data-table components

First of all, tanstack table already comes very optimized.

But the issue starts over time, if you don't pay attention on how you pass your props to the child and to the child,... you get lost in where to start. Hard to tell, cuz you the intuital way is bottom to top as you can find unoptimized and have quick wins as you see the performance boost quickly. It only hits when you realize that maybe, that optimization hack doesn't need to have appened in the first place if you'd have optimized the prop previously. This applies to prop drilling as well as context passing props.

As our root data table includes much more than just a table, but also the filter controls sidebar, chart, command input and toolbar, we have to avoid to render the components, if they don’t change.

memo

Don't underestimate memoizing components. Be it big components or smaller but plenty of them (e.g. the rows on refetch) - this is crutial. The live mode option fetches new data ever 4 seconds. We only want to rerender iff components have changed depending on the really needed props.

Another option could be that

```tsx
export const DataTableSheetContent = () => {
  /* ... */
};

export const MemoizedDataTableSheetContent = React.memo(
  DataTableSheetContent,
  (prev, next) => {
    // REMINDER: only check if data is the same, rest is useless
    return prev.data === next.data;
  }
) as typeof DataTableSheetContent;
```

Provider

Drawback: All `table.function()` are being memoized and will not work in a context if components don’t render properly. Sometimes, you depend on functions to get the table data, like `table.getPageCount()`.

Example from `DataTablePagination`:

```tsx
import { useMemo } from "react";

export function DataTablePagination() {
  // avoid `table.getState().pagination.pageSize` and instead use the
  // const [pagination, _] = React.useState<PaginationState>({ pageSize: 10, pageIndex: 0 })
  const { table, columnFilters, pagination } = useDataTable();
  const pageCount = useMemo(() => table.getPageCount(), [columnFilters]);

  return; /** ... */
}
```

Memoize the props passed to the context provider. If they are not stable, you will see much more rerenders than necessary. Be it using states, refs, or transforming/calculating new values (useMemo). That way, their ... is same and the component using that value via the `useContext` hook will not rerender. This can get lost with too many properties. Not sure if using a state management lib will solve that problem.

> Right now, it is a clear mix of prop drilling and using context provider and hooks to access the props. Both have their valid usage and just grow the project size.
