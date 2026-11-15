// Screen grabs for the user guide (docs/user-guide.md), taken against the fake SP-404 with a made-up project and
// FX library. Not a test: run `npm run guide:shots -w @synth-editors/sp404` to retake them all after a UI change.
// The window is the layout's own 1920 × 1080, so every picture is the size it is on screen.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { finish, start, type Sp404App } from "./sp404";
import type { FakeSp404Init } from "./fakeSp404";

const OUT = fileURLToPath(new URL("../docs/images/", import.meta.url));
const WINDOW = { width: 1920, height: 1080 };
const LIBRARY_ON_MAC = "~/Library/Application Support/@synth-editors/sp404/fx-library.json";

const PROJECT: FakeSp404Init = {
  project: 5,
  projectName: "LIVE SET",
  pads: [
    { pad: 0, name: "KICK 1", level: 118 },
    { pad: 1, name: "SNARE", level: 104, pan: 58, routing: 2 },
    { pad: 2, name: "CLAP", level: 96, pan: 70 },
    { pad: 3, name: "HAT", level: 88, pan: 80, muteGroup: 1 },
    { pad: 4, name: "OPEN HAT", level: 80, pan: 48, muteGroup: 1 },
    { pad: 5, name: "PERC LOOP", level: 92, routing: 0, attack: 10, release: 40 },
    { pad: 16, name: "SUB BASS", level: 110 },
    { pad: 17, name: "BASS STAB", level: 100, release: 30 },
    { pad: 18, name: "CHORD PAD", level: 84, attack: 40, release: 70, routing: 2 },
    { pad: 40, name: "VOX", attack: 20, release: 60 },
  ],
  bankVolumes: [120, 108, 127, 127, 127, 127, 127, 127, 127, 127],
};

const EFFECTS: [string, string][] = [
  ["INPUT FX", "Reverb"],
  ["BUS 1", "Filter + Drive"],
  ["BUS 2", "Resonator"],
  ["BUS 3", "Sync Delay"],
  ["BUS 4 · MASTER", "Compressor"],
];

// Screenshot the box around some elements, with a margin, the pointer out of the way.
async function shot(page: Page, name: string, parts: Locator[], pad = 6) {
  await page.mouse.move(0, 0);
  const boxes = await Promise.all(parts.map(async (l) => (await l.boundingBox())!));
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
  const right = Math.min(WINDOW.width, Math.max(...boxes.map((b) => b.x + b.width)) + pad);
  const bottom = Math.min(WINDOW.height, Math.max(...boxes.map((b) => b.y + b.height)) + pad);
  const clip = { x, y, width: right - x, height: bottom - y };
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip, scale: "css" });
}

const full = async (page: Page, name: string) => {
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), scale: "css" });
};

const module = (page: Page, bus: number) => page.locator(`.bus[data-bus="${bus}"]`);
const preset = (page: Page, bus: string, n: number) =>
  page.getByRole("button", { name: `${bus} preset ${n}`, exact: true });

async function chooseEffect(page: Page, bus: string, name: string) {
  await page.getByRole("button", { name: `${bus} effect` }).click();
  await page.getByRole("dialog", { name: `Effects for ${bus}` }).getByRole("button", { name, exact: true }).click();
}

// Wheel a module's first knob (or slider) by some notches.
async function turn(page: Page, bus: number, notches: number) {
  await module(page, bus).getByRole("slider").first().hover();
  for (let i = 0; i < Math.abs(notches); i++) await page.mouse.wheel(0, notches > 0 ? -40 : 40);
}

// Presets 1–3 on each bus, each a little different, then the bus back on preset 1; two scenes.
async function fillLibrary(page: Page) {
  for (const [bus, name] of EFFECTS) await chooseEffect(page, bus, name);
  const buses: [string, number][] = [["INPUT FX", 5], ["BUS 1", 1], ["BUS 2", 2], ["BUS 3", 3], ["BUS 4", 4]];
  for (const [label, bus] of buses) {
    for (const n of [1, 2, 3]) {
      if (n > 1) await turn(page, bus, 12);
      await preset(page, label, n).click();
    }
    await preset(page, label, 1).click();
  }
  await page.getByRole("button", { name: "FX scene 1", exact: true }).click();
  await preset(page, "BUS 1", 3).click();
  await page.getByRole("button", { name: "FX scene 2", exact: true }).click();
  await page.getByRole("button", { name: "FX scene 1", exact: true }).click();
}

