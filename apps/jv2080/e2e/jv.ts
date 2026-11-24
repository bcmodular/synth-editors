// Harness for the end-to-end tests (after apps/tb3/e2e/tb3.ts): launches the built app in Electron with a throwaway
// profile and patch library, wired to the fake JV-2080 (fakeJv.ts) or, with JV_HW=1, to the real one (realJv.ts), and
// reads back what the JV holds. On the real JV each test starts by sending it the test's patch and ends by putting
// back the patch it held (its temporary patch only: nothing is written to its memory).
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { getParam, PATCH_BLOCKS, setParam, setPatchName, type Patch } from "../src/core/patch";
import { emptySlots, patchToBytes, setToJson, type Slot } from "../src/core/patchSet";
import { param } from "../src/core/paramValue";
import { addrToInt } from "../src/core/sysex";
import { demoPatch } from "../src/editor/demoPatch";
import { installFakeJv, type FakeJvInit } from "./fakeJv";
import { checkPort, HW, HW_PORT, readReal, sendReal } from "./realJv";

export { HW } from "./realJv";
// Tests that need the fake JV (presets, a silent JV, its panel, the stand-in controller) skip on the real one.
export const FAKE_ONLY = "needs the fake JV";

const APP_DIR = fileURLToPath(new URL("..", import.meta.url));
const FAKE_PORT = "JV-2080 (test)";
export const CONTROLLER_PORT = `${FAKE_PORT} controller`;
export const PATCH_CHANNEL = 5; // 0-based: the JV's patch receive channel 6, as in the studio

interface Variant {
  name: string;
  cutoff: number;
}
const named = ({ name, cutoff }: Variant) => setParam(setPatchName(demoPatch(), name), param("cutoff"), cutoff);

// The patches each test uses: what the JV holds at the start, three in the test set, one file, one preset.
export const PATCHES = {
  jv: named({ name: "ON THE JV", cutoff: 90 }),
  a: named({ name: "SLOT A", cutoff: 10 }),
  b: named({ name: "SLOT B", cutoff: 20 }),
  c: named({ name: "SLOT C", cutoff: 30 }),
  file: named({ name: "FROM A FILE", cutoff: 40 }),
  preset: named({ name: "A PRESET", cutoff: 50 }),
};
export const PRESET_PROGRAM = 4; // PR-A 005

const blocksOf = (p: Patch): Record<number, number[]> =>
  Object.fromEntries(PATCH_BLOCKS.map((b, i) => [addrToInt(b.addr), [...p[i]!]]));

export interface JvApp {
  app: ElectronApplication;
  page: Page;
  profile: string;
  library: string;
  original?: Patch; // the real JV's patch from before the test, put back at the end
}

async function launchElectron(profile: string) {
  // Load the built dist/, not a dev server; no window on screen (E2E_SHOW=1 shows it, to watch a test).
  const env = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined && e[0] !== "VITE_DEV_SERVER_URL"),
  );
  const hidden = { E2E_HIDDEN: process.env.E2E_SHOW === "1" ? "0" : "1" };
  const app = await electron.launch({ args: [APP_DIR, `--user-data-dir=${profile}`], env: { ...env, ...hidden } });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

// Point the app at the JV and reload. The first load of a fresh profile has no ports chosen, so nothing is sent before
// the fake is in place (or, on the real JV, before the test patch is there).
async function connect(page: Page, opts: { library?: string; silent?: boolean }) {
  if (!HW) {
    const init: FakeJvInit = {
      name: FAKE_PORT,
      temp: blocksOf(PATCHES.jv),
      presets: { [PRESET_PROGRAM]: blocksOf(PATCHES.preset) },
      silent: opts.silent,
    };
    await page.addInitScript(installFakeJv, init);
  }
  await page.evaluate(([port, library, channel]) => {
    localStorage.setItem("jv2080.out", port!);
    localStorage.setItem("jv2080.in", port!);
    localStorage.setItem("jv2080.channel", channel!);
    if (library) localStorage.setItem("jv2080.libraryRoot", library);
  }, [HW ? HW_PORT : FAKE_PORT, opts.library, String(PATCH_CHANNEL)]);
  await page.reload();
  await page.locator(".top").waitFor();
  expect(await page.evaluate(() => "__fakeJv" in window)).toBe(!HW);
}

// On the real JV: keep the patch it holds, and give it the one the tests expect to find.
async function prepareReal(page: Page): Promise<Patch | undefined> {
  if (!HW) return undefined;
  await checkPort(page, HW_PORT);
  const original = await readReal(page, HW_PORT);
  await sendReal(page, HW_PORT, PATCHES.jv);
  return original;
}

