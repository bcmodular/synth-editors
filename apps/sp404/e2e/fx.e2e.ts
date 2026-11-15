// The FX modules against the fake SP-404's MIDI: choosing effects, switching them, turning controls.
import { expect, test } from "@playwright/test";
import { finish, midiSent, start, type Sp404App } from "./sp404";

let running: Sp404App | undefined;
test.afterEach(async () => finish(running));

const module = (r: Sp404App, bus: number) => r.page.locator(`.bus[data-bus="${bus}"]`);
const LIT = /(^|\s)hot(\s|$)/; // lit from a help panel (not just hot-ctl)

async function chooseEffect(r: Sp404App, bus: number, label: string, name: string) {
  await r.page.getByRole("button", { name: `${label} effect` }).click();
  await r.page.getByRole("dialog", { name: `Effects for ${label}` }).getByRole("button", { name, exact: true }).click();
}

test("choosing an effect sends its whole block: CC 83, CC 19, then the knobs", async () => {
  const r = (running = await start());
  await chooseEffect(r, 1, "BUS 1", "Filter + Drive");
  await expect(module(r, 1).locator(".name")).toHaveText("FILTER + DRIVE");
  await expect.poll(() => midiSent(r.page)).toEqual([
    [0xb0, 83, 1], [0xb0, 19, 127], [0xb0, 16, 70], [0xb0, 17, 50], [0xb0, 18, 30], [0xb0, 80, 64], [0xb0, 81, 20],
    [0xb0, 82, 80],
  ]);
});

test("each bus group uses its own CC 83 number and channel", async () => {
  const r = (running = await start());
  await chooseEffect(r, 3, "BUS 3", "Filter + Drive");
  await chooseEffect(r, 5, "INPUT FX", "Reverb");
  await expect.poll(async () => (await midiSent(r.page)).filter((m) => m[1] === 83)).toEqual([[0xb2, 83, 10], expect.any(Array)]);
  const input = (await midiSent(r.page)).filter((m) => m[1] === 83)[1]!;
  expect(input[0]).toBe(0xb4); // channel 5
});

test("a knob sends just its CC; the type switch and ON/OFF send theirs", async () => {
  const r = (running = await start());
  await chooseEffect(r, 2, "BUS 2", "Filter + Drive");
  await expect.poll(async () => (await midiSent(r.page)).length).toBe(8);
  const cutoff = module(r, 2).getByRole("slider", { name: "CUTOFF" }).first();
  await cutoff.hover();
  await r.page.mouse.wheel(0, -40); // one step up
  await module(r, 2).getByRole("group", { name: "FILTER TYPE" }).getByRole("button").first().click();
  await module(r, 2).getByRole("button", { name: "BUS 2 on" }).click();
  await expect.poll(async () => (await midiSent(r.page)).slice(8)).toEqual([[0xb1, 16, 71], [0xb1, 80, 0], [0xb1, 19, 0]]);
});

test("SYNC swaps a rate knob for its note-value matrix", async () => {
  const r = (running = await start());
  await chooseEffect(r, 1, "BUS 1", "Super Filter");
  const m = module(r, 1);
  const sync = m.getByRole("group", { name: "SYNC" });
  await sync.getByRole("button", { name: "ON" }).click();
  await expect(m.getByRole("group", { name: "RATE" })).toBeVisible();
  await m.getByRole("group", { name: "RATE" }).getByRole("button", { name: "1/8T" }).click();
  await expect.poll(async () => (await midiSent(r.page)).at(-1)?.slice(0, 2)).toEqual([0xb0, 81]);
  await sync.getByRole("button", { name: "OFF" }).click();
  await expect(m.getByRole("slider", { name: "RATE" })).toBeVisible();
});

test("the effect chooser only offers what the bus can load, and the choice is remembered", async () => {
  const r = (running = await start());
  await r.page.getByRole("button", { name: "BUS 1 effect" }).click();
  const list = r.page.getByRole("dialog", { name: "Effects for BUS 1" });
  await expect(list.getByRole("button", { name: "Vocoder", exact: true })).toBeDisabled(); // INPUT FX only
  await list.getByRole("button", { name: "Resonator", exact: true }).click();
  await r.page.reload();
  await expect(module(r, 1).locator(".name")).toHaveText("RESONATOR");
});

test("SYNC ALL FX pushes every bus with an effect, and a bus's SYNC that bus", async () => {
  const r = (running = await start());
  await chooseEffect(r, 4, "BUS 4 · MASTER", "Filter + Drive");
  await expect.poll(async () => (await midiSent(r.page)).length).toBe(8);
  await r.page.getByRole("button", { name: "SYNC ALL FX" }).click();
  await expect.poll(async () => (await midiSent(r.page)).length).toBe(16);
  expect((await midiSent(r.page))[8]).toEqual([0xb3, 83, 10]);
  await r.page.getByRole("button", { name: "BUS 4 sync" }).click();
  await expect.poll(async () => (await midiSent(r.page)).length).toBe(24);
  await r.page.getByRole("button", { name: "BUS 1 sync" }).click(); // no effect: nothing to send
  await r.page.waitForTimeout(200);
  expect((await midiSent(r.page)).length).toBe(24);
});

