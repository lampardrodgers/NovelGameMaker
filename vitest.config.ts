import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@agentic-galgame/vn-agent": resolve(currentDir, "packages/vn-agent/src/index.ts"),
      "@agentic-galgame/vn-core": resolve(currentDir, "packages/vn-core/src/index.ts"),
      "@agentic-galgame/vn-exporter": resolve(currentDir, "packages/vn-exporter/src/index.ts"),
      "@agentic-galgame/vn-platform": resolve(currentDir, "packages/vn-platform/src/index.ts"),
      "@agentic-galgame/vn-runtime": resolve(currentDir, "packages/vn-runtime/src/index.ts")
    }
  },
  test: {
    globals: false,
    environment: "node"
  }
});
