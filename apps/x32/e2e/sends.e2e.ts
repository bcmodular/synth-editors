// Phase 3 (docs/x32-spec.md): sends without chat, from the Sends panel, against a fake desk set up from the rig file.
import { expect, test, type Page } from "@playwright/test";
import { studioDesk } from "./studio";
import { finish, start, status, type X32App } from "./x32";

let running: X32App | undefined;
test.afterEach(async () => finish(running));

const panel = (page: Page) => page.locator(".panel.sends");
const outcome = (page: Page) => panel(page).locator(".outcome");

async function ready(): Promise<X32App> {
  const r = (running = await start({ values: studioDesk() }));
  await expect(status(r.page)).toHaveText("Connected");
  await expect(r.page.locator(".rig table.sources")).toContainText("S-1");
  return r;
}

async function pick(page: Page, from: string, to: string, db = "0") {
  await panel(page).getByLabel("From").selectOption(from);
  await panel(page).getByLabel("To").selectOption(to);
  await panel(page).getByLabel("Level").fill(db);
}

test("a send that adds is applied straight away, read back, and undone", async () => {
  const r = await ready();
  await pick(r.page, "S-1", "Delay", "-6");
  await panel(r.page).getByRole("button", { name: "Send", exact: true }).click();
  await expect(outcome(r.page)).toContainText("Done: Send S-1 to Delay at -6 dB");
  expect(r.fake!.get("/ch/09/mix/03/level")).toBeCloseTo(0.6, 2);
  await expect(r.page.locator(".rig table.sources")).toContainText("Delay -6 dB");

  await panel(r.page).getByRole("button", { name: "Undo" }).click();
  await expect(outcome(r.page)).toContainText("Done: Undo: Send S-1 to Delay");
  expect(r.fake!.get("/ch/09/mix/03/level")).toBe(0);
});

test("switching the Sampler to the P-6 asks first (acceptance 1)", async () => {
  const r = await ready();
  await pick(r.page, "S-1", "P-6");
  await panel(r.page).getByRole("button", { name: "Send", exact: true }).click();
  const pending = panel(r.page).getByRole("alertdialog");
  await expect(pending).toContainText("switch the Sampler to the P-6");
  expect(r.fake!.get("/outputs/aux/01/src")).toBe(0);
  await pending.getByRole("button", { name: "Apply" }).click();
  await expect(outcome(r.page)).toContainText("Done:");
  expect(r.fake!.get("/outputs/aux/01/src")).toBe(14);
  expect(r.fake!.get("/outputs/main/01/src")).toBe(0);
});

test("send only this switches the others off after asking (acceptance 2)", async () => {
  const r = await ready();
  await pick(r.page, "TR-8S", "Sampler");
  await panel(r.page).getByRole("button", { name: "Send", exact: true }).click();
  await expect(outcome(r.page)).toContainText("Done:");
  await pick(r.page, "S-1", "Sampler");
  await panel(r.page).getByRole("button", { name: "Send only this" }).click();
  await expect(panel(r.page).getByRole("alertdialog")).toContainText("stop sending TR-8S to it");
  await panel(r.page).getByRole("button", { name: "Cancel" }).click();
  expect(r.fake!.get("/ch/05/mix/11/on")).toBe(1);
  await panel(r.page).getByRole("button", { name: "Send only this" }).click();
  await panel(r.page).getByRole("button", { name: "Apply" }).click();
  await expect(outcome(r.page)).toContainText("Done:");
  expect(r.fake!.get("/ch/05/mix/11/on")).toBe(0);
  expect(r.fake!.get("/ch/09/mix/11/level")).toBeCloseTo(0.75, 2);
});

test("a device's return to its own feed is refused (acceptance 4)", async () => {
  const r = await ready();
  await pick(r.page, "King Rat", "King Rat");
  await panel(r.page).getByRole("button", { name: "Send", exact: true }).click();
  await expect(outcome(r.page)).toContainText("Refused: King Rat (ch 4) would be sent to its own feed");
  expect(r.fake!.received.filter((m) => m.args.length && m.address.includes("/mix/09/"))).toEqual([]);
});
