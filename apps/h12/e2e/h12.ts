// Harness for the end-to-end tests: launches the built app in Electron with a throwaway profile. With a fake, the
// main process refuses real MIDI and the page gets the fake H12 (fakeH12.ts); without one (the hardware tests), it
// talks to the real H12, read-only.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { fakeMidiScript, type FakeH12Init, type FakeSent } from "./fakeH12";

const APP_DIR = fileURLToPath(new URL("..", import.meta.url));

export interface H12App {
  app: ElectronApplication;
  page: Page;
  profile: string;
}

export async function start(fake: FakeH12Init | "real" = {}): Promise<H12App> {
  const profile = await mkdtemp(path.join(tmpdir(), "h12-e2e-profile-"));
  const env = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined && e[0] !== "VITE_DEV_SERVER_URL"),
  );
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${profile}`],
    env: { ...env, H12_NO_REAL_MIDI: fake === "real" ? "0" : "1", E2E_HIDDEN: process.env.E2E_SHOW === "1" ? "0" : "1" },
  });
  const page = await app.firstWindow();
  if (fake !== "real") {
    await page.addInitScript({ content: fakeMidiScript(fake) });
    await page.reload();
  }
  return { app, page, profile };
}

export async function finish(running: H12App | undefined): Promise<void> {
  if (!running) return;
  await running.app.close();
  await rm(running.profile, { recursive: true, force: true });
}

// Every message the app sent to the fake H12, oldest first.
export const sent = (page: Page): Promise<FakeSent[]> =>
  page.evaluate(() => (window as unknown as { __fakeH12: { sent: FakeSent[] } }).__fakeH12.sent);

// The facts list in the hub panel, as { label: value }.
export async function facts(page: Page): Promise<Record<string, string>> {
  await page.locator(".facts").waitFor();
  const labels = await page.locator(".facts dt").allInnerTexts();
  const values = await page.locator(".facts dd").allInnerTexts();
  return Object.fromEntries(labels.map((l, i) => [l, values[i] ?? ""]));
}
