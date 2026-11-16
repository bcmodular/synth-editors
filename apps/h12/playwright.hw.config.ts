// End-to-end tests against the real H12MIDI Pro (npm run test:h12). Read-only: they never write a setting.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.hw.ts",
  workers: 1,
  timeout: 30_000,
  reporter: "list",
});
