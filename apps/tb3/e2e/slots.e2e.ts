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

test("recalling a slot sends only the blocks that differ", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  const first = await takeSent(page);
  if (first) expect(blockKeys(first)).toEqual(allBlocks()); // what the TB-3 holds is unknown at first
  await slot(page, 1).click();
  await expectTb3(page, p.b, "slot 2");
  const second = await takeSent(page);
  if (second) expect(blockKeys(second)).toEqual(blockKeys(diffBlocks(p.a, p.b)));
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

test("GRAB plays a slot while held, then returns", async () => {
  const { page, patches: p } = t;
  await slot(page, 0).click();
  await expectTb3(page, p.a, "slot 1");
  await sideButton(page, "patches", "GRAB").click();
  await hold(page, slot(page, 2), () => expectTb3(page, p.c, "slot 3 while held"));
  await expectTb3(page, p.a, "slot 1 again after release");
  await expect(slot(page, 0)).toHaveClass(/active/);
});

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

test("relaunching reopens the set and sends nothing", async () => {
  await slot(t.page, 0).click();
  await expectTb3(t.page, t.patches.a, "slot 1");
  t = running = await relaunch(t);
  await expect(t.page.locator(".slots16 .slot.filled")).toHaveCount(3);
  await expect(slot(t.page, 0)).toHaveClass(/active/);
  await t.page.waitForTimeout(500);
  expect(await takeSent(t.page)).toEqual(HW ? null : []);
  // The fake restarts holding the base patch; the real TB-3 still holds slot 1.
  await expectTb3(t.page, HW ? t.patches.a : t.patches.base, "what it held before relaunching");
});
