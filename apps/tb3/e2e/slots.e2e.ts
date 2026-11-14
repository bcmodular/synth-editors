// What reaches the TB-3 from the PATCH, SET and MORPH blocks and the library. Every test checks
// what the TB-3 ends up holding by reading it back; against the fake TB-3 they also check which
// blocks were sent. `npm run test:e2e` runs them on the fake, `npm run test:tb3` on the real one.
import { expect, test } from "@playwright/test";
import { diffBlocks } from "../src/core/patch";
import {
  allBlocks,
  blockKeys,
  editParam,
  HW,
  expectTb3,
  finish,
  hold,
  openTestSet,
  readTb3,
  relaunch,
  sideButton,
  slot,
  start,
  takeSent,
} from "./tb3";
import type { Tb3App } from "./tb3";

let t: Tb3App;
let running: Tb3App | undefined; // what afterEach must close; unset when start() fails
test.beforeEach(async () => {
  running = undefined;
  t = running = await start();
  await openTestSet(t.page);
});
test.afterEach(async () => finish(running));

test("opening a set sends nothing", async () => {
  await t.page.waitForTimeout(300);
  expect(await takeSent(t.page)).toEqual(HW ? null : []);
  await expectTb3(t.page, t.patches.base, "the patch it started with");
});

// The blocks some DT1s write into (a run inside a block is addressed at its offset).
const blocksOf = (addrs: string[]) => [...new Set(addrs.map((a) => `${a.slice(0, 6)}00`))].sort();

test("recalling a slot sends only what differs", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  const first = await takeSent(page);
  if (first) expect(blockKeys(first)).toEqual(allBlocks()); // what the TB-3 holds is unknown at first
  await slot(page, 1).click();
  await expectTb3(page, p.b, "slot 2");
  const second = await takeSent(page);
  // QUIET SWITCH (on to start with) adds the VCA block's MASTER VOLUME, to 0 and back.
  if (second) expect(blocksOf(second)).toEqual(blocksOf([...diffBlocks(p.a, p.b), "10000C00"]));
});

test("clicking an empty slot stores the patch without sending", async () => {
  const { page, patches: p } = t;
  await slot(page, 1).click();
  await expectTb3(page, p.b, "slot 2");
  await takeSent(page);
  await slot(page, 3).click();
  await expect(slot(page, 3)).toHaveClass(/filled/);
  await expect(slot(page, 3)).toHaveClass(/active/);
  expect(await takeSent(page)).toEqual(HW ? null : []);
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  await slot(page, 3).click();
  await expectTb3(page, p.b, "slot 4, stored from slot 2");
});

test("QUIET SWITCH (on to start with) mutes the TB-3 while recalling, and restores the volume", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  await page.locator(".strip .tb3").getByRole("button", { name: "MIDI", exact: true }).click();
  await expect(page.getByRole("button", { name: "QUIET SWITCH" })).toHaveClass(/\bon\b/);
  await takeSent(page);
  await slot(page, 1).click();
  await expectTb3(page, p.b, "slot 2, volume back");
  const sent = await takeSent(page);
  if (sent) {
    expect(sent[0]).toBe("10000C04"); // MASTER VOLUME, to 0, first
    expect(sent.at(-1)).toBe("10000C04"); // and back, last
  }
});

// Holding a slot auditions it, in GRAB mode or with Shift held; letting go returns to the active slot.
const AUDITIONS: [string, (page: Tb3App["page"]) => Promise<unknown>, (page: Tb3App["page"]) => Promise<unknown>][] = [
  ["GRAB", (page) => sideButton(page, "patches", "GRAB").click(), async () => {}],
  ["Shift, without GRAB", (page) => page.keyboard.down("Shift"), (page) => page.keyboard.up("Shift")],
];
for (const [how, before, after] of AUDITIONS) {
  test(`${how}: holding a slot plays it, then returns`, async () => {
    const { page, patches: p } = t;
    await slot(page, 0).click();
    await expectTb3(page, p.a, "slot 1");
    await before(page);
    await hold(page, slot(page, 2), () => expectTb3(page, p.c, "slot 3 while held"));
    await after(page);
    await expectTb3(page, p.a, "slot 1 again after release");
    await expect(slot(page, 0)).toHaveClass(/active/);
  });
}

