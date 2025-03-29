### Vercel Edge Ping UI

The first realworld use case of the [logs.run](https://logs.run/light) project and a not complex showcase of the [data-table-filters](https://github.com/openstatusHQ/data-table-filters) project.

A few months ago, we released the [vercel-edge-ping](https://github.com/openstatusHQ/vercel-edge-ping) repository, a lightweight version of OpenStatus, to monitor your http endpoints via vercel's edge regions (see [light.openstatus.dev](https://light.openstatus.dev)). Within 5 minutes, you can define your endpoints and deploy the checker to [Vercel](http://vercel.com/?ref=OpenStatus). We've added support to create dedicated notifiation channels like Slack/Discord/Telegram and get notified whenever >50% of your endpoints are down. We have an extensive [README](https://github.com/openstatusHQ/vercel-edge-ping) guide or you can checkout the [YouTube](https://www.youtube.com/watch?v=cpurWC9Co1U) video how to deploy it. This is an extreme lightweight checker with zero dependencies and allows you to keep full control over it. Extend, improve or suggest features.

Now, we are happy to announce that we have added a UI support if you are using the Tinybird option to store the ping responses. If you already use Tinybird to store your data, you can redeploy the latest changes and include the [pipes](https://github.com/openstatusHQ/vercel-edge-ping/tree/main/tb/pipes) to Tinybird and access the data directly from [logs.run/light](https://logs.run/light) by changing the base url of the API endpoint (left bottom floating button). It will default to our demo values otherwise. (be aware that there is no auth right now)

This is a snapshot of how the **Folder Structure** currently looks like:

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

We explore most of the files in the [Guide](https://logs.run/guide).

Here a quick breakdown:

- `client.tsx`: client component to query the API and do some small data transformation
- `columns.tsx`: tanstack column array configuration
- `constants.tsx`: filter and sheet fields configuration
- `layout.tsx`: simple layout component
- `page.tsx`: server component to cache nuqs search params
- `query-options.ts`: infinite query options used in `client.tsx`
- `search-params.ts`: nuqs query params configuration

Remember that we improving it over time. While some configs seem to be duplications, the endgoal is to have a single config file to rule them all and provide you with a best in class experience to build your own infinite logs data-table from front to back.

We are taking you with through the journey.

---

Do I need to self-host the entire [data-table-filters](https://github.com/openstatusHQ/data-table-filters) project?

For now, yes. But you can get rid of most of the pages and customize the homepage as you'd like to. We are only using default shadcn for the design system so it should be easy to extend and/or use LLM.

Is an authentification system is provided?

No. It comes auth agnostic and you can implement it on your own, using your favorite tool or approach.

---

**We are looking for more use cases!** Please reach out to [max@openstatus.dev](mailto:max@openstatus.dev) or [DM](https://x.com/mxkaske) me if have specific use cases you'd like to see in action. That will help us shaping the configuration/route/components API.
