import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    testTimeout: 60_000,
    // The Drizzle suites open their Postgres connection in `beforeAll`, which
    // only runs in CI. Give the hooks the same headroom as the tests so a slow
    // service container is not a 10s timeout.
    hookTimeout: 60_000,
  },
});
