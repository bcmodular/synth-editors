// Harness for the end-to-end tests: launches the built app in Electron with a throwaway profile and
// patch library, wired either to the fake TB-3 (default) or to the real one (TB3_HW=1).
//
// The real TB-3's port is the one named TB-3, or TB3_PORT (e.g. "H12MIDI-Pro Port 4") when it sits
// behind an interface.
// With the real TB-3 the tests overwrite its current sound (the edit buffer, not stored patterns).
// They start from what it holds, and put that back at the end of each test.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { diffBlocks, getRaw, patchFromSysex, patchToSysex, setRaw } from "../src/core/patch";
import type { Patch } from "../src/core/patch";
import { paramById } from "../src/core/params";
import { emptySlots, patchToBytes, setToJson } from "../src/core/patchSet";
import type { Slot } from "../src/core/patchSet";
import { PATCH_BLOCKS, addrKey, rq1 } from "../src/core/sysex";
import { demoPatch } from "../src/editor/demoPatch";
import { installFakeTb3 } from "./fakeTb3";

export const HW = process.env.TB3_HW === "1";
const APP_DIR = fileURLToPath(new URL("..", import.meta.url));
const FAKE_PORT = "TB-3 (test)";

// Raise each param by `by` (wrapping), so every variant differs from whatever the TB-3 started on.
function tweak(p: Patch, changes: Record<string, number>): Patch {
  for (const [id, by] of Object.entries(changes)) {
    const def = paramById(id);
    p = setRaw(p, def, (getRaw(p, def) + by) % (def.max + 1));
  }
  return p;
}

// The patches each test uses. A and B differ in two blocks (VCF, distortion).
export interface Patches {
  base: Patch; // what the TB-3 held when the test started
  a: Patch; // slot 1
  b: Patch; // slot 2
  c: Patch; // slot 3
  file: Patch; // "Audition.syx" in the library, not in the set
}

const makePatches = (base: Patch): Patches => ({
  base,
  a: tweak(base, { vcf_cutoff: 60 }),
  b: tweak(base, { vcf_cutoff: 120, dist_drive: 40 }),
  c: tweak(base, { lfo_rate: 50 }),
  file: tweak(base, { vcf_resonance: 70 }),
});

export interface Tb3App {
  app: ElectronApplication;
  page: Page;
  profile: string;
  library: string;
  patches: Patches;
}

async function launchElectron(profile: string) {
  // Load the built dist/, not a dev server.
  const env = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined && e[0] !== "VITE_DEV_SERVER_URL"),
  );
  const app = await electron.launch({ args: [APP_DIR, `--user-data-dir=${profile}`], env });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

// Point the app at the TB-3 ports and reload. The first load of a fresh profile has no ports chosen,
// so nothing can reach the real TB-3 before the fake is in place.
async function connect(page: Page, opts: { library?: string; fakeBlocks?: Record<string, number[]> }) {
  let port = FAKE_PORT;
  if (opts.fakeBlocks) {
    await page.addInitScript(installFakeTb3, { name: FAKE_PORT, blocks: opts.fakeBlocks });
  } else if (HW) {
    port = await page.evaluate(async (wanted) => {
      const a = await navigator.requestMIDIAccess({ sysex: true });
      const names = [...a.outputs.values()].map((p) => p.name ?? "");
      const name = wanted ? names.find((n) => n === wanted) : names.find((n) => /TB-3/i.test(n));
      if (!name)
        throw new Error(
          `${wanted ? `No MIDI port "${wanted}"` : "No MIDI port named TB-3: set TB3_PORT to the TB-3's port"}. Ports: ${names.join(", ")}`,
        );
      return name;
    }, process.env.TB3_PORT ?? "");
  }
  await page.evaluate(
    ([port, library]) => {
      localStorage.setItem("port.tb3In", port!);
      localStorage.setItem("port.tb3Out", port!);
      localStorage.setItem("tb3.channel", "2");
      if (library) localStorage.setItem("tb3.libraryRoot", library);
    },
    [port, opts.library],
  );
  await page.reload();
  await page.locator(".side").waitFor();
  if (!HW) expect(await page.evaluate(() => "__fakeTb3" in window)).toBe(true);
}

// Launch on a fresh profile with a library holding "Test set.tb3set" (A, B, C in slots 1–3) and
// "Audition.syx" (the file patch).
export async function start(): Promise<Tb3App> {
  const profile = await mkdtemp(path.join(tmpdir(), "tb3-e2e-profile-"));
  const library = await mkdtemp(path.join(tmpdir(), "tb3-e2e-library-"));
  const { app, page } = await launchElectron(profile);
  const demo = demoPatch();
  let patches: Patches;
  try {
    await connect(page, { library, fakeBlocks: HW ? undefined : demo.blocks });
    patches = makePatches(HW ? await readTb3(page) : demo);
  } catch (e) {
    await app.close();
    await rm(profile, { recursive: true, force: true });
    await rm(library, { recursive: true, force: true });
    throw e;
  }
  const slots: (Slot | null)[] = [...emptySlots()];
  slots[0] = { name: "A", patch: patches.a };
  slots[1] = { name: "B", patch: patches.b };
  slots[2] = { name: "C", patch: patches.c };
  await writeFile(path.join(library, "Test set.tb3set"), setToJson(slots));
  await writeFile(path.join(library, "Audition.syx"), patchToBytes(patches.file));
  return { app, page, profile, library, patches };
}

