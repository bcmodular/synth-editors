// The read-only dump against the fake H12: it reads every setting, writes none, and shows the rule check.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { finish, sent, settingWrites, start, type H12App } from "./h12";

let running: H12App | undefined;
test.afterEach(async () => finish(running));

test("reads the whole preset without writing, and checks the rules", async () => {
  const r = (running = await start({ settings: { "0:24": [1], "1:33": [0xdfff], "1:30": [0x3000] } }));
  const panel = r.page.locator(".panel.dump");
  await panel.getByRole("button", { name: "Read all" }).click();
  await expect(panel.getByRole("button", { name: "Save JSON" })).toBeEnabled({ timeout: 15_000 });
  await expect(panel.locator(".rules li")).toHaveCount(3);
  await expect(panel.locator(".rules li").nth(0)).toContainText("✓ Clock comes only from MIDI In 1");
  await expect(panel.locator(".rules li").nth(1)).toContainText("Not blocked on: JV-2080");
  await expect(panel.locator(".rules li").nth(2)).toContainText("✓ Only channel 14 reaches the OXI");
  expect(await settingWrites(r.page)).toEqual([]);
  const reads = (await sent(r.page)).filter((m) => m.data[6] === 0x02);
  expect(reads.length).toBeGreaterThanOrEqual(174);

  await panel.getByRole("button", { name: "Save JSON" }).click();
  const dir = path.join(r.profile, "downloads");
  // Read once the file is complete: it appears before the download has finished writing it.
  const read = async () => {
    const [name] = await readdir(dir);
    try { return JSON.parse(await readFile(path.join(dir, name!), "utf8")) as { routing: string[]; channelFilters: string[] }; }
    catch { return undefined; }
  };
  await expect.poll(read).toBeDefined();
  const saved = (await read())!;
  expect(saved.routing[24]).toBe("00000001");
  expect(saved.channelFilters[33]).toBe("DFFF");
});
