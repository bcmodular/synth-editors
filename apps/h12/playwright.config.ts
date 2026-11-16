// End-to-end tests: the built app in Electron against a fake H12MIDI Pro (e2e/fakeH12.ts). Real MIDI is refused.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  workers: 1,
  timeout: 30_000,
  reporter: "list",
});
