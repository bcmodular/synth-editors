// The read-only check (docs/h12-spec.md, test 1): once the SysEx port is found, read the firmware from its answer,
// then the current preset (target switching works in preset 1 only).
// Every problem (no answer, an error answer, a bad checksum) is reported, never skipped over.

import { ask, type Lane, type Listen, type Reply } from "./link";
import { firmwareOk, isHub, parseFirmware, parsePreset, type Firmware, type Preset } from "./status";
import { readSetting, Setting } from "./sysex";

export interface HubReport {
  output: string; // the H12 output that answered SysEx
  input: string; // the H12 input the answer came back on
  firmware?: Firmware;
  firmwareOk: boolean;
  preset?: Preset;
  problems: string[];
}

const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(2, "0")}`;

// The frame of a good answer, or the problem with it.
export function answerBytes(what: string, reply: Reply | undefined): { bytes: number[] } | { problem: string } {
  if (!reply) return { problem: `${what}: no answer` };
  const a = reply.answer;
  if (a.kind === "error") return { problem: `${what}: the H12 answered error ${hex(a.code)} (${a.message})` };
  if (a.kind === "corrupt") return { problem: `${what}: the answer's checksum is wrong` };
  return { bytes: a.bytes };
}

// Runs a parser over an answer, adding to problems if anything is wrong with it.
function read<T>(what: string, reply: Reply | undefined, parse: (d: number[]) => T | undefined, problems: string[]) {
  const got = answerBytes(what, reply);
  if ("problem" in got) {
    problems.push(got.problem);
    return undefined;
  }
  const value = parse(got.bytes);
  if (value === undefined) problems.push(`${what}: an answer the app can't read`);
  return value;
}

function checkFirmware(firmware: Firmware | undefined, problems: string[]): boolean {
  if (!firmware) return false;
  if (!isHub(firmware)) problems.push(`Firmware: product ID ${hex(firmware.productId)} isn't the H12's hub side`);
  return firmwareOk(firmware);
}

export async function readHub(lane: Lane, firmwareReply: Reply, listen: Listen): Promise<HubReport> {
  const problems: string[] = [];
  const firmware = read("Firmware", firmwareReply, parseFirmware, problems);
  const ok = checkFirmware(firmware, problems);
  const presetReply = await ask(lane, listen, readSetting({ setting: Setting.currentPreset, index: 0 }, 1));
  const preset = read("Current preset", presetReply, parsePreset, problems);
  return { output: lane.name, input: firmwareReply.input, firmware, firmwareOk: ok, preset, problems };
}
