// Harness for the end-to-end tests: starts a fake desk (fakeX32.ts) and launches the built app in Electron with a
// throwaway profile, pointed at it. With "real", it talks to the desk at X32_HOST instead (the hardware tests).
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { FakeX32, type FakeX32Init } from "./fakeX32";
import { TEST_PRESETS } from "./studio";

const APP_DIR = fileURLToPath(new URL("..", import.meta.url));

export interface X32App {
  app: ElectronApplication;
  page: Page;
  profile: string;
  fake: FakeX32 | null;
}

// Not passed on from the shell: the dev server URL, and an address (each test sets its own, or none).
const DROPPED_ENV = new Set(["VITE_DEV_SERVER_URL", "X32_HOST"]);

export interface StartOptions {
  noHost?: boolean; // start with no address set, as on first run (the app finds the fake by discovery)
}

export async function start(init: FakeX32Init | "real" = {}, options: StartOptions = {}): Promise<X32App> {
  const fake = init === "real" ? null : await FakeX32.start(init);
  const host = fake ? fake.host : process.env.X32_HOST;
  if (!host && !options.noHost) throw new Error("Set X32_HOST to the desk's address to run the hardware tests");
  const profile = await mkdtemp(path.join(tmpdir(), "x32-e2e-profile-"));
  const presets = path.join(profile, "fx-presets.json"); // the stand-in catalogue, never the local one
  await writeFile(presets, JSON.stringify({ version: 1, presets: TEST_PRESETS }));
  const env = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined && !DROPPED_ENV.has(e[0])),
  );
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${profile}`],
    env: {
      ...env,
      ...(options.noHost ? (fake ? { X32_DISCOVER_TO: host! } : {}) : { X32_HOST: host! }),
      X32_NO_REAL_DESK: fake ? "1" : "0",
      X32_FAKE_CLAUDE: "1", // tests never call the real model (it costs money)
      X32_FX_PRESETS: presets,
      E2E_HIDDEN: process.env.E2E_SHOW === "1" ? "0" : "1",
    },
  });
  const page = await app.firstWindow();
  return { app, page, profile, fake };
}

export async function finish(running: X32App | undefined): Promise<void> {
  if (!running) return;
  await running.app.close();
  await running.fake?.stop();
  await rm(running.profile, { recursive: true, force: true });
}

// The facts list in the desk panel, as { label: value }.
export async function facts(page: Page): Promise<Record<string, string>> {
  await page.locator(".desk .facts").waitFor();
  const labels = await page.locator(".desk .facts dt").allInnerTexts();
  const values = await page.locator(".desk .facts dd").allInnerTexts();
  return Object.fromEntries(labels.map((l, i) => [l, values[i] ?? ""]));
}

export const status = (page: Page) => page.locator(".desk .facts dt:has-text('Status') + dd");
