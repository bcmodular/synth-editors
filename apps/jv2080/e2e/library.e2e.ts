// The sidebar against the fake JV: sets and slots, auditions, patch files, the session kept across a relaunch, and
// library file steps in the undo history.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { patchFromBytes, setFromJson } from "../src/core/patchSet";
import { expectJv, finish, hold, openTestSet, PATCHES, patchTitle, readJv, relaunch, slot, start, type JvApp } from "./jv";

let t: JvApp;
let running: JvApp | undefined;
test.beforeEach(async () => {
  running = undefined;
  t = running = await start();
  await expect(patchTitle(t.page)).toHaveText("ON THE JV");
});
test.afterEach(async () => finish(running));

const row = (page: Page, kind: string, name: string) =>
  page.locator(`.librow.${kind}`).filter({ has: page.locator(".name", { hasText: new RegExp(`^${name}$`) }) });
const onDisk = (rel: string) => expect.poll(() => existsSync(path.join(t.library, rel)));

async function answer(page: Page, text: string) {
  await page.locator(".dialog input").fill(text);
  await page.locator(".dialog input").press("Enter");
  await expect(page.locator(".dialog")).toHaveCount(0);
}

test("opening a set and recalling slots sends each patch to the JV", async () => {
  const { page } = t;
  await openTestSet(page);
  await slot(page, 1).click();
  await expect(patchTitle(page)).toHaveText("SLOT B");
  await expect(page.locator(".patchname .where")).toHaveText("SLOT 2");
  await expectJv(page, PATCHES.b, "slot 2");
  await slot(page, 2).click();
  await expectJv(page, PATCHES.c, "slot 3");
});

test("holding ▶ auditions a file on the JV, and releasing puts the patch back", async () => {
  const { page } = t;
  await hold(page, row(page, "patch", "Audition").locator(".play"), async () => {
    await expectJv(page, PATCHES.file, "the auditioned file");
    await expect(patchTitle(page)).toHaveText("FROM A FILE");
  });
  await expectJv(page, PATCHES.jv, "the patch from before the audition");
  await expect(patchTitle(page)).toHaveText("ON THE JV");
});

test("GRAB, then holding a slot, auditions it; the editor shows it read only", async () => {
  const { page } = t;
  await openTestSet(page);
  await page.locator(".side .patches").getByRole("button", { name: "GRAB" }).click();
  await hold(page, slot(page, 2), async () => {
    await expectJv(page, PATCHES.c, "the grabbed slot");
    await expect(patchTitle(page)).toHaveText("SLOT C");
    await expect(page.locator("main.app")).toHaveClass(/auditioning/);
  });
  await expectJv(page, PATCHES.jv, "the patch from before");
  await page.keyboard.press("Escape");
  await expect(page.locator(".slotgrid")).not.toHaveClass(/grab/);
});

test("double-clicking a file loads it, and undo goes back", async () => {
  const { page } = t;
  await row(page, "patch", "Audition").dblclick();
  await expectJv(page, PATCHES.file, "the loaded file");
  await page.keyboard.press("ControlOrMeta+z");
  await expectJv(page, PATCHES.jv, "the patch from before");
});

test("STORE into a slot, then SAVE AS… writes the set", async () => {
  const { page } = t;
  await slot(page, 4).click(); // empty: stores the patch in the editor
  await expect(page.locator(".patchname .where")).toHaveText("SLOT 5");
  await page.locator(".side .patches").getByRole("button", { name: "SAVE AS…" }).click();
  await answer(page, "Mine");
  await onDisk("Mine.jvset").toBe(true);
  const slots = setFromJson(await readFile(path.join(t.library, "Mine.jvset"), "utf8"));
  expect(slots[4]).toEqual({ name: "ON THE JV", patch: PATCHES.jv });
  await expect(page.locator(".setline .v")).toHaveText("Mine");
});

test("PATCH SAVE AS… writes the patch in the editor as a .syx", async () => {
  const { page } = t;
  await page.locator(".side .patch").getByRole("button", { name: "SAVE AS…" }).click();
  await answer(page, "Kept");
  await onDisk("Kept.syx").toBe(true);
  expect(patchFromBytes(await readFile(path.join(t.library, "Kept.syx")))).toEqual(PATCHES.jv);
});

test("the session survives a relaunch, and its patch goes to the JV", async () => {
  await openTestSet(t.page);
  await slot(t.page, 1).click();
  await expectJv(t.page, PATCHES.b, "slot 2");
  t = running = await relaunch(t); // the fake JV starts again on its own patch
  await expect(patchTitle(t.page)).toHaveText("SLOT B");
  await expect(t.page.locator(".slotgrid .slot.filled")).toHaveCount(3);
  await expectJv(t.page, PATCHES.b, "the patch the editor kept");
});

test("undo and redo a file rename", async () => {
  const { page } = t;
  await row(page, "patch", "Audition").click({ button: "right" });
  await page.locator(".ctxitem", { hasText: "Rename…" }).click();
  await answer(page, "Squelch");
  await onDisk("Squelch.syx").toBe(true);
  await page.keyboard.press("ControlOrMeta+z");
  await onDisk("Audition.syx").toBe(true);
  await onDisk("Squelch.syx").toBe(false);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await onDisk("Squelch.syx").toBe(true);
});

test("the JV isn't sent anything while nothing changes", async () => {
  const { page } = t;
  await page.waitForTimeout(300);
  const before = JSON.stringify(await readJv(page));
  await openTestSet(page); // opening a set keeps the editor on its patch
  await page.waitForTimeout(300);
  expect(JSON.stringify(await readJv(page))).toBe(before);
});
