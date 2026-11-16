// The settings window (docs/tb3-phase5-design.md): how it opens and closes, and that it remembers its tab.
import { expect, test } from "@playwright/test";
import { finish, start } from "./tb3";
import type { Tb3App } from "./tb3";

let running: Tb3App | undefined;
test.afterEach(async () => finish(running));

test("⌘, and the app menu open it on the tab used last; Esc closes it", async () => {
  running = undefined;
  const t = (running = await start());
  const { page } = t;
  const win = page.locator(".settingswin");
  await page.keyboard.press("ControlOrMeta+,");
  await expect(win.locator(".settings-tabs .sel")).toHaveText("MIDI");
  await win.locator(".settings-tabs").getByRole("button", { name: "LIBRARY", exact: true }).click();
  await expect(win).toContainText("LIBRARY FOLDER");
  await page.keyboard.press("Escape");
  await expect(win).toHaveCount(0);

  await t.app.evaluate(({ Menu }) => {
    const items = Menu.getApplicationMenu()!.items.flatMap((m) => m.submenu?.items ?? []);
    items.find((i) => i.label === "Settings…")!.click();
  });
  await expect(win.locator(".settings-tabs .sel")).toHaveText("LIBRARY");
  await win.getByRole("button", { name: "CLOSE", exact: true }).click();
  await expect(win).toHaveCount(0);

  await page.locator(".strip .tb3").getByRole("button", { name: "CC", exact: true }).click();
  await expect(win.locator(".settings-tabs .sel")).toHaveText("CC");
  await expect(win.locator(".cclist")).toContainText("VCF CUTOFF");
});
