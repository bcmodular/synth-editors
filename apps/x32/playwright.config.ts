// End-to-end tests: the built app in Electron against a fake X32 (e2e/fakeX32.ts). The real desk can't be reached.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  workers: 1,
  timeout: 30_000,
  reporter: "list",
});
