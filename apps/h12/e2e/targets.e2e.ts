// Target switching against the fake H12: what is written, what is skipped, read-back, the preset guard, and putting
// the H12's previous settings back.
import { expect, test, type Page } from "@playwright/test";
import { fakeSetting, finish, settingWrites, start, type H12App } from "./h12";

let running: H12App | undefined;
test.afterEach(async () => finish(running));

// The H12 before the app ever wrote to it: the Launchkey routed everywhere, a manual mapper in slot 18.
const BEFORE = { "0:26": [0x3fffffff], "0:25": [1 << 24], "3:18": [1, 2, 3, 4, 5, 6] };

const target = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name} `) });

async function switchTo(page: Page, name: string) {
  await target(page, name).click();
  await expect(target(page, name)).toHaveAttribute("aria-pressed", "true");
}

test("switches to a target, writing only the allowed settings", async () => {
  const r = (running = await start({ settings: BEFORE }));
  await expect(r.page.getByText("don't match any target")).toBeVisible();
  await switchTo(r.page, "JV-2080");
  await expect(r.page.getByRole("status")).toHaveText("Switched to JV-2080: wrote 8 settings.");
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
  await switchTo(r.page, "SP-404 Mk2");
  await switchTo(r.page, "JV-2080");
  await r.page.getByRole("button", { name: "Put them back" }).click();
  await expect(r.page.getByRole("status")).toContainText("Put back the previous settings: wrote");
  expect(await fakeSetting(r.page, "0:26")).toEqual(BEFORE["0:26"]);
  expect(await fakeSetting(r.page, "3:18")).toEqual(BEFORE["3:18"]);
  expect(await fakeSetting(r.page, "3:23")).toEqual([0, 0, 0, 0, 0, 0]);
  await expect(r.page.getByText("don't match any target")).toBeVisible();
});
