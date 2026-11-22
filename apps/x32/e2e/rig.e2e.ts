// Phase 1 (docs/x32-spec.md): the app reads the whole desk on connect and shows the rig it works out, kept current by
// notifications (acceptance tests 7 and 10) and re-read after the desk comes back (test 8).
import { expect, test, type Page } from "@playwright/test";
import { config, send, strip } from "../src/core/addresses";
import { output } from "../src/core/routing";
import { defaultDesk } from "./rig";
import { finish, start, status, type X32App } from "./x32";

let running: X32App | undefined;
test.afterEach(async () => finish(running));

const row = (page: Page, table: string, name: string) =>
  page.locator(`.rig table.${table} tbody tr`).filter({ has: page.locator("td:first-child", { hasText: new RegExp(`^${name}$`) }) });

async function ready(r: X32App) {
  await expect(status(r.page)).toHaveText("Connected", { timeout: 15_000 });
}

test("reads the desk and shows the rig", async () => {
  const r = (running = await start());
  await ready(r);
  await expect(row(r.page, "sources", "TR-8S")).toContainText("ch 9-10");
  await expect(row(r.page, "sources", "TR-8S")).toContainText("P-6 0 dB");
  await expect(row(r.page, "destinations", "P-6")).toContainText("Aux out 1-2");
  await expect(row(r.page, "destinations", "P-6").locator("td").nth(3)).toHaveText("aux 1-2");
  await expect(row(r.page, "destinations", "Reverb")).toContainText("FX 1");
  await expect(row(r.page, "fx-slots", "FX 1")).toContainText("send effect, fed by Reverb");
  await expect(row(r.page, "fx-slots", "FX 4")).toContainText("free");
  await expect(r.page.locator(".rig .spare")).toHaveText("Spare channels: ch 15-32");
  await expect(r.page.locator(".oddities")).toHaveCount(0);
});

test("lists addresses the desk doesn't answer", async () => {
  const values = defaultDesk();
  values.delete("/fx/3/type");
  const r = (running = await start({ values }));
  await ready(r);
  await expect(r.page.locator(".missing summary")).toHaveText("1 addresses didn't answer");
  await r.page.locator(".missing summary").click();
  await expect(r.page.locator(".missing p")).toHaveText("/fx/3/type");
});

test("reads the whole desk with nothing missing", async () => {
  const r = (running = await start());
  await ready(r);
  await expect(r.page.locator(".missing")).toHaveCount(0);
});

test("a send changed on the desk shows up without a re-read (acceptance 7)", async () => {
  const r = (running = await start());
  await ready(r);
  const sendReads = () => r.fake!.received.filter((x) => x.args.length === 0 && x.address.includes("/mix/")).length;
  const before = sendReads();
  const m = send(strip("auxin", 3), 11);
  r.fake!.setAll([[m.on, 1], [m.level, 0.5]]);
  await expect(row(r.page, "sources", "S-1")).toContainText("P-6 -10 dB");
  expect(sendReads()).toBe(before);
});

test("a rename on the desk changes the rig without a restart (acceptance 10)", async () => {
  const r = (running = await start());
  await ready(r);
  r.fake!.setAll([[config(strip("bus", 11)).name, "P-6 Mix"], [config(strip("bus", 12)).name, "P-6 Mix"]]);
  await expect(row(r.page, "destinations", "P-6 Mix")).toBeVisible();
  await expect(row(r.page, "sources", "TR-8S")).toContainText("P-6 Mix 0 dB");
  r.fake!.setAll([1, 2].map((n) => [output({ kind: "aux", n }), 0]));
  await expect(r.page.locator(".oddities")).toContainText('bus 11-12 "P-6 Mix" has no channel with the same name, feeds no effect and goes to no output');
});

test("re-reads the desk when it comes back, catching changes made meanwhile (acceptance 8)", async () => {
  test.setTimeout(60_000);
  const r = (running = await start());
  await ready(r);
  r.fake!.offline = true;
  await expect(status(r.page)).toHaveText("Desk not reachable", { timeout: 12_000 });
  r.fake!.set(config(strip("ch", 13)).name, "Vocal"); // missed: the network is down
  r.fake!.offline = false;
  await ready(r);
  await expect(row(r.page, "sources", "Vocal")).toContainText("ch 13");
});
