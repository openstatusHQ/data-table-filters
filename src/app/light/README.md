# OpenStatus Request Logs (light.openstatus.dev)

With [light.openstatus.dev](https://light.openstatus.dev), we provide a lightweight version to monitor your services with vercel edge functions. You can set a cron job (e.g. vercel cron, github actions,..) and store the pings within Tinybird.

The following `/light` folder is being used to display the results of your cron. With the lightweight version, we already provide an `/api/get` API route to fetch the stroed responses.

It also showcases a basic infinite data-table with filter functionality.

---

> Highly experimental
> Let's try to make reference to the components in the parent folder and make it as reusable as possible.

Create a logs table for openstatus. Fetch logs from tinbird across all workspace monitors.

- [ ] Create multiple tb endpoints for stats (percentiles, facets, etc)
- [ ] Create API endpoint for bundled logic (should we, or should we not, bundle it in the frontend, aka here?)

Differences:

- Facets need an api endpoint on tb with a calculation. It returns the percentiles and the count.
- Percentiles are not available in the current tb facet api.

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

FIXME:

- [ ] uuid selection
- [ ] searchParamsParser is hardcoded
