// Target switching against the fake H12: what is written, what is skipped, read-back, the preset guard, and putting
// the H12's previous settings back.
import { expect, test, type Page } from "@playwright/test";
import { fakeSetting, finish, settingWrites, start, type H12App } from "./h12";

let running: H12App | undefined;
test.afterEach(async () => finish(running));

// The H12 before the app ever wrote to it: the Launchkey routed everywhere, a manual mapper in slot 18.
const BEFORE = { "0:26": [0x3fffffff], "0:25": [1 << 24], "3:18": [1, 2, 3, 0x5a000000, 5, 6] };

const target = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name} `) });

async function switchTo(page: Page, name: string) {
  await target(page, name).click();
  await expect(target(page, name)).toHaveAttribute("aria-pressed", "true");
}

test("switches to a target, writing only the allowed settings", async () => {
  const r = (running = await start({ settings: BEFORE }));
  await expect(r.page.getByText("don't match any target")).toBeVisible();
  await switchTo(r.page, "JV-2080");
  await expect(r.page.getByRole("status")).toHaveText("Switched to JV-2080 ch 6: wrote 8 settings.");
  expect(await settingWrites(r.page)).toEqual(["0:25", "0:26", "3:18", "3:19", "3:20", "3:21", "3:22", "3:23"]);
  expect(await fakeSetting(r.page, "0:26")).toEqual([1 << 1]);
  expect(await fakeSetting(r.page, "0:25")).toEqual([1 << 1]);
});

test("writes nothing when the target is already set", async () => {
  const r = (running = await start({ settings: BEFORE }));
  await switchTo(r.page, "TB-3");
  const writes = (await settingWrites(r.page)).length;
  await target(r.page, "TB-3").click();
  await expect(r.page.getByRole("status")).toHaveText("Already on TB-3: nothing written.");
  expect(await settingWrites(r.page)).toHaveLength(writes);
});

test("switching between targets on one output only rewrites the mappers", async () => {
  const r = (running = await start({ settings: BEFORE }));
  await switchTo(r.page, "TD-3-MO");
  const before = (await settingWrites(r.page)).length;
  await switchTo(r.page, "Volca Bass");
  expect((await settingWrites(r.page)).slice(before)).toEqual(["3:18", "3:19", "3:20", "3:21", "3:22"]);
  await expect(r.page.getByRole("status")).toHaveText("Switched to Volca Bass: wrote 5 settings, 2 already matched.");
});

test("refuses to write when the H12 isn't on preset 1", async () => {
  const r = (running = await start({ settings: BEFORE, preset: 1 }));
  await target(r.page, "TB-3").click();
  await expect(r.page.locator(".targets").getByRole("alert")).toContainText("switch it to preset 1 first");
  expect(await settingWrites(r.page)).toEqual([]);
});

test("stops at an error from the H12 and says so", async () => {
  const r = (running = await start({ settings: BEFORE, failWrite: "3:19" }));
  await target(r.page, "TB-3").click();
  const alert = r.page.locator(".targets").getByRole("alert");
  await expect(alert).toContainText("Stopped switching to TB-3 (wrote 3 settings)");
  await expect(alert).toContainText("Writing Mapper 19 (Launchkey Note Off): the H12 answered error 0x7C");
  expect(await settingWrites(r.page)).toEqual(["0:25", "0:26", "3:18", "3:19"]);
});

test("puts the H12's previous settings back", async () => {
  const r = (running = await start({ settings: BEFORE }));
  await switchTo(r.page, "SP-404 chromatic");
  await switchTo(r.page, "JV-2080");
  await r.page.getByRole("button", { name: "Put them back" }).click();
  await expect(r.page.getByRole("status")).toContainText("Put back the previous settings: wrote");
  expect(await fakeSetting(r.page, "0:26")).toEqual(BEFORE["0:26"]);
  expect(await fakeSetting(r.page, "3:18")).toEqual(BEFORE["3:18"]);
  expect(await fakeSetting(r.page, "3:23")).toEqual([0x7f007f00, 0x7f007f00, 0x00f00f0f, 0x5a000187, 0, 0]); // factory
  await expect(r.page.getByText("don't match any target")).toBeVisible();
});

test("plays the JV-2080 on a chosen channel", async () => {
  const r = (running = await start({ settings: BEFORE }));
  await r.page.getByRole("button", { name: "Channel 8 for JV-2080" }).click();
  await expect(r.page.getByRole("button", { name: "Channel 8 for JV-2080" })).toHaveAttribute("aria-pressed", "true");
  await expect(r.page.getByText("play JV-2080 on channel 8")).toBeVisible();
  expect(((await fakeSetting(r.page, "3:18"))![2]! >>> 24) & 0x0f).toBe(7);
  await r.page.getByRole("button", { name: "Channel 9 for JV-2080" }).click();
  await expect(r.page.getByRole("status")).toHaveText("Switched to JV-2080 ch 9: wrote 6 settings, 2 already matched.");
});

test("won't switch on firmware 5.0, which stores mappers differently", async () => {
  const r = (running = await start({ settings: BEFORE, firmware: 0x50 }));
  await target(r.page, "TB-3").click();
  await expect(r.page.locator(".targets").getByRole("alert")).toContainText("Firmware 5.0 stores mappers differently");
  expect(await settingWrites(r.page)).toEqual([]);
});

test("warns about mappers without the init byte until a switch rewrites them", async () => {
  const flag5 = [0x7f007f00, 0x7f007f00, 0x01000000, 0x05000006, 0, 1 << 26];
  const r = (running = await start({ settings: { ...BEFORE, "3:18": flag5, "3:19": flag5 } }));
  const warning = r.page.locator(".targets").getByRole("alert");
  await expect(warning).toContainText("Mapper 18 (Launchkey Note On), Mapper 19 (Launchkey Note Off) lack");
  await switchTo(r.page, "TB-3");
  await expect(warning).toHaveCount(0);
});
