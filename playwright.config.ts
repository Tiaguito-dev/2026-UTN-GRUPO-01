import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./front/tests",
  testMatch: "**/*.spec.mjs",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: "http://localhost:3300", browserName: "chromium", trace: "off", screenshot: "off", video: "off" },
  webServer: [
    { command: "node front/tests/backend-harness.mjs", url: "http://127.0.0.1:3301/health", timeout: 30_000, reuseExistingServer: false,
      env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "", H5_FRONT_URL: "http://localhost:3300" } },
    { command: "npm run start --workspace=front -- --port 3300 --hostname 127.0.0.1", url: "http://127.0.0.1:3300", timeout: 30_000, reuseExistingServer: false },
  ],
});
