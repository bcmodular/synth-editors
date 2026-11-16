// The read-only check against the real H12MIDI Pro (npm run test:h12). It only sends status and setting reads: the
// H12's settings are never written. Prints what it found, for checking against docs/h12-spec.md.
import { expect, test } from "@playwright/test";
import { facts, finish, start, type H12App } from "./h12";

let running: H12App | undefined;
test.afterEach(async () => finish(running));

test("the H12 answers SysEx and runs firmware 4.7 or later", async () => {
  const r = (running = await start("real"));
  const f = await facts(r.page);
  const problems = await r.page.locator(".problems li").allInnerTexts();
  console.log({ ...f, problems });
  expect(f["SysEx port"]).toMatch(/H12MIDI/);
  expect(f.Firmware).toMatch(/^\d+\.\d+$/); // no "older than" warning
  expect(problems).toEqual([]);
});
