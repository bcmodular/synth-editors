// End-to-end tests: the built app in Electron, against a fake JV-2080 (e2e/fakeJv.ts).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  workers: 1, // one app at a time
  timeout: 30_000,
  reporter: "list",
});
