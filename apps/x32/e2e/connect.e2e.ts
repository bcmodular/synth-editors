// Phase 0 (docs/x32-spec.md): the app finds the fake desk, notices when it goes away and comes back, and never reaches
// anything but this machine in tests. Reading the desk and the rig are in rig.e2e.ts.
import { expect, test } from "@playwright/test";
import { facts, finish, start, status, type X32App } from "./x32";

let running: X32App | undefined;
test.afterEach(async () => finish(running));

test("connects and shows what the desk is", async () => {
  const r = (running = await start());
  await expect(status(r.page)).toHaveText("Connected");
  expect(await facts(r.page)).toMatchObject({ Address: r.fake!.host, Desk: "X32RACK", Firmware: "4.06" });
  await expect(r.page.locator(".problems")).toHaveCount(0);
  expect(r.fake!.sent("/xremote").length).toBeGreaterThan(0);
});

test("warns about another model or firmware", async () => {
  const r = (running = await start({ model: "X32", firmware: "3.08" }));
  await expect(r.page.locator(".problems")).toContainText("not an X32 Rack");
  await expect(r.page.locator(".problems")).toContainText("Firmware 3.08");
});

test("says when the desk is unreachable, and reconnects", async () => {
  test.setTimeout(40_000);
  const r = (running = await start());
  await expect(status(r.page)).toHaveText("Connected");
  r.fake!.offline = true;
  await expect(status(r.page)).toHaveText("Desk not reachable", { timeout: 12_000 });
  r.fake!.offline = false;
  await expect(status(r.page)).toHaveText("Connected", { timeout: 12_000 });
});

test("won't talk to a desk on the network during tests", async () => {
  const r = (running = await start());
  await r.page.getByLabel("Desk address").fill("192.168.1.50");
  await r.page.getByRole("button", { name: "Connect" }).click();
  await expect(r.page.getByText("isn't an address the app can use")).toBeVisible();
  expect((await facts(r.page)).Address).toBe(r.fake!.host);
});
