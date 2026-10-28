import { defineConfig } from "@playwright/test";

// Pruebas de UI aisladas: HTTP interceptado, sin escribir en una base de datos.
// Build previo: NEXT_PUBLIC_API_URL=http://127.0.0.1:3399 NEXT_PUBLIC_ALLOW_LOCAL_HTTP=true npm run build --workspace=front
export default defineConfig({
  testDir: ".",
  testMatch: "admin-tables.browser.spec.mjs",
  workers: 1,
  timeout: 45000,
  use: { baseURL: "http://localhost:3398", channel: "chrome", headless: true },
  webServer: { command: "node node_modules/next/dist/bin/next start front --port 3398 --hostname 127.0.0.1", cwd: "../..", url: "http://127.0.0.1:3398", timeout: 30000, reuseExistingServer: false },
});
