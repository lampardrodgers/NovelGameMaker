import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@agentic-galgame/vn-core": resolve(currentDir, "../../packages/vn-core/src/index.ts"),
      "@agentic-galgame/vn-runtime": resolve(currentDir, "../../packages/vn-runtime/src/index.ts")
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5175
  }
});
