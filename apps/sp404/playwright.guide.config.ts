// Retakes the user guide's screen grabs (docs/user-guide.md) against the fake SP-404:
//   npm run guide:shots -w @synth-editors/sp404
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.shots.ts",
  workers: 1,
  timeout: 180_000,
  reporter: "list",
});
