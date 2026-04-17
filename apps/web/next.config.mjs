/** @type {import('next').NextConfig} */
const nextConfig = {
  // REMINDER: new react compiler to memoize the components
  // https://react.dev/learn/react-compiler
  reactCompiler: true,
  transpilePackages: ["next-mdx-remote", "@dtf/registry"],
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
