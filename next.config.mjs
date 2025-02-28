import rehypePrettyCode from "rehype-pretty-code";

/** @type {import('rehype-pretty-code').Options} */
const options = {
  keepBackground: false,
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  experimental: {
    // REMINDER: new react compiler to memoize the components
    // https://react.dev/learn/react-compiler
    reactCompiler: true,
  },
  output: "standalone",
};

export default nextConfig;
