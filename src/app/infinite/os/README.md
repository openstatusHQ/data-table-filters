# OpenStatus Request Logs

> Highly experimental
> Let's try to make reference to the components in the parent folder and make it as reusable as possible.

Create a logs table for openstatus. Fetch logs from tinbird across all workspace monitors.

- [ ] Create multiple tb endpoints for stats (percentiles, facets, etc)
- [ ] Create a live mode endpoint to fetch logs from a specific timestamp on to now
- [ ] Create API endpoint for bundled logic (should we, or should we not, bundle it in the frontend, aka here?)

Differences:

- Facets need an api endpoint on tb with a calculation. It returns the percentiles and the count.
- Percentiles are not available in the current tb facet api.

FIXME:

- [ ] DataTableSheetDetails are using `isLoading` to show the loading state. On Live Mode, it will always be loading every X seconds.

TODO:

Clickhouse/Tinybird pipe to get facets with count:

```sql
SELECT facet, value, COUNT(*) AS count
FROM (
    SELECT arrayJoin([
        ('pathname', pathname),
        ('host', host),
        ('method', method),
        ('status', status),
        -- more fields can be added here
    ]) AS pair,
    pair.1 AS facet,
    pair.2 AS value
    FROM response_logs
)
GROUP BY facet, value
ORDER BY facet, count DESC;
```

pipe for the latency percentiles:

```sql
SELECT
    quantile(0.5)(latency) AS p50,
    -- 90th percentile
    quantile(0.95)(latency) AS p95,
    quantile(0.99)(latency) AS p99
FROM response_logs
```

For the live mode pipe, use the mv with the least data.

- [ ] Split react query context into separate provider (instead of storing it in useDataTable)