// Launch on a fresh profile with a library holding "Test set.jvset" (A, B, C in slots 1–3) and "Audition.syx".
export async function start(opts: { silent?: boolean } = {}): Promise<JvApp> {
  const profile = await mkdtemp(path.join(tmpdir(), "jv-e2e-profile-"));
  const library = await mkdtemp(path.join(tmpdir(), "jv-e2e-library-"));
  const slots: (Slot | null)[] = [...emptySlots()];
  slots[0] = { name: "A", patch: PATCHES.a };
  slots[1] = { name: "B", patch: PATCHES.b };
  slots[2] = { name: "C", patch: PATCHES.c };
  await writeFile(path.join(library, "Test set.jvset"), setToJson(slots));
  await writeFile(path.join(library, "Audition.syx"), patchToBytes(PATCHES.file));
  const { app, page } = await launchElectron(profile);
  let original: Patch | undefined;
  try {
    original = await prepareReal(page);
    await connect(page, { library, silent: opts.silent });
  } catch (e) {
    if (original) await sendReal(page, HW_PORT, original).catch(() => undefined);
    await app.close();
    await Promise.all([profile, library].map((d) => rm(d, { recursive: true, force: true })));
    throw e;
  }
  return { app, page, profile, library, original };
}

// Quit and launch again on the same profile, as a user reopening the app.
export async function relaunch(t: JvApp): Promise<JvApp> {
  await t.app.close();
  const { app, page } = await launchElectron(t.profile);
  await connect(page, {});
  return { ...t, app, page };
}

export async function finish(t: JvApp | undefined) {
  if (!t) return; // start() failed and cleaned up after itself
  if (t.original) await sendReal(t.page, HW_PORT, t.original).catch(() => undefined);
  await t.app.close();
  await Promise.all([t.profile, t.library].map((d) => rm(d, { recursive: true, force: true })));
}

// What the JV's temporary patch holds now.
export async function readJv(page: Page): Promise<Patch> {
  if (HW) return readReal(page, HW_PORT);
  const ranges = PATCH_BLOCKS.map((b) => [addrToInt(b.addr), b.size] as const);
  return page.evaluate((ranges) => {
    const jv = (window as unknown as { __fakeJv: { read(at: number, size: number): number[] } }).__fakeJv;
    return ranges.map(([at, size]) => jv.read(at, size));
  }, ranges);
}

// Wait until the JV holds `want` (sends are paced, so they trail the click).
export async function expectJv(page: Page, want: Patch, what: string) {
  await expect.poll(async () => JSON.stringify(await readJv(page)), { message: `the JV should hold ${what}`, timeout: 5000 })
    .toBe(JSON.stringify(want));
}

export const cutoffOf = (p: Patch, tone = 0) => getParam(p, param("cutoff"), tone);

export interface CcMessage {
  channel: number; // 1–16
  cc: number;
  value: number;
}

// A CC from the fake controller.
export const sendCc = (page: Page, m: CcMessage) =>
  page.evaluate((m) =>
    (window as unknown as { __fakeJv: { cc(ch: number, n: number, v: number): void } }).__fakeJv.cc(m.channel, m.cc, m.value), m);

export interface PanelEdit {
  block: number; // 0 = Common, 1–4 = the tones
  offset: number;
  bytes: number[];
}

// An edit made on the JV's own panel.
export const panelEdit = (page: Page, e: PanelEdit) =>
  page.evaluate(([at, b]) =>
    (window as unknown as { __fakeJv: { panel(at: number, b: number[]): void } }).__fakeJv.panel(at as number, b as number[]),
  [addrToInt(PATCH_BLOCKS[e.block]!.addr) + e.offset, e.bytes] as const);

// Messages sent to the fake JV since the last call.
export async function takeSent(page: Page): Promise<number[][]> {
  return page.evaluate(() => (window as unknown as { __fakeJv: { sent: number[][] } }).__fakeJv.sent.splice(0));
}

export const programsChosen = (page: Page) =>
  page.evaluate(() => [...(window as unknown as { __fakeJv: { programs: number[] } }).__fakeJv.programs]);

// UI handles.
export const slot = (page: Page, i: number) => page.locator(".slotgrid .slot").nth(i);
export const patchTitle = (page: Page) => page.locator(".top .name");
export const knob = (page: Page, label: string, n = 0) => page.getByRole("slider", { name: label, exact: true }).nth(n);

export async function openTestSet(page: Page) {
  await page.locator(".librow.set", { hasText: "Test set" }).dblclick();
  await expect(page.locator(".slotgrid .slot.filled")).toHaveCount(3);
}

// Press and hold on an element, run `during`, then release.
export async function hold(page: Page, sel: ReturnType<Page["locator"]>, during: () => Promise<void>) {
  const box = (await sel.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await during();
  await page.mouse.up();
}
