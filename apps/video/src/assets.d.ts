// Remotion's webpack config turns font imports into URLs.
declare module "*.woff2" {
  const src: string;
  export default src;
}
