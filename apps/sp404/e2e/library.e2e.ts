// The FX library (Phase 4) against the fake SP-404's MIDI: presets, DEF, STORE and DEL, LOCK, GRAB, morph, FX
// scenes, and the library file in the app's (throwaway) user data folder.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { finish, midiSent, start, type Sp404App } from "./sp404";

let running: Sp404App | undefined;
test.afterEach(async () => finish(running));

const module = (r: Sp404App, bus: number) => r.page.locator(`.bus[data-bus="${bus}"]`);
const preset = (r: Sp404App, n: number) => r.page.getByRole("button", { name: `BUS 1 preset ${n}` });
const sentSince = async (r: Sp404App, from: number) => (await midiSent(r.page)).slice(from);
const count = async (r: Sp404App) => (await midiSent(r.page)).length;

// Filter + Drive on BUS 1 (sends 8 messages), with the first knob (CUTOFF, CC 16) at 70.
async function withDrive(r: Sp404App) {
  await r.page.getByRole("button", { name: "BUS 1 effect" }).click();
  const chooser = r.page.getByRole("dialog", { name: "Effects for BUS 1" });
  await chooser.getByRole("button", { name: "Filter + Drive", exact: true }).click();
  await expect.poll(() => count(r)).toBe(8);
}

// Turn CUTOFF by `steps` wheel notches.
async function turnCutoff(r: Sp404App, steps: number) {
  await module(r, 1).getByRole("slider", { name: "CUTOFF" }).first().hover();
  for (let i = 0; i < Math.abs(steps); i++) await r.page.mouse.wheel(0, steps > 0 ? -40 : 40);
}

test("an empty preset stores, a stored one recalls (sending only what changed) and lights while it matches", async () => {
  const r = (running = await start());
  await withDrive(r);
  await preset(r, 1).click();
  await expect(preset(r, 1)).toHaveClass(/stored/);
  await expect(preset(r, 1)).toHaveClass(/\bon\b/);
  await turnCutoff(r, 3);
  await expect(preset(r, 1)).not.toHaveClass(/\bon\b/);
  const before = await count(r);
  await preset(r, 1).click();
  await expect.poll(() => sentSince(r, before)).toEqual([[0xb0, 16, 70]]);
  await expect(preset(r, 1)).toHaveClass(/\bon\b/);
});

test("STORE stores over a stored slot and DEF; DEF recalls; DEL deletes and clears a bus", async () => {
  const r = (running = await start());
  await withDrive(r);
  await preset(r, 2).click();
  await turnCutoff(r, 5);
  await r.page.getByRole("button", { name: "STORE" }).click();
  await preset(r, 2).click(); // overwrite
  await module(r, 1).getByRole("button", { name: "DEF" }).click(); // store defaults at 75
  await r.page.getByRole("button", { name: "STORE" }).click();
  await turnCutoff(r, -10);
  const before = await count(r);
  await module(r, 1).getByRole("button", { name: "DEF" }).click();
  await expect.poll(() => sentSince(r, before)).toEqual([[0xb0, 16, 75]]);
  await expect(preset(r, 2)).toHaveClass(/\bon\b/); // the overwritten preset matches
  await r.page.getByRole("button", { name: "DEL" }).click();
  await preset(r, 2).click();
  await expect(preset(r, 2)).not.toHaveClass(/stored/);
  await r.page.getByRole("button", { name: "Clear BUS 1" }).click();
  await expect(module(r, 1).locator(".name")).toHaveText("CHOOSE AN EFFECT");
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb0, 19, 0]);
});

test("LOCK keeps presets from being stored and the bus from scene recall; presets still recall", async () => {
  const r = (running = await start());
  await withDrive(r);
  await preset(r, 1).click();
  await r.page.getByRole("button", { name: "FX scene 1", exact: true }).click(); // stores all buses, CUTOFF 70
  await r.page.getByRole("button", { name: "BUS 1 lock" }).click();
  await preset(r, 2).click();
  await expect(preset(r, 2)).not.toHaveClass(/stored/);
  await turnCutoff(r, 4);
  const before = await count(r);
  await r.page.getByRole("button", { name: "FX scene 1", exact: true }).click();
  await r.page.waitForTimeout(200);
  expect(await sentSince(r, before)).toEqual([]); // the locked bus keeps its values
  await preset(r, 1).click();
  await expect.poll(() => sentSince(r, before)).toEqual([[0xb0, 16, 70]]);
});

test("with GRAB on, holding a stored preset plays it until let go", async () => {
  const r = (running = await start());
  await withDrive(r);
  await preset(r, 1).click();
  await turnCutoff(r, 6);
  await module(r, 1).getByRole("button", { name: "BUS 1 grab" }).click();
  const before = await count(r);
  const box = (await preset(r, 1).boundingBox())!;
  await r.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await r.page.mouse.down();
  await expect.poll(() => sentSince(r, before)).toEqual([[0xb0, 16, 70]]);
  await r.page.mouse.up();
  await expect.poll(() => sentSince(r, before)).toEqual([[0xb0, 16, 70], [0xb0, 16, 76]]);
});

test("morph blends towards the target preset; turning it off keeps the blend", async () => {
  const r = (running = await start());
  await withDrive(r);
  await turnCutoff(r, -20); // 50
  await preset(r, 1).click();
  await turnCutoff(r, 40); // 90
  await r.page.getByRole("button", { name: "Bus 1 morph on" }).click();
  await preset(r, 1).click(); // the target, not a recall
  await expect(preset(r, 1)).toHaveClass(/target/);
  const track = r.page.getByRole("slider", { name: "Bus 1 morph" });
  await track.hover();
  for (let i = 0; i < 50; i++) await r.page.mouse.wheel(0, -40); // halfway
  await expect(track).toHaveAttribute("aria-valuenow", "50");
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb0, 16, 70]);
  await r.page.getByRole("button", { name: "Bus 1 morph on" }).click();
  await expect(module(r, 1).getByRole("slider", { name: "CUTOFF" }).first()).toHaveAttribute("aria-valuenow", "70");
});

test("a scene stores all five buses and recalls them; the library is saved to a file", async () => {
  const r = (running = await start());
  await withDrive(r);
  await r.page.getByRole("button", { name: "FX scene 3", exact: true }).click();
  await module(r, 1).getByRole("button", { name: "BUS 1 on" }).click();
  await turnCutoff(r, 2);
  const before = await count(r);
  await r.page.getByRole("button", { name: "FX scene 3", exact: true }).click();
  await expect.poll(() => sentSince(r, before)).toEqual([[0xb0, 19, 127], [0xb0, 16, 70]]);
  await expect(r.page.getByRole("button", { name: "FX scene 3", exact: true })).toHaveClass(/\bon\b/);
  const file = path.join(r.profile, "fx-library.json");
  await expect.poll(async () => JSON.parse(await readFile(file, "utf8").catch(() => "{}")).kind, { timeout: 5000 })
    .toBe("sp404-fx-library");
  const saved = JSON.parse(await readFile(file, "utf8"));
  expect(saved.scenes[2]["1"].fxId).toBe(1);
});