// Quit and launch again on the same profile, as a user reopening the app.
export async function relaunch(t: Tb3App): Promise<Tb3App> {
  await t.app.close();
  const { app, page } = await launchElectron(t.profile);
  // The ports are remembered: with the fake, the first load finds no port of that name.
  await connect(page, { fakeBlocks: HW ? undefined : t.patches.base.blocks });
  return { ...t, app, page };
}

export async function finish(t: Tb3App | undefined) {
  if (!t) return; // start() failed and cleaned up after itself
  if (HW) await sendToTb3(t.page, patchToSysex(t.patches.base)).catch(() => undefined);
  await t.app.close();
  await rm(t.profile, { recursive: true, force: true });
  await rm(t.library, { recursive: true, force: true });
}

async function sendToTb3(page: Page, msgs: number[][]) {
  await page.evaluate(async (msgs) => {
    const a = await navigator.requestMIDIAccess({ sysex: true });
    const out = [...a.outputs.values()].find((p) => p.name === localStorage.getItem("port.tb3Out"));
    msgs.forEach((m) => out?.send(m));
  }, msgs);
}

// Ask the TB-3 for all 11 blocks (RQ1) and decode its replies.
export async function readTb3(page: Page): Promise<Patch> {
  const requests = PATCH_BLOCKS.map((b) => rq1(b.addr, b.size));
  const replies = await page.evaluate(async (requests) => {
    const a = await navigator.requestMIDIAccess({ sysex: true });
    const input = [...a.inputs.values()].find((p) => p.name === localStorage.getItem("port.tb3In"));
    const output = [...a.outputs.values()].find((p) => p.name === localStorage.getItem("port.tb3Out"));
    if (!input || !output) throw new Error("TB-3 ports not found");
    const got: number[][] = [];
    const done = new Promise<void>((resolve, reject) => {
      const on = (e: Event) => {
        const data = (e as MIDIMessageEvent).data;
        if (data?.[6] !== 0x12) return;
        got.push(Array.from(data));
        if (got.length === requests.length) end(resolve);
      };
      const timer = setTimeout(
        () => end(() => reject(new Error(`TB-3 replied with ${got.length}/${requests.length} blocks`))),
        3000,
      );
      const end = (fn: () => void) => {
        clearTimeout(timer);
        input.removeEventListener("midimessage", on);
        fn();
      };
      input.addEventListener("midimessage", on);
    });
    requests.forEach((r) => output.send(r));
    await done;
    return got;
  }, requests);
  return patchFromSysex(replies);
}

// Wait until the TB-3 holds `want` (sends can trail the click by a tick or two).
export async function expectTb3(page: Page, want: Patch, what: string) {
  await expect
    .poll(async () => diffBlocks(await readTb3(page), want), { message: `TB-3 should hold ${what}`, timeout: 5000 })
    .toEqual([]);
}

// DT1 messages sent to the fake TB-3 since the last call, as block keys; null with the real TB-3,
// where only what it ends up holding can be checked.
export async function takeSent(page: Page): Promise<string[] | null> {
  if (HW) return null;
  const sent = await page.evaluate(() =>
    (window as unknown as { __fakeTb3: { sent: number[][] } }).__fakeTb3.sent.splice(0),
  );
  return sent.filter((m) => m[6] === 0x12).map((m) => addrKey(m.slice(7, 11)));
}

export const blockKeys = (keys: readonly string[]) => [...keys].sort();
export const allBlocks = () => blockKeys(PATCH_BLOCKS.map((b) => addrKey(b.addr)));

// UI handles.
export const slot = (page: Page, i: number) => page.locator(".slots16 .slot").nth(i);
export const sideButton = (page: Page, section: string, label: string) =>
  page.locator(`.side .${section}`).getByRole("button", { name: label, exact: true });

export async function openTestSet(page: Page) {
  await page.locator(".librow.set", { hasText: "Test set" }).dblclick();
  await expect(page.locator(".slots16 .slot.filled")).toHaveCount(3);
}

// Edit a patch param from its fader (one wheel notch towards the middle of its range, so it always
// changes) and return the edited patch the TB-3 should now hold.
export async function editParam(page: Page, from: Patch, id: string, label: string): Promise<Patch> {
  const def = paramById(id);
  const raw = getRaw(from, def);
  const up = raw < def.max / 2;
  const row = page.locator(".hrow").filter({ has: page.locator(".lbl", { hasText: new RegExp(`^${label}$`) }) });
  await row.locator(".hf").hover();
  await page.mouse.wheel(0, up ? -100 : 100);
  return setRaw(from, def, raw + (up ? 1 : -1));
}

// Press and hold on an element, run `during`, then release.
export async function hold(page: Page, sel: ReturnType<Page["locator"]>, during: () => Promise<void>) {
  const box = (await sel.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await during();
  await page.mouse.up();
}
