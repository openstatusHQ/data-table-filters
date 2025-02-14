import createMDX from '@next/mdx'

import rehypePrettyCode from "rehype-pretty-code";
 
/** @type {import('rehype-pretty-code').Options} */
const options = {
	keepBackground: false,
};
 

/** @type {import('next').NextConfig} */
const nextConfig = {
	pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
	experimental: {
		// REMINDER: new react compiler to memoize the components
		// https://react.dev/learn/react-compiler
		reactCompiler: true
	},
  async redirects() {
    return [
      {
				source: "/i",
				destination: "/infinite",
				permanent: true
			},
			{
				source: "/vercel",
				destination: "/infinite",
				permanent: true
			}
		]
	}
};

const withMDX = createMDX({
	extension: /\.mdx?$/,
	options: {
	  remarkPlugins: [],
	  rehypePlugins: [[rehypePrettyCode, options]],
	},
})

export default withMDX(nextConfig);
