// Phase 4 (docs/x32-spec.md): the chat, against a fake desk set up from the rig file and a scripted model (the main
// process answers from global.fakeClaude when X32_FAKE_CLAUDE=1, which the harness always sets).
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { studioDesk } from "./studio";
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
  const r = (running = await start({ values: studioDesk() }));
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
  await expect(panel(r.page).locator(".transcript .tool.bad")).toContainText("P-6 would be sent to the Sampler bus while it goes to the P-6");
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
