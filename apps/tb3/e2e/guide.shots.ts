// Screen grabs for the user guide (docs/user-guide.md), taken against the fake TB-3 with a made-up
// demo library. Not a test: run `npm run guide:shots -w @synth-editors/tb3` to retake them all
// after a UI change. The pictures land in docs/images/.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { efxTypes } from "../src/core/efx";
import type { EfxNum } from "../src/core/efx";
import { setEfxRaw, setEfxType, setRaw } from "../src/core/patch";
import type { Patch } from "../src/core/patch";
import { paramById } from "../src/core/params";
import { emptySlots, patchToBytes, setToJson } from "../src/core/patchSet";
import type { Slot } from "../src/core/patchSet";
import { demoPatch } from "../src/editor/demoPatch";
import { finish, hold, slot, start } from "./tb3";
import type { Tb3App } from "./tb3";

const OUT = fileURLToPath(new URL("../docs/images/", import.meta.url));
const WINDOW = { width: 1600, height: 1000 };

type EfxBytes = Record<number, number>;

// An EFX type with its slots at their defaults (or 40% where the default is 0, so the faders show
// something), switched on.
function withEfx(p: Patch, num: EfxNum, type: number): Patch {
  const t = efxTypes(num)[type]!;
  p = setEfxType(p, num, type);
  for (const s of t.slots) if (s) p = setEfxRaw(p, num, s.offset, Math.round((s.default || 0.4) * s.max));
  return t.swOffset === undefined ? p : setEfxRaw(p, num, t.swOffset, 1);
}

const withBytes = (p: Patch, num: EfxNum, bytes: EfxBytes) =>
  Object.entries(bytes).reduce((q, [o, v]) => setEfxRaw(q, num, Number(o), v), p);

// A patch from the demo one: params by id, EFX types, then any EFX bytes by offset.
function vary(
  values: Record<string, number>,
  efx: Partial<Record<EfxNum, number>> = {},
  bytes: Partial<Record<EfxNum, EfxBytes>> = {},
): Patch {
  let p = demoPatch();
  for (const [id, v] of Object.entries(values)) p = setRaw(p, paramById(id), v);
  for (const [n, type] of Object.entries(efx)) p = withEfx(p, Number(n) as EfxNum, type);
  for (const [n, set] of Object.entries(bytes)) p = withBytes(p, Number(n) as EfxNum, set);
  return p;
}

// EQ bands (EFX1 offsets 0x54–0x5e; gains are 0–40 with 0 dB at 20): a low cut, a bass lift, a
// mid scoop and some top.
const EQ_SHAPE = { 0x54: 3, 0x55: 26, 0x56: 14, 0x57: 2, 0x58: 12, 0x59: 24, 0x5a: 1, 0x5b: 27, 0x5d: 23, 0x5e: 20 };

const PATCHES: Record<string, Patch> = {
  "Squelch Lead": vary({ vcf_cutoff: 90, vcf_resonance: 200, dist_type: 13, dist_drive: 110 }),
  "Rubber Line": vary(
    { vcf_cutoff: 60, vcf_resonance: 120, vco_sqr_level: 0, vco_white_level: 0, vco_pink_level: 0, dist_sw: 0 },
    { 1: 10, 2: 9 },
    { 1: EQ_SHAPE },
  ),
  "Night Drive": vary({ vcf_cutoff: 140, lfo_rate: 70, vcf_lfo_depth: 100, dist_type: 22 }, { 1: 6 }),
  "Sub Pulse": vary({ vcf_cutoff: 40, vco_saw_level: 0, vco_sin_level: 127, vco_white_level: 0, vco_ring_level: 0 }),
  "Round Low": vary({ vcf_cutoff: 70, vcf_env_depth: 120, vco_white_level: 0, vco_pink_level: 0 }, { 2: 9 }),
  "Noise Sweep": vary({ vco_white_level: 127, vco_saw_level: 20, vcf_lfo_depth: 127, lfo_rate: 30 }, { 2: 9 }),
  "Ring Bells": vary({ vco_ring_level: 127, rm_depth: 127, vcf_cutoff: 200, vca_sustain: 0 }, { 1: 5 }),
  "Acid Test": vary({ vcf_cutoff: 100, vcf_resonance: 230, vcf_decay: 40 }, { 1: 3 }),
};