test("the library's ▶ plays a file while held, then returns", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  const play = page.locator(".librow.patch", { hasText: "Audition" }).locator(".play");
  await hold(page, play, () => expectTb3(page, p.file, "Audition.syx while held"));
  await expectTb3(page, p.a, "slot 1 again after release");
});

test("GRAB returns to the active slot's unsaved edits", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  const edited = await editParam(page, p.a, "master_volume", "VOLUME");
  await expectTb3(page, edited, "slot 1 with the edit");
  await expect(slot(page, 0)).toHaveClass(/modified/);
  await sideButton(page, "patches", "GRAB").click();
  await hold(page, slot(page, 2), () => expectTb3(page, p.c, "slot 3 while held"));
  await expectTb3(page, edited, "slot 1 with the edit after release");
  await expect(slot(page, 0)).toHaveClass(/modified/);
});

test("the library's ▶ returns to the active slot's unsaved edits", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  const edited = await editParam(page, p.a, "master_volume", "VOLUME");
  await expectTb3(page, edited, "slot 1 with the edit");
  const play = page.locator(".librow.patch", { hasText: "Audition" }).locator(".play");
  await hold(page, play, () => expectTb3(page, p.file, "Audition.syx while held"));
  await expectTb3(page, edited, "slot 1 with the edit after release");
});

test("morph CLEAR goes back to the patch from before the morph", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  await sideButton(page, "morph", "PICK").click();
  await slot(page, 1).click();
  const fader = page.locator(".side .morph .hf").first();
  const box = (await fader.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, y, { steps: 10 });
  await page.mouse.up();
  await expect(fader).not.toHaveText("0%");
  await expect.poll(async () => diffBlocks(await readTb3(page), p.a).length, { timeout: 5000 }).toBeGreaterThan(0);
  await sideButton(page, "morph", "CLEAR").click();
  await expectTb3(page, p.a, "slot 1 after CLEAR");
  await expect(fader).toHaveClass(/disabled/); // no target any more
});

test("undo and redo a DELETE, from the keys and the buttons", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  await takeSent(page);
  await sideButton(page, "patches", "DELETE").click();
  await slot(page, 1).click();
  await page.keyboard.press("Escape");
  await expect(slot(page, 1)).not.toHaveClass(/filled/);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(slot(page, 1)).toHaveClass(/filled/);
  const historyButton = (label: string) => page.locator(".strip .tb3").getByRole("button", { name: label, exact: true });
  const redo = historyButton("REDO");
  await expect(redo).toHaveAttribute("title", "Redo DELETE slot 2 (⇧⌘Z)");
  await redo.click();
  await expect(slot(page, 1)).not.toHaveClass(/filled/);
  await historyButton("UNDO").click();
  await expect(slot(page, 1)).toHaveClass(/filled/);
  expect(await takeSent(page)).toEqual(HW ? null : []); // the active patch never changed
  await slot(page, 1).click();
  await expectTb3(page, p.b, "slot 2, back after undo");
});

test("undo a run of edits to one param in one step, and redo it", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  const once = await editParam(page, p.a, "master_volume", "VOLUME");
  const twice = await editParam(page, once, "master_volume", "VOLUME");
  await expectTb3(page, twice, "slot 1 with two edits");
  await expect(slot(page, 0)).toHaveClass(/modified/);
  await page.keyboard.press("ControlOrMeta+z");
  await expectTb3(page, p.a, "slot 1 as saved");
  await expect(slot(page, 0)).not.toHaveClass(/modified/);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expectTb3(page, twice, "slot 1 with both edits again");
});

test("undo a morph CLEAR goes back to the blend", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  await sideButton(page, "morph", "PICK").click();
  await slot(page, 1).click();
  const fader = page.locator(".side .morph .hf").first();
  const box = (await fader.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, y, { steps: 10 });
  await page.mouse.up();
  const amount = await fader.textContent();
  await expect.poll(async () => diffBlocks(await readTb3(page), p.a).length, { timeout: 5000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1000); // let the rate-limited sends catch up
  const blend = await readTb3(page);
  await sideButton(page, "morph", "CLEAR").click();
  await expectTb3(page, p.a, "slot 1 after CLEAR");
  await page.keyboard.press("ControlOrMeta+z");
  await expectTb3(page, blend, "the blend again");
  await expect(fader).toHaveText(amount!);
});

