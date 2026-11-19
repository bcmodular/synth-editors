// Against the real X32 Rack (npm run test:x32 with X32_HOST set; add X32_CAPTURE=1 to keep the traffic). Read-only:
// it only sends /xremote and /info.
import { expect, test } from "@playwright/test";
import { facts, finish, start, status, type X32App } from "./x32";

let running: X32App | undefined;
test.afterEach(async () => finish(running));

test("the desk answers and is an X32 Rack on firmware 4.x", async () => {
  const r = (running = await start("real"));
  await expect(status(r.page)).toHaveText("Connected");
  const f = await facts(r.page);
  console.log(`Desk: ${f.Desk}, firmware ${f.Firmware}`);
  await expect(r.page.locator(".problems")).toHaveCount(0);
});
