// Against the real X32 Rack (npm run test:x32 with X32_HOST set). Read-only: the app sends /xremote, /info and reads
// with no arguments. With X32_CAPTURE set to a folder, the traffic is kept there, for checking the fake against it.
import { expect, test } from "@playwright/test";
import { facts, finish, start, status, type X32App } from "./x32";

let running: X32App | undefined;
test.afterEach(async () => finish(running));

test("the desk answers and is an X32 Rack on firmware 4.x", async () => {
  const r = (running = await start("real"));
  await expect(r.page.locator(".desk .facts dt", { hasText: "Firmware" })).toBeVisible();
  const f = await facts(r.page);
  console.log(`Desk: ${f.Desk}, firmware ${f.Firmware}`);
  await expect(r.page.locator(".problems")).toHaveCount(0);
});

test("reads every address the app uses", async () => {
  test.setTimeout(120_000);
  const r = (running = await start("real"));
  await expect.poll(async () => Number((await facts(r.page))["Values known"]), { timeout: 90_000 }).toBeGreaterThan(2000);
  await expect(status(r.page)).toHaveText("Connected", { timeout: 90_000 });
  const f = await facts(r.page);
  const missing = (await r.page.locator(".missing p").count()) ? await r.page.locator(".missing p").textContent() : "";
  console.log(`Values known: ${f["Values known"]}; didn't answer: ${missing || "none"}`);
  const oddities = await r.page.locator(".oddities li").allInnerTexts();
  console.log(`Oddities:\n${oddities.join("\n") || "none"}`);
});
