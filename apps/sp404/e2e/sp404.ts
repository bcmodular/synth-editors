// Harness for the end-to-end tests: launches the built app in Electron with a throwaway profile, wired to the
// fake SP-404 serial port. The main process is told to refuse every real serial port, so a connected SP-404 is
// never touched.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { fakeSerialScript, type FakeSent, type FakeSp404Init } from "./fakeSp404";

const APP_DIR = fileURLToPath(new URL("..", import.meta.url));

export interface Sp404App {
  app: ElectronApplication;
  page: Page;
  profile: string;
}

export const DEVICE: FakeSp404Init = {
  project: 5,
  projectName: "LIVE SET",
  pads: [
    { pad: 0, name: "KICK 1", level: 110 },
    { pad: 1, name: "SNARE", pan: 40, routing: 2 },
    { pad: 4, name: "HAT", muteGroup: 1 },
    { pad: 17, name: "SUB BASS", level: 90 },
    { pad: 40, name: "VOX", attack: 20, release: 60 },
  ],
  bankVolumes: [127, 100, 127, 127, 127, 127, 127, 127, 127, 127],
};

export async function start(init: FakeSp404Init = DEVICE, opts: { midiInput?: boolean } = {}): Promise<Sp404App> {
  const profile = await mkdtemp(path.join(tmpdir(), "sp404-e2e-profile-"));
  const env = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined && e[0] !== "VITE_DEV_SERVER_URL"),
  );
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${profile}`],
    env: { ...env, SP404_NO_REAL_SERIAL: "1" },
  });
  const page = await app.firstWindow();
  await page.addInitScript({ content: fakeSerialScript(init, opts.midiInput ?? true) });
  await page.reload();
  await page.locator(".ws[data-pad]").first().waitFor();
  return { app, page, profile };
}

export async function finish(running: Sp404App | undefined): Promise<void> {
  if (!running) return;
  await running.app.close();
  await rm(running.profile, { recursive: true, force: true });
}

// Set-parameter writes the fake received, oldest first.
export const writes = (page: Page): Promise<FakeSent[]> =>
  page.evaluate(() => (window as unknown as { __fakeSp404: { sent: FakeSent[] } }).__fakeSp404.sent.filter((m) => m.command === 1));

export const control = <T>(page: Page, fn: string, ...args: number[]): Promise<T> =>
  page.evaluate(([name, a]) => {
    const fake = (window as unknown as { __fakeSp404: Record<string, (...x: number[]) => unknown> }).__fakeSp404;
    return fake[name as string]!(...(a as number[])) as T;
  }, [fn, args] as const);

// A MIDI message from the fake SP-404's MIDI output.
export const playMidi = (page: Page, ...bytes: number[]): Promise<void> =>
  page.evaluate((b) => (window as unknown as { __fakeSp404Midi: { play: (...x: number[]) => void } }).__fakeSp404Midi.play(...b), bytes);

// MIDI messages the app sent to the fake SP-404, oldest first.
export const midiSent = (page: Page): Promise<number[][]> =>
  page.evaluate(() => (window as unknown as { __fakeSp404Midi: { sent: number[][] } }).__fakeSp404Midi.sent);
