// The MIDI monitor and the copy to the Mac, against the fake H12.
import { expect, test } from "@playwright/test";
import { fakeSetting, finish, playH12, playLaunchkey, settingWrites, start, type H12App } from "./h12";

let running: H12App | undefined;
test.afterEach(async () => finish(running));

const rows = (app: H12App) => app.page.locator(".monitor tbody tr");

// The monitor is listening once every source shows as connected.
async function listening(app: H12App) {
  const sources = app.page.locator(".monitor .note").first();
  await expect(sources).toContainText("Launchkey");
  await expect(sources).not.toContainText("not connected");
}

test("logs what the Launchkey plays and what the H12 sends the Mac, newest first", async () => {
  const r = (running = await start());
  await listening(r);
  await playLaunchkey(r.page, 0x90, 60, 100);
  await playH12(r.page, 8, 0x91, 60, 100);
  await expect(rows(r)).toHaveCount(2);
  await expect(rows(r).nth(0)).toContainText("H12 → Mac");
  await expect(rows(r).nth(0)).toContainText("Note On C3 (60) vel 100");
  await expect(rows(r).nth(0).locator("td").nth(2)).toHaveText("2");
  await expect(rows(r).nth(1)).toContainText("Launchkey");
  await expect(rows(r).nth(1).locator("td").nth(2)).toHaveText("1");
});

test("leaves clock and active sensing out, pauses and clears", async () => {
  const r = (running = await start());
  await listening(r);
  await playLaunchkey(r.page, 0xf8);
  await playLaunchkey(r.page, 0xfe);
  await playLaunchkey(r.page, 0xb0, 1, 64);
  await expect(rows(r)).toHaveCount(1);
  await r.page.getByRole("button", { name: "Pause" }).click();
  await playLaunchkey(r.page, 0xb0, 1, 65);
  await r.page.waitForTimeout(300);
  await expect(rows(r)).toHaveCount(1);
  await r.page.getByRole("button", { name: "Clear" }).click();
  await expect(rows(r)).toHaveCount(0);
});

test("the copy to the Mac adds cable 8 to the routing, and switching keeps it", async () => {
  const r = (running = await start());
  await r.page.getByRole("button", { name: /^TB-3 / }).click();
  await expect(r.page.getByRole("button", { name: /^TB-3 / })).toHaveAttribute("aria-pressed", "true");
  const copy = r.page.getByLabel(/Copy to the Mac/);
  await copy.click(); // ticked once the H12 has been written and read back
  await expect(copy).toBeChecked();
  await expect(r.page.getByRole("status")).toHaveText("Turned the copy to the Mac on: wrote 2 settings, 6 already matched.");
  expect(await fakeSetting(r.page, "0:26")).toEqual([(1 | (1 << 23)) >>> 0]);
  expect(await fakeSetting(r.page, "0:25")).toEqual([(1 | (1 << 23)) >>> 0]); // the pedal follows the keys
  await r.page.getByRole("button", { name: /^S-1 / }).click();
  await expect(r.page.getByRole("button", { name: /^S-1 / })).toHaveAttribute("aria-pressed", "true");
  await expect(copy).toBeChecked();
  expect(await fakeSetting(r.page, "0:26")).toEqual([((1 << 26) | (1 << 23)) >>> 0]);
  await copy.click();
  await expect(copy).not.toBeChecked();
  expect(await fakeSetting(r.page, "0:26")).toEqual([1 << 26]);
  expect((await settingWrites(r.page)).every((k) => ["0:25", "0:26"].includes(k) || k.startsWith("3:"))).toBe(true);
});

test("logs each target switch in the same timeline", async () => {
  const r = (running = await start());
  await listening(r);
  await r.page.getByRole("button", { name: /^TD-3-MO / }).click();
  await expect(rows(r).first()).toContainText("App");
  await expect(rows(r).first()).toContainText("Switched to TD-3-MO: wrote");
});
