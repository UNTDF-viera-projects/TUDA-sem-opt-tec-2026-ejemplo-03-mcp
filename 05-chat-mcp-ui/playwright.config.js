import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: "*.spec.js",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3001",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: "npm run build && node test/browser-server.js",
    url: "http://127.0.0.1:3001/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
