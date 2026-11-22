// Set up from the rig file (docs/x32-spec.md), against a fake desk as it came from the factory: check lists the
// differences and writes nothing; apply backs up to a scene, writes, reads back and saves "Studio base"; a second check
// finds nothing; the backup restores the desk; drift shows up (addendum tests 11-15).
import { expect, test, type Page } from "@playwright/test";
import { config, strip } from "../src/core/addresses";
import { factoryDesk } from "./factory";
import { finish, start, status, type X32App } from "./x32";

let running: X32App | undefined;
test.afterEach(async () => finish(running));

const panel = (page: Page) => page.locator(".setup");
const isWrite = (m: { address: string; args: unknown[] }) => m.args.length > 0 && m.address !== "/node";

async function checked(r: X32App) {
  await expect(status(r.page)).toHaveText("Connected", { timeout: 15_000 });
  await panel(r.page).getByRole("button", { name: "Check against rig file" }).click();
  await expect(panel(r.page).locator(".note").first()).toContainText(/settings differ|matches/, { timeout: 30_000 });
}

const area = (page: Page, name: string) => panel(page).locator(`details[data-area="${name}"]`);

test("checking lists the differences by area and writes nothing", async () => {
  const r = (running = await start({ values: factoryDesk() }));
  await checked(r);
  await expect(area(r.page, "routing").locator("summary")).toContainText("Input routing 34 changes");
  await area(r.page, "routing").locator("summary").click();
  await expect(area(r.page, "routing")).toContainText("ch 3 input ← aux in 5 (0 → 165)");
  await expect(area(r.page, "fx").locator("summary")).toContainText("FX feeds 6 changes");
  await expect(panel(r.page).locator(".manual")).toContainText("Mic: phantom power");
  expect(r.fake!.received.filter(isWrite)).toEqual([]);
});

test("applying backs up first, sets the desk to the rig file and saves Studio base", async () => {
  test.setTimeout(60_000);
  const r = (running = await start({ values: factoryDesk() }));
  await checked(r);
  await panel(r.page).getByRole("button", { name: /^Apply \d+ changes$/ }).click();
  await expect(panel(r.page).locator(".result")).toContainText("all read back. Before: scene 1. After: scene 2", { timeout: 30_000 });

  const writes = r.fake!.received.filter(isWrite);
  expect(writes[0]?.address).toBe("/save");
  expect(writes.at(-1)?.address).toBe("/save");
  expect(writes.some((m) => /headamp|\/mix\/fader|^\/main\//.test(m.address))).toBe(false);
  expect(r.fake!.get("/config/userrout/in/03")).toBe(165);
  expect(r.fake!.get("/ch/11/config/name")).toBe("P-6");
  expect(r.fake!.get("/-show/showfile/scene/002/name")).toBe("Studio base");

  await checked(r);
  await expect(panel(r.page).locator(".matches")).toContainText("The desk matches the rig file");
  const writesBefore = writes.length;
  expect(r.fake!.received.filter(isWrite)).toHaveLength(writesBefore);
});

test("applies only the areas left ticked", async () => {
  const r = (running = await start({ values: factoryDesk() }));
  await checked(r);
  for (const a of ["routing", "channels", "buses", "outputs", "card"]) await area(r.page, a).locator("input[type=checkbox]").uncheck();
  await panel(r.page).getByRole("button", { name: "Apply 6 changes" }).click();
  await expect(panel(r.page).locator(".result")).toContainText("Applied 6 changes", { timeout: 15_000 });
  const values = r.fake!.received.filter(isWrite).filter((m) => m.address !== "/save");
  expect(values.map((m) => m.address).every((a) => a.startsWith("/fx/"))).toBe(true);
});

test("the backup scene puts the desk back as it was", async () => {
  test.setTimeout(60_000);
  const r = (running = await start({ values: factoryDesk() }));
  await checked(r);
  const differences = await panel(r.page).locator(".note").first().textContent();
  await panel(r.page).getByRole("button", { name: /^Apply/ }).click();
  await expect(panel(r.page).locator(".result")).toBeVisible({ timeout: 30_000 });
  r.fake!.load(1);
  await checked(r);
  await expect(panel(r.page).locator(".note").first()).toHaveText(differences!);
});

test("a change made by hand shows up as drift", async () => {
  test.setTimeout(60_000);
  const r = (running = await start({ values: factoryDesk() }));
  await checked(r);
  await panel(r.page).getByRole("button", { name: /^Apply/ }).click();
  await expect(panel(r.page).locator(".result")).toBeVisible({ timeout: 30_000 });
  r.fake!.set(config(strip("ch", 1)).name, "Kick");
  await checked(r);
  await expect(panel(r.page).locator(".note").first()).toContainText("1 settings differ");
  await area(r.page, "channels").locator("summary").click();
  await expect(area(r.page, "channels")).toContainText('ch 1 named "Volca Kick" ("Kick" → "Volca Kick")');
});

test("stops and keeps Studio base unsaved when a value doesn't read back", async () => {
  test.setTimeout(60_000);
  const values = factoryDesk();
  values.delete("/fx/1/source/l");
  const r = (running = await start({ values }));
  await checked(r);
  for (const a of ["routing", "channels", "buses", "outputs", "card"]) await area(r.page, a).locator("input[type=checkbox]").uncheck();
  await panel(r.page).getByRole("button", { name: /^Apply/ }).click();
  await expect(panel(r.page).getByRole("alert")).toContainText("FX 1 left fed by bus 3 reads back as (no answer)", { timeout: 15_000 });
  expect(r.fake!.received.filter((m) => m.address === "/save")).toHaveLength(1);
});

test("waits for a desk that is slow to apply writes", async () => {
  test.setTimeout(90_000);
  const r = (running = await start({ values: factoryDesk(), writeDelayMs: 150 }));
  await checked(r);
  await panel(r.page).getByRole("button", { name: /^Apply \d+ changes$/ }).click();
  await expect(panel(r.page).locator(".result")).toContainText("all read back", { timeout: 60_000 });
  expect(r.fake!.get("/config/userrout/in/02")).toBe(2);
});
