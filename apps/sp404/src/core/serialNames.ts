// Renaming on the SP-404 MK2's serial control channel, from the SparkyMK2 notes (see serialFrames.ts): a pad's
// sample (02 pad:u16 name) and the current project (35 project name). The device echoes both. Names are printable
// ASCII, space padded to their field.

import { CHANNEL_CONTROL, longFrame, type Frame } from "./serialFrames";

const CMD_PAD_NAME = 0x02;
const CMD_PROJECT_NAME = 0x35;

export interface NameField {
  length: number;
}

export const PAD_NAME: NameField = { length: 23 }; // bytes 175–197 of the pad block, NUL at 198
export const PROJECT_NAME: NameField = { length: 32 }; // bytes 115–146 of the project settings

// What the device would keep of a name: printable ASCII, trimmed, cut to the field.
export function cleanName(name: string, field: NameField): string {
  return [...name].filter((c) => c >= " " && c <= "~").join("").trim().slice(0, field.length);
}

// The device renames whichever project is current, whatever `project` says.
export type Rename = { pad: number; name: string } | { project: number; name: string };

function prefixOf(r: Rename): number[] {
  return "pad" in r ? [CMD_PAD_NAME, r.pad & 0xff, r.pad >> 8] : [CMD_PROJECT_NAME, r.project];
}

const fieldOf = (r: Rename): NameField => ("pad" in r ? PAD_NAME : PROJECT_NAME);

export function renameFrame(r: Rename): Uint8Array {
  const field = fieldOf(r);
  const name = Array.from(cleanName(r.name, field).padEnd(field.length, " "), (c) => c.charCodeAt(0));
  return longFrame(CHANNEL_CONTROL, [...prefixOf(r), ...name]);
}

// The device's echo of a rename: the same command and target.
export function isRenameEcho(frame: Frame, r: Rename): boolean {
  const prefix = prefixOf(r);
  return frame.channel === CHANNEL_CONTROL && prefix.every((b, i) => frame.payload[i] === b);
}
