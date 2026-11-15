// The envelopes' A, D, S and R values, inside the graph (ui/EnvelopeEditor.tsx), edit the patch and reach the TB-3.
import { expect, test } from "@playwright/test";
import { getRaw } from "../src/core/patch";
import { paramById } from "../src/core/params";
import { finish, readTb3, start } from "./tb3";
import type { Tb3App } from "./tb3";

let running: Tb3App | undefined;
test.afterEach(async () => finish(running));

test("scrolling the filter envelope's S value sets the TB-3's sustain", async () => {
  const { page } = (running = await start());
  await page.locator(".strip .tb3").getByRole("button", { name: "SYNC FROM TB-3" }).click();
  const tag = page.locator(".vcf .env").getByRole("slider", { name: "S", exact: true });
  await expect(tag).not.toHaveAttribute("aria-valuetext", "–");
  const before = Number(await tag.getAttribute("aria-valuenow"));
  const up = before < 100;
  await tag.hover();
  await page.mouse.wheel(0, up ? -40 : 40);
  const want = before + (up ? 1 : -1);
  await expect(tag).toHaveAttribute("aria-valuenow", String(want));
  await expect.poll(async () => getRaw(await readTb3(page), paramById("vcf_sustain"))).toBe(want);
});
