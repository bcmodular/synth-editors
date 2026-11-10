// The pad mixer against the fake SP-404: what it shows from the device, and what it sends back.
import { expect, test } from "@playwright/test";
import { control, finish, playMidi, start, writes, type Sp404App } from "./sp404";

let running: Sp404App | undefined;
test.afterEach(async () => finish(running));

const strip = (r: Sp404App, label: string) => r.page.locator(`.ws[data-pad="${label}"]`);

test("shows the loaded pads of the first two banks, with the device's values", async () => {
  const r = (running = await start());
  await expect(r.page.locator(".mx-left .project")).toHaveText("06 · LIVE SET");
  await expect(r.page.locator(".wbank")).toHaveCount(2);
  await expect(r.page.locator(".ws[data-pad]")).toHaveCount(4); // A1, A2, A5, B2
  await expect(strip(r, "A1").locator(".nm1")).toHaveText("KICK 1");
  await expect(strip(r, "A1").locator(".lv")).toHaveText("110");
  await expect(strip(r, "A2").locator(".pv")).toHaveText("L24");
  await expect(strip(r, "A2").getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(strip(r, "A5").getByLabel("A5 mute group")).toHaveValue("1");
  await expect(r.page.getByRole("slider", { name: "BANK B volume" })).toHaveAttribute("aria-valuenow", "100");
});

test("SHOW BANKS adds a bank and greys out banks with no samples", async () => {
  const r = (running = await start());
  const show = r.page.locator(".showbanks");
  await expect(show.getByRole("button", { name: "D" })).toBeDisabled();
  await show.getByRole("button", { name: "C" }).click();
  await expect(strip(r, "C9").locator(".nm1")).toHaveText("VOX");
});

test("dragging a fader sends the level, coalesced, ending on the value shown", async () => {
  const r = (running = await start());
  const fader = r.page.getByRole("slider", { name: "A1 level" });
  const box = (await fader.boundingBox())!;
  await r.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await r.page.mouse.down();
  await r.page.mouse.move(box.x + box.width / 2, box.y + box.height, { steps: 12 });
  await r.page.mouse.up();
  const shown = Number(await fader.getAttribute("aria-valuenow"));
  expect(shown).toBeLessThan(110);
  await expect.poll(async () => (await writes(r.page)).filter((w) => w.id === 0x69 && w.target === 0).at(-1)?.value)
    .toBe(shown);
  expect(await control<{ level: number }>(r.page, "pad", 0)).toMatchObject({ level: shown });
});

test("MUTE sends level 0 and shows the remembered level; a second press restores it", async () => {
  const r = (running = await start());
  const mute = strip(r, "A1").getByRole("button", { name: "Mute A1" });
  await mute.click();
  await expect(strip(r, "A1").locator(".lv")).toHaveText("(110)");
  await expect.poll(async () => (await control<{ level: number }>(r.page, "pad", 0)).level).toBe(0);
  await mute.click();
  await expect(strip(r, "A1").locator(".lv")).toHaveText("110");
  await expect.poll(async () => (await control<{ level: number }>(r.page, "pad", 0)).level).toBe(110);
});

test("SOLO silences every other pad, across banks; releasing it restores them", async () => {
  const r = (running = await start());
  const level = (pad: number) => async () => (await control<{ level: number }>(r.page, "pad", pad)).level;
  await strip(r, "A1").getByRole("button", { name: "Solo A1" }).click();
  await expect.poll(level(1)).toBe(0); // A2
  await expect.poll(level(17)).toBe(0); // B2
  expect(await level(0)()).toBe(110);
  await expect(strip(r, "B2").locator(".lv")).toHaveText("(90)");
  await strip(r, "A1").getByRole("button", { name: "Solo A1" }).click();
  await expect.poll(level(17)).toBe(90);
  await expect(strip(r, "B2").locator(".lv")).toHaveText("90");
});

test("bank SOLO silences the other banks; releasing it restores them", async () => {
  const r = (running = await start());
  const solo = r.page.getByRole("button", { name: "Solo BANK B" });
  await solo.click();
  await expect.poll(() => control<number>(r.page, "bankVolume", 0)).toBe(0);
  expect(await control<number>(r.page, "bankVolume", 1)).toBe(100);
  await solo.click();
  await expect.poll(() => control<number>(r.page, "bankVolume", 0)).toBe(127);
});

test("routing, mute group and bank volume go to the device", async () => {
  const r = (running = await start());
  await strip(r, "A1").getByRole("button", { name: "DRY" }).click();
  await strip(r, "A1").getByLabel("A1 mute group").selectOption("3");
  await expect.poll(async () => control<{ routing: number; muteGroup: number }>(r.page, "pad", 0))
    .toMatchObject({ routing: 0, muteGroup: 3 });
  await r.page.getByRole("slider", { name: "BANK A volume" }).dblclick(); // double-click resets to 127
  const volume = r.page.getByRole("slider", { name: "BANK B volume" });
  await volume.hover();
  await r.page.mouse.wheel(0, 40); // one step down
  await expect.poll(() => control<number>(r.page, "bankVolume", 1)).toBe(99);
});

test("lights the sounding pad and shades the selected one", async () => {
  const r = (running = await start());
  await control(r.page, "select", 0, 1, 0x3000);
  await expect(strip(r, "A2")).toHaveClass(/sel/);
  await expect(strip(r, "A2")).toHaveClass(/play/);
  await control(r.page, "select", 0, 1);
  await expect(strip(r, "A2")).not.toHaveClass(/play/);
  await expect(strip(r, "A2")).toHaveClass(/sel/);
});

test("bank MUTE sends volume 0 and shows the remembered volume; a second press restores it", async () => {
  const r = (running = await start());
  const master = r.page.locator('.ws[data-bank-master="B"]');
  await master.getByRole("button", { name: "Mute BANK B" }).click();
  await expect(master.locator(".lv")).toHaveText("(100)");
  await expect.poll(() => control<number>(r.page, "bankVolume", 1)).toBe(0);
  await master.getByRole("button", { name: "Mute BANK B" }).click();
  await expect(master.locator(".lv")).toHaveText("100");
  await expect.poll(() => control<number>(r.page, "bankVolume", 1)).toBe(100);
});

test("flashes each pad's number from the SP-404's MIDI notes, several at once", async () => {
  const r = (running = await start());
  await expect(r.page.locator(".bar")).toContainText("MIDI ● SP-404");
  await playMidi(r.page, 0x90, 24, 100); // Mode B, channel 1: note 24 = A1
  await playMidi(r.page, 0x90, 25, 90); // A2
  await expect(strip(r, "A1").locator(".wpad")).toHaveClass(/flash/);
  await expect(strip(r, "A2").locator(".wpad")).toHaveClass(/flash/);
  await expect(strip(r, "A5").locator(".wpad")).not.toHaveClass(/flash/);
  await playMidi(r.page, 0x80, 24, 0); // A1 off: still lit until its half-second sample ends
  await expect(strip(r, "A1").locator(".wpad")).toHaveClass(/lit/);
  await expect(strip(r, "A1").locator(".wpad")).not.toHaveClass(/lit/, { timeout: 2000 });
  await playMidi(r.page, 0x90, 29, 0); // velocity 0 is not a hit
  await expect(strip(r, "B2").locator(".wpad")).not.toHaveClass(/flash/);
});

test("a pad held past the end of its sample stays lit until its note-off", async () => {
  const r = (running = await start());
  await expect(r.page.locator(".bar")).toContainText("MIDI ● SP-404");
  await playMidi(r.page, 0x90, 25, 100); // A2 on; its sample is half a second
  await r.page.waitForTimeout(1000);
  await expect(strip(r, "A2").locator(".wpad")).toHaveClass(/lit/);
  await playMidi(r.page, 0x80, 25, 0);
  await expect(strip(r, "A2").locator(".wpad")).not.toHaveClass(/lit/);
});

test("without the SP-404's MIDI, flashes the pad the status poll saw hit", async () => {
  const r = (running = await start(undefined, { midiInput: false }));
  await expect(r.page.locator(".bar")).toContainText("NO PAD NOTES IN");
  await control(r.page, "select", 0, 4); // A5 hit: lit for its sample's length, then dark
  await expect(strip(r, "A5").locator(".wpad")).toHaveClass(/flash/);
  await expect(strip(r, "A5").locator(".wpad")).not.toHaveClass(/lit/, { timeout: 2000 });
  await control(r.page, "select", 0, 4, 0x1000); // retriggered and sounding
  await expect(strip(r, "A5").locator(".wpad")).toHaveClass(/lit/);
});

test("the AHR editor edits a pad's envelope by dragging its handles", async () => {
  const r = (running = await start());
  await strip(r, "A1").getByRole("button", { name: "A1 envelope" }).click();
  const editor = r.page.getByRole("dialog", { name: "A1 envelope" });
  await expect(editor).toBeVisible();
  const attack = editor.getByRole("slider", { name: "A1 attack" });
  const box = (await attack.boundingBox())!;
  await r.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await r.page.mouse.down();
  await r.page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 6 });
  await r.page.mouse.up();
  const value = Number(await attack.getAttribute("aria-valuenow"));
  expect(value).toBeGreaterThan(0);
  await expect.poll(async () => (await control<{ attack: number }>(r.page, "pad", 0)).attack).toBe(value);
  await attack.dblclick(); // reset
  await expect.poll(async () => (await control<{ attack: number }>(r.page, "pad", 0)).attack).toBe(0);
  await r.page.keyboard.press("Escape");
  await expect(editor).toBeHidden();
});

test("Settings changes the MIDI mode for the pad notes and lights, and remembers it", async () => {
  const r = (running = await start());
  await expect(strip(r, "A1").locator(".nt")).toHaveText("C1 · 1"); // Mode B: A1 = note 24
  await r.page.getByRole("button", { name: "SETTINGS" }).click();
  const settings = r.page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("button", { name: "MODE A" }).click();
  await expect(settings.getByLabel("Note offset")).toBeDisabled();
  await expect(strip(r, "A1").locator(".nt")).toHaveText("C3 · 1"); // Mode A: A1 = note 48
  await playMidi(r.page, 0x90, 48, 100);
  await expect(strip(r, "A1").locator(".wpad")).toHaveClass(/flash/);
  await r.page.keyboard.press("Escape");
  await r.page.reload();
  await expect(strip(r, "A1").locator(".nt")).toHaveText("C3 · 1");
});