test("dragging a handle in a drawing sends both of its parameters", async () => {
  const r = (running = await start());
  await chooseEffect(r, 1, "BUS 1", "Filter + Drive");
  await expect.poll(async () => (await midiSent(r.page)).length).toBe(8);
  const handle = module(r, 1).locator(".view").getByRole("slider", { name: "CUT · RESO" });
  const box = (await handle.boundingBox())!;
  await r.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await r.page.mouse.down();
  await r.page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 - 20, { steps: 5 });
  await r.page.mouse.up();
  await expect.poll(async () => {
    const after = (await midiSent(r.page)).slice(8);
    return [after.some((m) => m[1] === 16 && m[2]! > 70), after.some((m) => m[1] === 17 && m[2]! > 50)];
  }).toEqual([true, true]);
});

test("the Equalizer's gains are readouts under its drawing, not knobs", async () => {
  const r = (running = await start());
  await chooseEffect(r, 5, "INPUT FX", "Equalizer");
  const m = module(r, 5);
  await expect(m.locator(".readout")).toHaveCount(3);
  await expect(m.getByRole("slider", { name: "LOW GAIN" })).toHaveCount(0);
  await expect(m.locator(".view").getByRole("slider", { name: /^LOW / })).toBeVisible();
});

test("Isolator KILL sends a band to −INF and a second press restores it", async () => {
  const r = (running = await start());
  await chooseEffect(r, 2, "BUS 2", "Isolator");
  await expect.poll(async () => (await midiSent(r.page)).length).toBe(5);
  const kill = module(r, 2).getByRole("button", { name: "KILL MID" });
  await kill.click();
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb1, 17, 0]);
  await kill.click();
  const before = (await midiSent(r.page))[3]![2];
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb1, 17, before]);
});

test("every effect draws its view on a bus that can load it, without errors", async () => {
  test.setTimeout(120_000);
  const r = (running = await start());
  const errors: string[] = [];
  r.page.on("pageerror", (e) => errors.push(e.message));
  r.page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const { EFFECTS } = await import("../src/core/effects");
  const { canLoad } = await import("../src/core/fx");
  const labels: Record<number, string> = { 1: "BUS 1", 3: "BUS 3", 5: "INPUT FX" };
  for (const fx of EFFECTS) {
    const bus = ([1, 3, 5] as const).find((b) => canLoad(fx, b))!;
    await chooseEffect(r, bus, labels[bus]!, fx.name);
    await expect(module(r, bus).locator(".name")).toHaveText(fx.name.toUpperCase());
    await expect(module(r, bus).locator(".view svg"), fx.name).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("(i) opens the effect's help, with its parameters' values, and a working copy of the module", async () => {
  const r = (running = await start());
  await expect(module(r, 1).getByRole("button", { name: "About this effect" })).toBeDisabled();
  await chooseEffect(r, 1, "BUS 1", "Filter + Drive");
  await module(r, 1).getByRole("button", { name: "About Filter + Drive" }).click();
  const help = r.page.getByRole("dialog", { name: "About Filter + Drive" });
  await expect(help).toContainText("Bus 1, Bus 2, Bus 3, Bus 4");
  await expect(help.locator("dt").filter({ hasText: "CUTOFF" })).toContainText("20 Hz – 16000 Hz");
  const copy = r.page.locator(".fx-help-side");
  const row = (label: string) =>
    help.locator(".fx-help-params > div").filter({ has: r.page.locator("dt", { hasText: new RegExp(`^${label}`) }) });
  await row("RESONANCE").hover(); // pointing at a row lights its control in the copy, and only that one
  await expect(copy.locator(".slot.hot")).toHaveCount(1);
  await expect(copy.locator(".slot.hot")).toContainText("RESONANCE");
  await expect(copy.locator(".hdl.hot")).toHaveCount(1); // and the drawing's handle that moves it
  await expect(copy.locator(".hdl.hot")).toHaveAttribute("aria-label", "CUT · RESO");
  await copy.locator(".hdl", { hasText: "LOW" }).hover(); // pointing at a handle lights the rows it moves
  await expect(row("LOW FREQ")).toHaveClass(LIT);
  await expect(row("LOW GAIN")).toHaveClass(LIT);
  if (process.env.HELP_SHOT) await r.page.waitForTimeout(300).then(() => r.page.screenshot({ path: process.env.HELP_SHOT }));
  await copy.getByRole("slider", { name: "DRIVE" }).hover(); // and pointing at a control lights its row
  await expect(row("DRIVE")).toHaveClass(LIT);
  await expect(row("CUTOFF")).not.toHaveClass(LIT);
  await copy.getByRole("group", { name: "FILTER TYPE" }).getByRole("button").first().click();
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb0, 80, 0]);
  await help.getByRole("button", { name: "Choose the effect for BUS 1" }).click();
  const chooser = r.page.getByRole("dialog", { name: "Effects for BUS 1" });
  await chooser.getByRole("button", { name: "Reverb", exact: true }).click();
  const reverb = r.page.getByRole("dialog", { name: "About Reverb" });
  await expect(reverb).toBeVisible();
  await expect(module(r, 1).locator(".name")).toHaveText("REVERB");
  await expect.poll(async () => (await midiSent(r.page)).filter((m) => m[1] === 83).at(-1)).toEqual([0xb0, 83, 22]);
  await r.page.keyboard.press("Escape");
  await expect(reverb).toBeHidden();
});
