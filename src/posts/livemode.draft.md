# How we leverage TanStack Infinite Query for implementing live mode

While TanStack provides excellent [documentation on Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries), this article offers an additional practical example focusing on implementing live data updates.

## Basic Concept

Infinite queries work with "pages" of data. Each time you load new data, a new "page" is either appended or prepended to the `data.pages` array. To get a flat list of all data in the correct order, you simply use `flatMap`:

```ts
const { data, fetchNextPage, fetchPreviousPage } =
  useInfiniteQuery(dataOptions);

const flatData = React.useMemo(
  () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
  [data?.pages],
);
```

[!scribble]

Once we understand the _load more_ (append data) functionality, we can mirror this approach to implement _live mode_ (prepend data).

Each query requires two key parameters:

1. A `cursor` - a pointer indicating a position in the dataset
2. A `direction` - specifying whether to fetch data before or after the cursor ("prev" or "next")

In our implementation, the `cursor` is a timestamp representing the last checked date:

```ts
const dataOptions = {
  queryKey: "data-table",
  queryFn: async ({ pageParam }) => {
    const { cursor, direction } = pageParam;
    const res = await fetch(
      `/api/get/data?cursor=${cursor}&direction=${direction}`,
    );
    const json = await res.json();
    // For direction "next": { data: [...], nextCursor: 1741526294, prevCursor: null }
    // For direction "prev": { data: [...], nextCursor: null, prevCursor: 1741526295 }
    return json as ReturnType;
  },
  // Initialize with current timestamp for "load more" functionality
  initialPageParam: { cursor: new Date().getTime(), direction: "next" },
  getPreviousPageParam: (firstPage, allPages) => {
    if (!firstPage.prevCursor) return null;
    return { cursor: firstPage.prevCursor, direction: "prev" };
  },
  getNextPageParam: (lastPage, allPages) => {
    if (!lastPage.nextCursor) return null;
    return { cursor: lastPage.nextCursor, direction: "next" };
  },
};
```

The `getPreviousPageParam` and `getNextPageParam` functions receive the first and last pages respectively as their first parameter. This allows us to access the `prevCursor` and `nextCursor` values to track our position when loading more items or checking for updates in live mode.

TanStack provides helpful states like `isFetchingNextPage` and `isFetchingPreviousPage` for loading indicators, as well as `hasNextPage` and `hasPreviousPage` to check for available pages - especially useful for as we can hit the end of the load more values.

Your API endpoint should return at minimum:

```ts
type ReturnType<T> = {
  data: T[];
  nextCursor?: number | null;
  prevCursor?: number | null;
};
```

When fetching older pages ("next" direction), we set a `LIMIT` (e.g., 40 items). However, when fetching newer data ("prev" direction), we return all data between the `prevCursor` and `Date.now()`.

Example API implementation:

```ts
export async function GET(req: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get("cursor");
  const direction = searchParams.get("direction");

  // Live mode
  if (direction === "prev") {
    const prevCursor = Date.now();
    const data = await sql`
      SELECT * FROM table
      WHERE timestamp > ${cursor} AND timestamp <= ${prevCursor}
      ORDER BY timestamp DESC
    `;
    const res: ReturnType<MyData> = { data, prevCursor, nextCursor: null };
    return Response.json(res);
    // Load more
  } else {
    const data = await sql`
      SELECT * FROM table
      WHERE timestamp < ${cursor}
      ORDER BY timestamp DESC
      LIMIT 40
    `;
    const nextCursor = data.length > 0 ? data[data.length - 1].timestamp : null;
    const res: ReturnType<MyData> = { data, nextCursor, prevCursor: null };
    return Response.json(res);
  }
}
```

Key points:

- Live mode ("prev" direction): Returns all new data between `Date.now()` and the `cursor`
- Load more ("next" direction): Returns 40 items before the `cursor` and updates `nextCursor`

> Important: Be careful with timestamp boundaries. If items share the same timestamp, you might miss data because of the `>` comparison. To prevent data loss, include all items sharing the same timestamp as the last item in your query.

### Avoiding OFFSET with Frequent Data Updates

While it might be tempting to use `OFFSET` for pagination (without having live mode active), this approach can cause problems when data is frequently prepended:

```ts
const data = await sql`
  SELECT * FROM table 
  ORDER BY timestamp DESC 
  LIMIT ${limit} 
  OFFSET ${offset}
`;
```

[scribble]

When new items are prepended, they shift the offset values, potentially causing duplicate items in subsequent queries.

### Implementing Auto-Refresh

While TanStack Query provides a `refetchInterval` option, it would refetch all pages, growing increasingly expensive as more pages are loaded. Instead, we implement a custom refresh mechanism for fetching only new data:

```tsx
const REFRESH_INTERVAL = 5_000; // 5 seconds

React.useEffect(() => {
  let timeoutId: NodeJS.Timeout;

  async function fetchData() {
    // isLive is a simple boolean from React.useState<boolean>()
    // or nuqs useQueryState("live", parseAsBoolean)
    if (isLive) {
      await fetchPreviousPage?.();
      timeoutId = setTimeout(fetchData, REFRESH_INTERVAL);
    } else {
      clearTimeout(timeoutId);
    }
  }

  fetchData();

  return () => {
    clearTimeout(timeoutId);
  };
}, [isLive, fetchPreviousPage]);
```

We use `setTimeout` with recursion rather than `setInterval` to ensure each refresh only starts after the previous one completes. This prevents multiple simultaneous fetches when network latency exceeds the refresh interval and is a better UX.

For more details about our data table implementation, check out [The React data-table I always wanted](https://www.openstatus.dev/blog/data-table-redesign).
