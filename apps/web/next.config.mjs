import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registrySrc = path.resolve(__dirname, "../../packages/registry/src");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // REMINDER: new react compiler to memoize the components
  // https://react.dev/learn/react-compiler
  reactCompiler: true,
  typescript: {
    // Type checking is done separately via `tsc`. The cross-package @/ alias
    // resolution causes false positives when Next.js runs its own type check.
    ignoreBuildErrors: true,
  },
  transpilePackages: ["next-mdx-remote", "@dtf/registry"],
  // Empty turbopack config to allow --webpack flag without error
  turbopack: {},
  webpack: (config) => {
    // Registry files use @/ imports that need to resolve to packages/registry/src/
    // instead of apps/web/src/. This plugin rewrites @/ for files inside the registry.
    config.resolve.plugins = config.resolve.plugins || [];
    config.resolve.plugins.push({
      apply(resolver) {
        const target = resolver.ensureHook("resolve");
        resolver
          .getHook("described-resolve")
          .tapAsync(
            "RegistryAliasPlugin",
            (request, resolveContext, callback) => {
              if (
                request.request &&
                request.request.startsWith("@/") &&
                request.context?.issuer &&
                request.context.issuer.includes("packages/registry/src")
              ) {
                const newRequest = path.join(
                  registrySrc,
                  request.request.slice(2),
                );
                const obj = {
                  ...request,
                  request: newRequest,
                };
                resolver.doResolve(
                  target,
                  obj,
                  null,
                  resolveContext,
                  callback,
                );
              } else {
                callback();
              }
            },
          );
      },
    });

    return config;
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
