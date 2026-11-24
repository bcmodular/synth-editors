// The real JV-2080 for the end-to-end tests (JV_HW=1): its port, reading its temporary patch with RQ1 from the page,
// and sending it a patch, paced as the app paces bulk sends. The harness (jv.ts) puts the test patch on the JV before
// each test and the JV's own patch back after it.
import type { Page } from "@playwright/test";
import { bufferToPatch, emptyPatch, PATCH_BLOCKS, patchToDt1s, placeDt1, type Patch } from "../src/core/patch";
import { parseDt1, rq1 } from "../src/core/sysex";

export const HW = process.env.JV_HW === "1";
export const HW_PORT = process.env.JV_PORT ?? "H12MIDI-Pro Port 5"; // where the JV sits in the studio
const GAP_MS = 30; // between bulk messages: the app's pace (link/readPatch.ts) with room to spare
const REPLY_MS = 1500;

// Throws, naming the ports there are, unless `name` is both an input and an output. Ports can take a moment to
// appear after MIDI access is granted, so it looks for a few seconds.
export async function checkPort(page: Page, name: string) {
  const found = await page.evaluate(async (name) => {
    const a = await navigator.requestMIDIAccess({ sysex: true });
    const names = (ports: Iterable<MIDIPort>) => [...ports].map((p) => p.name ?? "");
    for (let i = 0; i < 30 && !names(a.outputs.values()).includes(name); i++) await new Promise((r) => setTimeout(r, 100));
    return { ins: names(a.inputs.values()), outs: names(a.outputs.values()) };
  }, name);
  if (!found.ins.includes(name) || !found.outs.includes(name)) {
    throw new Error(`No MIDI port "${name}" (set JV_PORT). Outputs: ${found.outs.join(", ") || "none"}`);
  }
}

// One RQ1, and the JV's DT1 for the same address; null if none comes.
function ask(page: Page, port: string, request: number[]): Promise<number[] | null> {
  return page.evaluate(async ([port, r, waitMs]) => {
    const a = await navigator.requestMIDIAccess({ sysex: true });
    const input = [...a.inputs.values()].find((p) => p.name === port)!;
    const output = [...a.outputs.values()].find((p) => p.name === port)!;
    const addr = r.slice(5, 9).join();
    return new Promise<number[] | null>((resolve) => {
      const done = (reply: number[] | null) => {
        input.removeEventListener("midimessage", on);
        resolve(reply);
      };
      const on = (e: Event) => {
        const d = Array.from((e as MIDIMessageEvent).data ?? []);
        if (d[4] === 0x12 && d.slice(5, 9).join() === addr) done(d);
      };
      input.addEventListener("midimessage", on);
      setTimeout(() => done(null), waitMs);
      output.send(r);
    });
  }, [port, request, REPLY_MS] as const);
}

// Each block asked for in turn, the next once the last has come back (as the app reads).
export async function readReal(page: Page, port: string): Promise<Patch> {
  const buffer = emptyPatch();
  for (const b of PATCH_BLOCKS) {
    const dt = parseDt1((await ask(page, port, rq1(b.addr, b.size))) ?? []);
    if (!dt) throw new Error(`The JV didn't answer a read of ${b.name}`);
    placeDt1(buffer, dt.addr, dt.data);
  }
  const patch = bufferToPatch(buffer);
  if (!patch) throw new Error("The JV's patch came back incomplete");
  return patch;
}

// The whole patch, waiting until the last message has gone.
export async function sendReal(page: Page, port: string, patch: Patch) {
  await page.evaluate(async ([port, msgs, gap]) => {
    const a = await navigator.requestMIDIAccess({ sysex: true });
    const output = [...a.outputs.values()].find((p) => p.name === port)!;
    for (const m of msgs) {
      output.send(m);
      await new Promise((r) => setTimeout(r, gap));
    }
  }, [port, patchToDt1s(patch), GAP_MS] as const);
}
