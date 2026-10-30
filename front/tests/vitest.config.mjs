import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  // Interaction specs (.tsx) opt into jsdom per file with `// @vitest-environment jsdom`.
  test: { include: ["tests/**/*.spec.{ts,tsx}"], environment: "node", restoreMocks: true },
});
