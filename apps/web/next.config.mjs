/** @type {import('next').NextConfig} */
const nextConfig = {
  // REMINDER: new react compiler to memoize the components
  // https://react.dev/learn/react-compiler
  reactCompiler: true,
  transpilePackages: ["next-mdx-remote", "@dtf/registry"],
  async rewrites() {
    return [
      // Raw markdown for agents: /docs/quick-start.md -> /docs/quick-start/md
      {
        source: "/docs/:slug.md",
        destination: "/docs/:slug/md",
      },
      // Same markdown for agents that ask for it on the plain URL. Next.js
      // anchors `value` as ^...$, hence the wildcards around the media type.
      {
        source: "/docs/:slug",
        has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }],
        destination: "/docs/:slug/md",
      },
    ];
  },
  async headers() {
    return [
      // `/docs/:slug` serves html or markdown depending on the accept header
      // (see the rewrite above), so shared caches must key on it too.
      // Next.js appends its own RSC values to Vary rather than replacing it.
      {
        source: "/docs/:slug",
        headers: [{ key: "vary", value: "accept" }],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/i",
        destination: "/infinite",
        permanent: true,
      },
      {
        source: "/vercel",
        destination: "/infinite",
        permanent: true,
      },
      {
        source: "/b",
        destination: "/builder",
        permanent: true,
      },
      {
        source: "/d",
        destination: "/drizzle",
        permanent: true,
      },
      {
        source: "/guide",
        destination: "/docs/introduction",
        permanent: true,
      },
      {
        source: "/docs",
        destination: "/docs/introduction",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