test("Revert to saved puts the active slot back, and undo brings the edit back", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  const edited = await editParam(page, p.a, "master_volume", "VOLUME");
  await expectTb3(page, edited, "slot 1 with the edit");
  await slot(page, 0).click({ button: "right" });
  await page.locator(".ctxitem", { hasText: "Revert to saved" }).click();
  await expectTb3(page, p.a, "slot 1 as saved");
  await expect(slot(page, 0)).not.toHaveClass(/modified/);
  await expect(slot(page, 0)).toHaveClass(/active/);
  await page.keyboard.press("ControlOrMeta+z");
  await expectTb3(page, edited, "slot 1 with the edit again");
  await expect(slot(page, 0)).toHaveClass(/modified/);
});

test("REVERT puts every slot back as the set was opened", async () => {
  const { page, patches: p } = t;
  const revert = sideButton(page, "patches", "REVERT");
  await expect(revert).toBeDisabled();
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  await editParam(page, p.a, "master_volume", "VOLUME");
  await sideButton(page, "patches", "DELETE").click();
  await slot(page, 1).click();
  await page.keyboard.press("Escape");
  await expect(slot(page, 1)).not.toHaveClass(/filled/);
  await revert.click();
  await expectTb3(page, p.a, "slot 1 as saved");
  await expect(slot(page, 1)).toHaveClass(/filled/);
  await expect(page.locator(".slotgrid .slot.modified")).toHaveCount(0);
  await expect(revert).toBeDisabled();
});

// A slot's tooltip text (ui/Tooltip moves `title` to `data-tip` while the pointer is over it).
const slotTip = (page: Tb3App["page"], i: number) =>
  slot(page, i).evaluate((el) => el.getAttribute("title") ?? el.getAttribute("data-tip"));

test("dragging a slot onto another swaps them, without sending; undo swaps back", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  await takeSent(page);
  await slot(page, 0).dragTo(slot(page, 2));
  await expect(slot(page, 2)).toHaveClass(/active/);
  await expect.poll(() => slotTip(page, 0)).toMatch(/^1 · C/);
  await expect.poll(() => slotTip(page, 2)).toMatch(/^3 · A/);
  await slot(page, 1).dragTo(slot(page, 40));
  await expect(slot(page, 1)).not.toHaveClass(/filled/);
  await expect.poll(() => slotTip(page, 40)).toMatch(/^41 · B/);
  expect(await takeSent(page)).toEqual(HW ? null : []); // the active patch never changed
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(slot(page, 0)).toHaveClass(/active/);
  await expect.poll(() => slotTip(page, 1)).toMatch(/^2 · B/);
  await expect(page.locator(".slotgrid .slot.modified")).toHaveCount(0);
});

// Drag with the platform's copy key held (Option on the Mac, Ctrl elsewhere).
async function copyDrag(page: Tb3App["page"], from: ReturnType<typeof slot>, to: ReturnType<typeof slot>) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  const mod = process.platform === "darwin" ? "Alt" : "Control";
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.keyboard.down(mod);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up(mod);
}

test("Option-dragging a slot copies it, asking before replacing a filled slot", async () => {
  const { page } = t;
  await copyDrag(page, slot(page, 1), slot(page, 20));
  await expect.poll(() => slotTip(page, 20)).toMatch(/^21 · B/);
  await expect.poll(() => slotTip(page, 1)).toMatch(/^2 · B/);
  await copyDrag(page, slot(page, 1), slot(page, 2));
  const dialog = page.locator(".dialog");
  await expect(dialog).toContainText("Replace slot 3?");
  await dialog.getByRole("button", { name: "REPLACE" }).click();
  await expect.poll(() => slotTip(page, 2)).toMatch(/^3 · B/);
});

test("relaunching reopens the set and sends nothing", async () => {
  await slot(t.page, 0).click();
  await expectTb3(t.page, t.patches.a, "slot 1");
  t = running = await relaunch(t);
  await expect(t.page.locator(".slotgrid .slot.filled")).toHaveCount(3);
  await expect(slot(t.page, 0)).toHaveClass(/active/);
  await t.page.waitForTimeout(500);
  expect(await takeSent(t.page)).toEqual(HW ? null : []);
  // The fake restarts holding the base patch; the real TB-3 still holds slot 1.
  await expectTb3(t.page, HW ? t.patches.a : t.patches.base, "what it held before relaunching");
});
