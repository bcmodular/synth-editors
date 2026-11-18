// Retakes the README screen grabs against the fake H12:
//   npm run readme:shots -w @synth-editors/h12
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.shots.ts",
  workers: 1,
  timeout: 180_000,
  reporter: "list",
});
