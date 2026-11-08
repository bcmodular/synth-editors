// End-to-end tests: the built app in Electron, against a fake TB-3 or (TB3_HW=1) the real one.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  workers: 1, // one TB-3, one app at a time
  timeout: 30_000,
  reporter: "list",
});
