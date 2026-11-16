// Mix scenes (docs/sp404-design.md › Pad mixer › Mix scenes) against the fake SP-404: store, change, recall, RECALL
// SAFE and DEL.
import { expect, test } from "@playwright/test";
import { control, finish, start, type Sp404App } from "./sp404";

let running: Sp404App | undefined;
test.afterEach(async () => finish(running));

const strip = (r: Sp404App, label: string) => r.page.locator(`.ws[data-pad="${label}"]`);
const level = (r: Sp404App, pad: number) => async () => (await control<{ level: number }>(r.page, "pad", pad)).level;

test("a scene stores the desk and recalls it onto the SP-404; RECALL SAFE and DEL work", async () => {
  const r = (running = await start());
  const scene = r.page.getByRole("button", { name: "Mix scene 1", exact: true });
  await scene.click();
  await expect(scene).toHaveClass(/stored/);
  await expect(scene).toHaveClass(/\bon\b/);

  await strip(r, "A1").getByRole("button", { name: "Mute A1" }).click();
  await expect.poll(level(r, 0)).toBe(0);
  await expect(scene).not.toHaveClass(/\bon\b/);
  await scene.click();
  await expect.poll(level(r, 0)).toBe(110);
  await expect(strip(r, "A1").locator(".lv")).toHaveText("110");

  await strip(r, "A1").getByRole("button", { name: "Mute A1" }).click();
  await r.page.getByRole("group", { name: "Recall safe" }).getByRole("button", { name: "MUTE", exact: true }).click();
  await scene.click();
  await expect(strip(r, "A1").locator(".lv")).toHaveText("(110)"); // MUTE is safe: still muted
  expect(await level(r, 0)()).toBe(0);

  await r.page.getByRole("button", { name: "DEL", exact: true }).click();
  await scene.click();
  await expect(scene).not.toHaveClass(/stored/);
});
