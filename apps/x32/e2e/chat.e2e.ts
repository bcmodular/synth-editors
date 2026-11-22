// Phase 4 (docs/x32-spec.md): the chat, against a fake desk set up from the rig file and a scripted model (the main
// process answers from global.fakeClaude when X32_FAKE_CLAUDE=1, which the harness always sets).
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loadInto, studioDesk } from "./studio";
import { finish, start, status, type X32App } from "./x32";

let running: X32App | undefined;
test.afterEach(async () => finish(running));

const usage = { input_tokens: 1200, output_tokens: 60, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
let ids = 0;
const reply = (content: object[], stop_reason: string) => ({
  message: { id: `m${++ids}`, type: "message", role: "assistant", model: "claude-haiku-5-5", content, stop_reason, stop_sequence: null, usage },
});
const tool = (name: string, input: object) => ({ type: "tool_use", id: `t${++ids}`, name, input });
const text = (t: string) => ({ type: "text", text: t });

async function script(r: X32App, replies: object[]): Promise<void> {
  await r.app.evaluate((_e, rs) => {
    (global as unknown as { fakeClaude: { replies: object[] } }).fakeClaude.replies.push(...rs);
  }, replies);
}

const requests = (r: X32App) =>
  r.app.evaluate(() => (global as unknown as { fakeClaude: { requests: { messages: { content: unknown }[] }[] } }).fakeClaude.requests);

const panel = (page: Page) => page.locator(".panel.chat");

async function ready(): Promise<X32App> {
  const r = (running = await start({ values: studioDesk(), loadFx: loadInto }));
  await expect(status(r.page)).toHaveText("Connected");
  await expect(r.page.locator(".rig table.sources")).toContainText("S-1");
  await expect(panel(r.page).getByLabel("Message")).toBeVisible(); // the fake Claude is ready
  return r;
}

async function say(page: Page, message: string) {
  await panel(page).getByLabel("Message").fill(message);
  await panel(page).getByRole("button", { name: "Send" }).click();
}

test("route S-1 to the P-6: the plan waits for Apply, then the Sampler goes to the P-6 (acceptance 1)", async () => {
  const r = await ready();
  await script(r, [
    reply([tool("send_to", { source: "S-1", destination: "P-6", mode: "replace", level_db: null })], "tool_use"),
    reply([text("That switches the Sampler to the P-6. Press Apply to go ahead.")], "end_turn"),
  ]);
  await say(r.page, "route S-1 to the P-6");
  await expect(panel(r.page).locator(".transcript")).toContainText("Press Apply to go ahead.");
  const pending = panel(r.page).getByRole("alertdialog");
  await expect(pending).toContainText("Send S-1 to the Sampler (→ P-6) at 0 dB; switch the Sampler to the P-6");
  expect(r.fake!.get("/outputs/aux/01/src")).toBe(0);

  const sent = await requests(r);
  expect(JSON.stringify(sent[0]!.messages[0])).toContain("The desk now");
  expect(JSON.stringify(sent[1]!.messages.at(-1))).toContain("Don't say it's done");

  await pending.getByRole("button", { name: "Apply" }).click();
  await expect(panel(r.page).locator(".transcript")).toContainText("Done: Send S-1 to the Sampler");
  expect(r.fake!.get("/outputs/aux/01/src")).toBe(14);
  expect(r.fake!.get("/ch/09/mix/11/level")).toBeCloseTo(0.75, 2);
  await expect(panel(r.page).locator(".usage")).toContainText("2,520 tokens");

  // The next message tells the model the user pressed Apply.
  await script(r, [reply([text("Done.")], "end_turn")]);
  await say(r.page, "thanks");
  await expect(panel(r.page).locator(".transcript")).toContainText("Done.");
  expect(JSON.stringify((await requests(r))[2]!.messages.at(-1))).toContain("the user pressed Apply");

  const logs = path.join(r.profile, "logs");
  const lines = (await readFile(path.join(logs, (await readdir(logs))[0]!), "utf8")).trim().split("\n").map((l) => JSON.parse(l));
  expect(lines.map((l) => l.kind)).toEqual(["request", "apply", "request"]);
  expect(lines[0]).toMatchObject({ typed: "route S-1 to the P-6", desk: "fake", calls: [{ name: "send_to", kind: "waiting" }] });
  expect(JSON.stringify(lines)).not.toContain("You control the routing"); // no system prompt in the log
});

test("send the P-6 to the P-6 is refused with a reason (acceptance 4)", async () => {
  const r = await ready();
  await script(r, [
    reply([tool("send_to", { source: "P-6", destination: "P-6", mode: "add", level_db: null })], "tool_use"),
    reply([text("I can't: that would feed the P-6 back into itself.")], "end_turn"),
  ]);
  await say(r.page, "send the P-6 to the P-6");
  await expect(panel(r.page).locator(".transcript .tool.bad")).toContainText("P-6 (ch 11-12) would be sent to its own feed");
  const result = JSON.stringify((await requests(r))[1]!.messages.at(-1));
  expect(result).toContain('"is_error":true');
  expect(r.fake!.get("/outputs/aux/01/src")).toBe(0);
});

test("also send applies straight away, and undo by chat restores it (acceptance 3 and 6)", async () => {
  const r = await ready();
  await script(r, [
    reply([tool("send_to", { source: "TB-3", destination: "Delay", mode: "add", level_db: -6 })], "tool_use"),
    reply([text("Sent.")], "end_turn"),
    reply([tool("undo", {})], "tool_use"),
    reply([text("Undone.")], "end_turn"),
  ]);
  await say(r.page, "also send the TB-3 to the delay at -6");
  await expect(panel(r.page).locator(".transcript")).toContainText("Done: Send TB-3 to Delay at -6 dB");
  expect(r.fake!.get("/ch/07/mix/03/level")).toBeCloseTo(0.6, 2);
  expect(r.fake!.get("/ch/07/mix/01/level")).toBeCloseTo(0.7, 2); // the reverb send is kept
  await say(r.page, "undo that");
  await expect(panel(r.page).locator(".transcript")).toContainText("Undone.");
  expect(r.fake!.get("/ch/07/mix/03/level")).toBe(0);
});

test("a model error leaves the conversation usable", async () => {
  const r = await ready();
  await script(r, [{ error: "Overloaded" }, reply([text("Hello again.")], "end_turn")]);
  await say(r.page, "hello");
  await expect(panel(r.page).locator(".transcript .note.bad")).toContainText("Overloaded");
  await say(r.page, "hello?");
  await expect(panel(r.page).locator(".transcript")).toContainText("Hello again.");
});

test("a delay goes on the TD-3 as an insert after Apply, and comes off again (acceptance 5 without the tempo)", async () => {
  const r = await ready();
  await script(r, [
    reply([tool("insert_fx", { source: "TD-3-MO", effect: "DLY", mix_percent: null })], "tool_use"),
    reply([text("Press Apply to put the delay on.")], "end_turn"),
    reply([tool("remove_insert", { source: "TD-3-MO" })], "tool_use"),
    reply([text("Press Apply to take it off.")], "end_turn"),
  ]);
  await say(r.page, "put a delay on the TD-3");
  const pending = panel(r.page).getByRole("alertdialog");
  await expect(pending).toContainText("Put Stereo Delay (DLY) on TD-3-MO as an insert, in FX 4");
  await pending.getByRole("button", { name: "Apply" }).click();
  await expect(panel(r.page).locator(".transcript")).toContainText("Done: Put Stereo Delay");
  expect(r.fake!.get("/fx/4/type")).toBe(10);
  expect(r.fake!.get("/fx/4/source/l")).toBe(0);
  expect(r.fake!.get("/ch/03/insert/sel")).toBe(7);
  expect(r.fake!.get("/ch/03/insert/on")).toBe(1);
  expect(r.fake!.get("/fx/4/par/01")).toBeCloseTo(0.3, 3);
  await expect(r.page.locator(".rig table.fx-slots")).toContainText("insert on TD-3-MO");

  await say(r.page, "take it off");
  await panel(r.page).getByRole("alertdialog").getByRole("button", { name: "Apply" }).click();
  await expect(panel(r.page).locator(".transcript")).toContainText("Done: Take FX 4 off TD-3-MO");
  expect(r.fake!.get("/ch/03/insert/on")).toBe(0);
  expect(r.fake!.get("/fx/4/source/l")).toBe(7);
});

test("changing a send effect's type is refused (acceptance 9)", async () => {
  const r = await ready();
  await script(r, [
    reply([tool("set_fx_type", { target: "Reverb", effect: "PLAT" })], "tool_use"),
    reply([text("FX 1 is in use as the reverb send, so I can't change it.")], "end_turn"),
  ]);
  await say(r.page, "make the reverb a plate");
  await expect(panel(r.page).locator(".transcript .tool.bad")).toContainText("FX 1 is a send effect (fed by Reverb)");
  expect(r.fake!.get("/fx/1/type")).toBe(0);
});

test("a vocal plate preset goes into the reverb's slot from the desk's library, after Apply", async () => {
  const r = await ready();
  await script(r, [
    reply([tool("find_presets", { query: "vocal plate" })], "tool_use"),
    reply([tool("load_preset", { preset: "Vocal Plate", target: "Reverb" })], "tool_use"),
    reply([text("Vocal Plate suits a lead. Press Apply to load it.")], "end_turn"),
  ]);
  await say(r.page, "give the reverb a vocal plate");
  const sent = await requests(r);
  expect(JSON.stringify(sent[1]!.messages.at(-1))).toContain("Vocal Plate (Plate Reverb, PLAT");
  const pending = panel(r.page).getByRole("alertdialog");
  await expect(pending).toContainText('Load "Vocal Plate" (Plate Reverb) into FX 1, replacing Hall Reverb (HALL)');
  await pending.getByRole("button", { name: "Apply" }).click();
  await expect(panel(r.page).locator(".transcript")).toContainText('Done: Load "Vocal Plate"');
  expect(r.fake!.sent("/load").map((m) => m.args.map((a) => a.value))).toEqual([["libfx", 1, 0]]);
  expect(r.fake!.get("/fx/1/type")).toBe(5);
  expect(r.fake!.get("/fx/1/source/l")).toBe(1); // still fed by the Reverb bus
  await expect(r.page.locator(".rig table.fx-slots")).toContainText("Plate Reverb (PLAT)");
});
