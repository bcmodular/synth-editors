// Steps for trying the bridge against a real Reaper (scripts/try-bridge.ts). Kept apart from the command line so
// tests can run them against the Lua bridge too.

import type { ReaperBridge } from "./bridgeClient.ts";
import type { BridgeState, TrackInput, TrackState } from "./types.ts";

export type Log = (line: string) => void;

export const TEST_PART = "sm-test";

function describeInput(input: TrackInput): string {
  if (input.kind === "midi") return `MIDI ${input.port} ch ${input.channel || "all"}`;
  if (input.kind === "audio") return `audio ${input.channel}${input.stereo ? "/" + (input.channel + 1) : ""}`;
  return "no input";
}

export function describeTrack(t: TrackState): string {
  const flags = `${t.arm ? "R" : "·"}${t.mute ? "M" : "·"}${t.solo ? "S" : "·"}`;
  const out = t.midiOut ? ` → ${t.midiOut.port} ch ${t.midiOut.channel || "all"}` : "";
  const filter = t.noteFilter ? ` notes ${t.noteFilter.join(",")}` : "";
  const part = t.part ? ` (${t.part})` : "";
  return `${flags} ${t.index}. ${t.name || "(unnamed)"}${part}: ${describeInput(t.input)}${filter}${out} · ${t.guid}`;
}

export function describeState(s: BridgeState): string[] {
  const transport = s.recording ? "recording" : s.playing ? "playing" : s.paused ? "paused" : "stopped";
  return [`${transport} · ${s.tempo} bpm · ${s.tracks.length} tracks`, ...s.tracks.map((t) => `  ${describeTrack(t)}`)];
}

async function current(bridge: ReaperBridge): Promise<BridgeState> {
  const snapshot = await bridge.snapshot();
  if (!snapshot) throw new Error("the bridge hasn't published any state yet");
  return snapshot.state;
}

async function track(bridge: ReaperBridge, guid: string): Promise<TrackState> {
  const t = (await current(bridge)).tracks.find((x) => x.guid === guid);
  if (!t) throw new Error(`track ${guid} isn't in the state`);
  return t;
}

/** Is the web interface reachable, and is the script running? */
export async function checkBridge(bridge: ReaperBridge, log: Log): Promise<boolean> {
  const alive = await bridge.alive();
  if (alive === undefined) {
    log("✗ The web interface answers, but the bridge script isn't running (no SongManager/alive).");
    return false;
  }
  log(`✓ Bridge running (heartbeat ${alive})`);
  const started = Date.now();
  await bridge.run({ type: "ping" });
  log(`✓ ping answered in ${Date.now() - started} ms`);
  const state = await current(bridge);
  log(`✓ Reaper sees ${state.ports.inputs.length} MIDI inputs and ${state.ports.outputs.length} MIDI outputs`);
  for (const line of describeState(state)) log(line);
  return true;
}

export function listPorts(state: BridgeState, log: Log): void {
  log("MIDI inputs (record input, capture):");
  for (const name of state.ports.inputs) log(`  ${name}`);
  log("MIDI outputs (hardware out, playback):");
  for (const name of state.ports.outputs) log(`  ${name}`);
}

export interface DemoOptions {
  input?: string; // MIDI input port name for the test track
  output?: string; // MIDI output port name
  channel: number;
  notes?: number[];
}

function requirePort(ports: string[], name: string | undefined, kind: string): void {
  if (name !== undefined && !ports.includes(name)) {
    throw new Error(`Reaper has no MIDI ${kind} called "${name}". Run "ports" to list them.`);
  }
}

async function expectFlag(bridge: ReaperBridge, guid: string, flag: "arm" | "mute" | "solo", on: boolean, log: Log) {
  await bridge.run({ type: flag, track: guid, on });
  const value = (await track(bridge, guid))[flag];
  if (Boolean(value) !== on) throw new Error(`${flag} ${on ? "on" : "off"} didn't show in the state`);
  log(`✓ ${flag} ${on ? "on" : "off"}, read back`);
}

async function setUpRouting(bridge: ReaperBridge, guid: string, options: DemoOptions, log: Log): Promise<void> {
  if (options.input) {
    await bridge.run({ type: "set-input", track: guid, input: { kind: "midi", port: options.input, channel: options.channel } });
    log(`✓ input: ${describeInput((await track(bridge, guid)).input)}`);
  }
  await bridge.run({ type: "set-monitor", track: guid, mode: 0 });
  log("✓ monitoring off");
  if (options.notes) {
    await bridge.run({ type: "set-note-filter", track: guid, notes: options.notes });
    log(`✓ note filter: ${(await track(bridge, guid)).noteFilter?.join(", ")}`);
  }
  if (options.output) {
    await bridge.run({ type: "set-hw-midi-out", track: guid, port: options.output, channel: options.channel });
    const out = (await track(bridge, guid)).midiOut;
    log(`✓ MIDI out: ${out?.port} ch ${out?.channel}`);
  }
}

/** Creates a test track and runs the bridge's commands on it, checking each against the published state. */
export async function runDemo(bridge: ReaperBridge, options: DemoOptions, log: Log): Promise<string> {
  const before = await current(bridge);
  requirePort(before.ports.inputs, options.input, "input");
  requirePort(before.ports.outputs, options.output, "output");
  const { track: guid } = await bridge.run<{ track: string }>({ type: "create-track", name: "SM test", part: TEST_PART });
  log(`✓ created "SM test" ${guid}`);
  await setUpRouting(bridge, guid, options, log);
  await expectFlag(bridge, guid, "mute", true, log);
  await expectFlag(bridge, guid, "mute", false, log);
  await expectFlag(bridge, guid, "solo", true, log);
  await expectFlag(bridge, guid, "solo", false, log);
  await expectFlag(bridge, guid, "arm", true, log);
  const chain = await bridge.run<{ fxChain: string | null }>({ type: "save-fx-chain", track: guid });
  log(`✓ FX chain read: ${chain.fxChain ? `${chain.fxChain.split("\n").length - 1} lines` : "no FX chain on the track"}`);
  if (options.output) {
    await bridge.run({ type: "notes-off", port: options.output, channels: [options.channel || 1] });
    log("✓ all notes off sent");
  }
  log(`  ${describeTrack(await track(bridge, guid))}`);
  return guid;
}

/** Deletes the tracks the demo made. */
export async function cleanUp(bridge: ReaperBridge, log: Log): Promise<number> {
  const tracks = (await current(bridge)).tracks.filter((t) => t.part === TEST_PART);
  for (const t of tracks) await bridge.run({ type: "delete-track", track: t.guid });
  log(`✓ deleted ${tracks.length} test track${tracks.length === 1 ? "" : "s"}`);
  return tracks.length;
}