const FILES: Record<string, string> = {
  "Acid/Squelch Lead.syx": "Squelch Lead",
  "Acid/Rubber Line.syx": "Rubber Line",
  "Acid/Night Drive.syx": "Night Drive",
  "Acid/Acid Test.syx": "Acid Test",
  "Bass/Sub Pulse.syx": "Sub Pulse",
  "Bass/Round Low.syx": "Round Low",
  "FX/Noise Sweep.syx": "Noise Sweep",
  "FX/Ring Bells.syx": "Ring Bells",
};

const SET_SLOTS = ["Squelch Lead", "Rubber Line", "Night Drive", "Sub Pulse", "Round Low", "Noise Sweep", "Ring Bells"];

// The demo library, in a folder of its own so the tree's top node reads "TB-3 Library".
async function writeLibrary(dir: string) {
  for (const [rel, name] of Object.entries(FILES)) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), patchToBytes(PATCHES[name]!));
  }
  await writeFile(path.join(dir, "FX", "Half a patch.syx"), patchToBytes(PATCHES["Ring Bells"]!).slice(0, 40));
  const slots: (Slot | null)[] = [...emptySlots()];
  SET_SLOTS.forEach((name, i) => (slots[i] = { name, patch: PATCHES[name]! }));
  await mkdir(path.join(dir, "Sets"), { recursive: true });
  await writeFile(path.join(dir, "Sets", "Live set.tb3set"), setToJson(slots));
  await writeFile(path.join(dir, "Sets", "Practice.tb3set"), setToJson(emptySlots()));
}

// Screenshot the box around some elements, with a margin.
async function shot(page: Page, name: string, parts: Locator[], pad = 6) {
  await page.mouse.move(0, 0);
  await shotHere(page, name, parts, pad);
}

// The same, with the pointer left where it is (holds, hover states, tooltips).
async function shotHere(page: Page, name: string, parts: Locator[], pad = 6) {
  const boxes = await Promise.all(parts.map(async (l) => (await l.boundingBox())!));
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
  const right = Math.min(WINDOW.width, Math.max(...boxes.map((b) => b.x + b.width)) + pad);
  const bottom = Math.min(WINDOW.height, Math.max(...boxes.map((b) => b.y + b.height)) + pad);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x, y, width: right - x, height: bottom - y } });
}

const full = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const side = (page: Page, block: string) => page.locator(`.side > section.${block}`);
const libRow = (page: Page, name: string) =>
  page.locator(".librow").filter({ has: page.locator(".name", { hasText: new RegExp(`^${name}$`) }) });
// The library section down to its last row (it fills the sidebar, mostly empty below).
const libraryTop = (page: Page) => [
  side(page, "library").locator("header"),
  side(page, "library").locator(".librow").last(),
];
const settle = (page: Page) => page.waitForTimeout(250);

// The demo library chosen, the window sized, before the first sync.
async function openDemo(t: Tb3App) {
  const { app, page } = t;
  await mkdir(OUT, { recursive: true });
  const library = path.join(t.library, "TB-3 Library");
  await writeLibrary(library);
  await app.evaluate(({ BrowserWindow }, size) => {
    BrowserWindow.getAllWindows()[0]!.setContentSize(size.width, size.height);
  }, WINDOW);
  await page.evaluate((dir) => localStorage.setItem("tb3.libraryRoot", dir), library);
  await page.reload();
  await page.locator(".side").waitFor();
  await expect(libRow(page, "Acid")).toHaveCount(1);
  await settle(page);
}

// Before the first sync: the MIDI settings, then SYNC FROM TB-3.
async function shootFirstLaunch(page: Page, tb3: Locator) {
  await full(page, "first-launch");
  await tb3.getByRole("button", { name: "MIDI", exact: true }).click();
  await shot(page, "midi-settings", [tb3, page.locator(".popover.settings")]);
  await page.getByRole("button", { name: "CLOSE" }).click();

  await tb3.getByRole("button", { name: "SYNC FROM TB-3" }).click();
  await expect(side(page, "patch")).toContainText("Synced from TB-3");
  await settle(page);
}

