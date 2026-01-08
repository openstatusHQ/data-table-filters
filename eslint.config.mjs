import path from "node:path";
import { fileURLToPath } from "node:url";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import { defineConfig } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
  {
    extends: [...nextCoreWebVitals],
  },
]);
