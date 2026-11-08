// Library file actions and the undo history: renames, moves and new folders can be undone and
// redone; the files on disk follow.
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { finish, start } from "./tb3";
import type { Tb3App } from "./tb3";

let t: Tb3App;
let running: Tb3App | undefined;
test.beforeEach(async () => {
  running = undefined;
  t = running = await start();
});
test.afterEach(async () => finish(running));

const row = (page: Page, kind: string, name: string) =>
  page.locator(`.librow.${kind}`).filter({ has: page.locator(".name", { hasText: new RegExp(`^${name}$`) }) });
const onDisk = (rel: string) => expect.poll(() => existsSync(path.join(t.library, rel)));
const undoKey = (page: Page) => page.keyboard.press("ControlOrMeta+z");
const redoKey = (page: Page) => page.keyboard.press("ControlOrMeta+Shift+z");

async function answer(page: Page, text: string) {
  await page.locator(".dialog input").fill(text);
  await page.locator(".dialog input").press("Enter");
  await expect(page.locator(".dialog")).toHaveCount(0);
}

test("undo and redo a rename", async () => {
  const { page } = t;
  await row(page, "patch", "Audition").click({ button: "right" });
  await page.locator(".ctxitem", { hasText: "Rename…" }).click();
  await answer(page, "Squelch");
  await onDisk("Squelch.syx").toBe(true);
  await expect(row(page, "patch", "Squelch")).toHaveCount(1);
  await undoKey(page);
  await onDisk("Audition.syx").toBe(true);
  await onDisk("Squelch.syx").toBe(false);
  await expect(row(page, "patch", "Audition")).toHaveCount(1);
  await redoKey(page);
  await onDisk("Squelch.syx").toBe(true);
});

test("undo a move, then the new folder it went into, and redo both", async () => {
  const { page } = t;
  await page.getByRole("button", { name: "+ SUB-FOLDER" }).click();
  await answer(page, "Bin");
  await onDisk("Bin").toBe(true);
  await row(page, "patch", "Audition").dragTo(row(page, "dir", "Bin"));
  await onDisk("Bin/Audition.syx").toBe(true);
  await undoKey(page);
  await onDisk("Audition.syx").toBe(true);
  await undoKey(page);
  await onDisk("Bin").toBe(false);
  await redoKey(page);
  await onDisk("Bin").toBe(true);
  await redoKey(page);
  await onDisk("Bin/Audition.syx").toBe(true);
});

test("a file step that can't be undone is dropped with a message", async () => {
  const { page } = t;
  await page.getByRole("button", { name: "+ SUB-FOLDER" }).click();
  await answer(page, "Bin");
  await onDisk("Bin").toBe(true);
  await writeFile(path.join(t.library, "Bin", "From Finder.syx"), ""); // the folder isn't empty now
  const undo = page.locator(".strip .tb3").getByRole("button", { name: "UNDO", exact: true });
  await expect(undo).toHaveAttribute("title", "Undo New folder Bin (⌘Z)");
  await undoKey(page);
  await expect(page.locator(".toast")).toContainText("Couldn't undo New folder Bin");
  await onDisk("Bin/From Finder.syx").toBe(true);
  await expect(undo).toBeDisabled(); // the step is gone, not left to fail again
});