// A set open, slot 2 active, unsaved edits in slot 3: the editor rows, distortion types, assign.
async function shootEditor(page: Page) {
  await libRow(page, "Live set").dblclick();
  await expect(page.locator(".slots16 .slot.filled")).toHaveCount(SET_SLOTS.length);
  await slot(page, 2).click();
  await page.locator(".vcf .hrow").first().locator(".hf").hover();
  await page.mouse.wheel(0, -100);
  await page.mouse.wheel(0, -100);
  await slot(page, 1).click();
  await settle(page);
  await full(page, "overview");
  await shot(page, "patch-and-set", [side(page, "patch"), side(page, "patches")]);
  await shot(page, "top-strip", [page.locator(".editor > .strip")]);
  await shot(page, "row-oscillators", [page.locator(".editor > .osc")]);
  await shot(page, "row-shaping", [page.locator(".editor > .shape")]);
  await shot(page, "row-effects", [page.locator(".editor > .fx")]);

  // Distortion types.
  await page.locator(".dist .stepname").click();
  await shot(page, "distortion-types", [page.locator(".dist"), page.locator(".dist .popover")]);
  await page.locator(".dist .stepname").click();

  // Assign.
  await page.locator(".assign .assignbtn").first().click();
  await shot(page, "assign", [page.locator(".editor > .strip"), page.locator(".editor > .osc")]);
  await page.keyboard.press("Escape");
}

// DELETE and GRAB, and a slot's menu.
async function shootSlots(page: Page) {
  await side(page, "patches").getByRole("button", { name: "DELETE", exact: true }).click();
  await shot(page, "mode-delete", [side(page, "patch"), side(page, "patches")]);
  await page.keyboard.press("Escape");
  await side(page, "patches").getByRole("button", { name: "GRAB", exact: true }).click();
  await hold(page, slot(page, 3), async () => {
    await expect(side(page, "patch")).toContainText("Sub Pulse");
    await settle(page);
    await shotHere(page, "mode-grab", [side(page, "patch"), side(page, "patches")]);
  });
  await page.keyboard.press("Escape");
  await slot(page, 1).click({ button: "right" });
  await shot(page, "slot-menu", [side(page, "patches"), page.locator(".ctxmenu")]);
  await page.keyboard.press("Escape");
  await page.mouse.click(5, WINDOW.height - 5);
}

// The library: menu, audition, search; then SAVE AS….
async function shootLibrary(page: Page) {
  await shot(page, "library", libraryTop(page));
  await libRow(page, "Ring Bells").click({ button: "right" });
  await shot(page, "library-menu", [...libraryTop(page), page.locator(".ctxmenu")]);
  await page.keyboard.press("Escape");
  await page.mouse.click(5, WINDOW.height - 5);
  await hold(page, libRow(page, "Round Low").locator(".play"), async () => {
    await expect(side(page, "patch")).toContainText("Round Low");
    await settle(page);
    await shotHere(page, "library-audition", [side(page, "patch"), ...libraryTop(page)]);
  });
  await side(page, "library").locator(".search").fill("ub");
  await settle(page);
  await shot(page, "library-search", libraryTop(page));
  await side(page, "library").locator(".search").fill("");

  // Save as.
  await libRow(page, "Acid").click();
  await side(page, "patch").getByRole("button", { name: "SAVE AS…" }).click();
  await shot(page, "save-as", [page.locator(".dialog")], 12);
  await page.keyboard.press("Escape");
}

// Morph towards slot 5, then UNDO's tooltip.
async function shootMorphAndUndo(page: Page, tb3: Locator) {
  const morph = side(page, "morph");
  await morph.getByRole("button", { name: "PICK" }).click();
  await slot(page, 4).click();
  const amount = morph.locator(".hrow").nth(1).locator(".hf");
  const box = (await amount.boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await settle(page);
  await shot(page, "morph", [side(page, "patches"), morph]);
  await morph.getByRole("button", { name: "CLEAR" }).click();

  // Undo, with its tooltip.
  await tb3.getByRole("button", { name: "UNDO", exact: true }).hover();
  await expect(page.locator(".tooltip")).toBeVisible({ timeout: 3000 });
  await shotHere(page, "undo", [tb3, page.locator(".tooltip")]);
}

let t: Tb3App | undefined;
test.afterEach(async () => finish(t));

test("user guide screen grabs", async () => {
  t = await start();
  const { page } = t;
  const tb3 = page.locator(".strip .tb3");
  await openDemo(t);
  await shootFirstLaunch(page, tb3);
  await shootEditor(page);
  await shootSlots(page);
  await shootLibrary(page);
  await shootMorphAndUndo(page, tb3);
});
