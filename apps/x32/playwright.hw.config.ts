// End-to-end tests against the real X32 Rack (npm run test:x32, with X32_HOST set). Read-only.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.hw.ts",
  workers: 1,
  timeout: 30_000,
  reporter: "list",
});
