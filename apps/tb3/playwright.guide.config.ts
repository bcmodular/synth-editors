// Retakes the user guide's screen grabs (docs/user-guide.md) against the fake TB-3:
//   npm run guide:shots -w @synth-editors/tb3
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.shots.ts",
  workers: 1,
  timeout: 120_000,
  reporter: "list",
});