async function chooseFakeAudio(page: Page) {
  await page.getByRole("button", { name: "SETTINGS" }).click();
  const menu = page.getByLabel("AUDIO IN");
  const fake = await menu.locator("option", { hasText: /fake/i }).first().getAttribute("value");
  await menu.selectOption(fake!);
  await page.getByRole("button", { name: "Close settings" }).click();
}

async function fxShots(page: Page) {
  await full(page, "overview");
  await shot(page, "top-bar", [page.locator(".bar")], 0);
  await shot(page, "module", [module(page, 2)]);
  await shot(page, "scenes", [page.locator(".fxrow > .side")]);

  await page.getByRole("button", { name: "BUS 1 effect" }).click();
  await shot(page, "chooser", [page.locator(".chooser")]);
  await page.keyboard.press("Escape");

  // Morph BUS 1 a little over halfway towards preset 2.
  await page.getByRole("button", { name: "Bus 1 morph on" }).click();
  await preset(page, "BUS 1", 2).click();
  const track = (await page.getByRole("slider", { name: "Bus 1 morph" }).boundingBox())!;
  const y = track.y + track.height / 2;
  await page.mouse.move(track.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(track.x + 4 + track.width * 0.6, y, { steps: 12 });
  await page.mouse.up();
  await shot(page, "morph", [module(page, 1)]);
  await page.getByRole("button", { name: "Bus 1 morph on" }).click();

  await page.getByRole("button", { name: "BUS 3 lock" }).click();
  await shot(page, "lock", [module(page, 3)]);
  await page.getByRole("button", { name: "BUS 3 lock" }).click();

  await page.getByRole("button", { name: "DEL" }).click();
  await shot(page, "delete-mode", [module(page, 4)]);
  await page.getByRole("button", { name: "DEL" }).click();
}

async function mixerShots(page: Page) {
  await shot(page, "mixer", [page.locator(".mixer")], 0);
  await shot(page, "strip", [page.locator('.ws[data-pad="A2"]'), page.locator('[data-bank-master="A"]')], 2);
  await page.getByRole("button", { name: "A6 envelope" }).click();
  await shot(page, "envelope", [page.getByRole("dialog", { name: "A6 envelope" })]);
  await page.getByRole("button", { name: "Close envelope" }).click();
  await page.getByRole("button", { name: "SCOPE" }).click();
  await page.waitForTimeout(4000);
  await shot(page, "scope", [page.locator(".mixer")], 0);
  await page.getByRole("button", { name: "SPECTROGRAM" }).click();
  await page.waitForTimeout(4000);
  await shot(page, "spectrogram", [page.locator(".scope")]);
  await page.getByRole("button", { name: "SPECTRUM" }).click();
  await page.getByRole("button", { name: "DESK" }).click();
  await page.getByRole("button", { name: "SETTINGS" }).click();
  const libraryNote = page.getByRole("dialog", { name: "Settings" }).locator(".note", { hasText: "saved as you go" });
  await libraryNote.evaluate((n, where) => {
    n.textContent = n.textContent!.replace(/to .*fx-library\.json/, `to ${where}`); // not the throwaway profile
  }, LIBRARY_ON_MAC);
  await shot(page, "settings", [page.getByRole("dialog", { name: "Settings" })]);
  await page.getByRole("button", { name: "Close settings" }).click();
}

let running: Sp404App | undefined;
test.afterEach(async () => finish(running));

test("user guide pictures", async () => {
  const r = (running = await start(PROJECT));
  await r.app.evaluate(({ BrowserWindow }, s) => {
    BrowserWindow.getAllWindows()[0]!.setContentSize(s.width, s.height);
  }, WINDOW);
  await r.page.reload();
  await r.page.locator(".ws[data-pad]").first().waitFor();
  await r.page.evaluate(() => document.fonts.ready);
  await chooseFakeAudio(r.page);
  await fillLibrary(r.page);
  await r.page.waitForTimeout(1500); // the meter settles
  await fxShots(r.page);
  await mixerShots(r.page);
});
