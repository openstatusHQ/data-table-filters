### OpenStatus Light Viewer

The first real-world use case of the [logs.run](https://logs.run/light) project — and a simple yet effective showcase of the [data-table-filters](https://github.com/openstatusHQ/data-table-filters) project.

A few months ago, we released the [vercel-edge-ping](https://github.com/openstatusHQ/vercel-edge-ping) repository — a lightweight community edition of OpenStatus designed to monitor your HTTP endpoints via Vercel's edge regions (see [light.openstatus.dev](https://light.openstatus.dev)) and notify you if they go down. No dependencies, no UI, just the essentials. For more details, check out our [README](https://github.com/openstatusHQ/vercel-edge-ping).

Now, we’re excited to announce support for an extensive dashboard. If you're already using Tinybird to store your data, simply redeploy the latest `vercel-edge-ping` project and include the updated [pipes](https://github.com/openstatusHQ/vercel-edge-ping/tree/main/tb/pipes) in Tinybird. You can then access your values via [logs.run/light](https://logs.run/light) by updating the base URL of the API endpoint (use the floating button in the bottom left corner). By default, it will display demo values from [light.openstatus.dev](https://light.openstatus.dev). _(Note: Authentication is not yet implemented.)_

### Folder Structure

Here's a snapshot of the current **Folder Structure**:

```
/src/app/light
├── api
│   └── route.tsx
├── client.tsx
├── columns.tsx
├── constants.tsx
├── layout.tsx
├── page.tsx
├── query-options.ts
└── search-params.ts
```

We explore most of these files in the [Guide](https://logs.run/guide).

### Quick Breakdown

- **`client.tsx`**: Client component that queries the API and performs minor data transformations.
- **`columns.tsx`**: TanStack column array configuration.
- **`constants.tsx`**: Filter and sheet fields configuration.
- **`layout.tsx`**: Simple layout component.
- **`page.tsx`**: Server component to cache `nuqs` search parameters.
- **`query-options.ts`**: Infinite query options used in `client.tsx`.
- **`search-params.ts`**: `nuqs` query parameters configuration.

We're continuously refining the setup. While some configurations may appear duplicated, our ultimate goal is to consolidate everything into a single configuration file, making it easier to build an infinite logs data table from front to back.

We're taking you along on this journey.

---

### FAQs

#### What is the [vercel-edge-ping](https://github.com/openstatusHQ/vercel-edge-ping) project?

It’s a lightweight, community edition of OpenStatus with the following basic features:

- Notification Channels (Slack, Discord, etc.)
- Cron Job (via Vercel or GitHub Actions)
- Storage (Tinybird)

#### Do I need to self-host the [data-table-filters](https://github.com/openstatusHQ/data-table-filters) project?

No, self-hosting is not required. If you have `vercel-edge-ping` ingesting data into Tinybird and are using the default pipes, you can open the API endpoint configuration. Click the floating button in the bottom left corner or press <kbd>⌘ + J</kbd>. Enter the base URL, and the `tb_endpoint` cookie will be set automatically. Delete manually if needed.

#### Is an authentication system provided?

No. The project is auth-agnostic, allowing you to implement your preferred authentication solution if needed.

---

### We are looking for more use cases!

Please reach out to [max@openstatus.dev](mailto:max@openstatus.dev) or [DM](https://x.com/mxkaske) me if you have specific use cases you'd like to see in action. Your feedback will help us refine the configuration, routes, and component APIs.
