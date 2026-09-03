import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    testTimeout: 60_000,
    // PGLite boots a Postgres compiled to WASM, which costs seconds on a
    // loaded CI runner. The `beforeAll` seeds that boot it need the same
    // headroom as the tests — the 10s default timed them out in CI.
    hookTimeout: 60_000,
    exclude: ["dist/**", "node_modules/**"],
  },
});
