import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);

// geist only exports its next/font wrappers; its files are reached through the web
// app, so this package does not add a second next peer to the lockfile.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      "@fonts/geist": path.resolve("../web/node_modules/geist/dist/fonts"),
    },
  },
}));
