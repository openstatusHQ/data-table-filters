/** @type {import('next').NextConfig} */
const nextConfig = {
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

export default nextConfig;
