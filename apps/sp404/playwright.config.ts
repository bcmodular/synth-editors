// End-to-end tests: the built app in Electron against a fake SP-404 serial port (e2e/fakeSp404.ts).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  workers: 1,
  timeout: 30_000,
  reporter: "list",
});
