// The desk's pads and banks: what the device reports, with the app-side MUTE and SOLO laid over it. A silent pad
// (muted, or not soloed while others are) sits at level 0 on the device while the app remembers the level to go
// back to; banks do the same with their volume.

import { deviceMix, padChanges, type MixChange, type MixerPad, type MixField } from "../core/mixer";
import type { PadBlock } from "../core/serialMessages";

// The MUTE and SOLO buttons that are on, by pad (or bank) number.
export interface Buttons {
  mutes: readonly number[];
  solos: readonly number[];
}

// The buttons, and for each silent pad or bank the level or volume it goes back to.
export interface MixMemory extends Buttons {
  levels: Readonly<Record<number, number>>;
}

export const emptyMixMemory: MixMemory = { levels: {}, mutes: [], solos: [] };

// Silent when muted, or when anything is soloed and this isn't.
export const isSilent = (n: number, b: Buttons): boolean =>
  b.mutes.includes(n) || (b.solos.length > 0 && !b.solos.includes(n));

const toggled = (list: readonly number[], n: number) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]);
export const toggleMute = <B extends Buttons>(b: B, n: number): B => ({ ...b, mutes: toggled(b.mutes, n) });
export const toggleSolo = <B extends Buttons>(b: B, n: number): B => ({ ...b, solos: toggled(b.solos, n) });

function forget(levels: MixMemory["levels"], n: number): MixMemory["levels"] {
  const { [n]: _, ...rest } = levels;
  return rest;
}

// ---- pads

// A pad as the desk shows it: `muted` (from MixerPad) is whether it's silent on the device, `mute` and `solo` its
// buttons, `seconds` how long its sample plays.
export interface DeskPad extends MixerPad {
  mute: boolean;
  solo: boolean;
  seconds: number;
}

export function viewPad(block: PadBlock, memory: MixMemory): DeskPad {
  const remembered = memory.levels[block.pad];
  const silent = remembered !== undefined;
  return {
    pad: block.pad, name: block.name, mix: { ...block.mix, level: silent ? remembered : block.mix.level }, muted: silent,
    mute: memory.mutes.includes(block.pad), solo: memory.solos.includes(block.pad), seconds: block.seconds,
  };
}

export interface Edit {
  block: PadBlock; // the device's values afterwards
  memory: MixMemory;
  changes: MixChange[]; // what to send
}

function withLevel(levels: MixMemory["levels"], pad: MixerPad): MixMemory["levels"] {
  return pad.muted ? { ...forget(levels, pad.pad), [pad.pad]: pad.mix.level } : forget(levels, pad.pad);
}

// Apply `change` to the pad as the desk shows it, and work out what the device needs.
export function editPad(block: PadBlock, memory: MixMemory, change: (p: MixerPad) => MixerPad): Edit {
  const before = viewPad(block, memory);
  const after = change(before);
  return {
    block: { ...block, mix: deviceMix(after) },
    memory: { ...memory, levels: withLevel(memory.levels, after) },
    changes: padChanges(before, after),
  };
}

export const setField = (field: MixField, value: number) => (p: MixerPad): MixerPad => ({
  ...p, mix: { ...p.mix, [field]: value },
});

export interface ButtonsEdit {
  blocks: PadBlock[];
  memory: MixMemory;
  changes: MixChange[];
}

// New MUTE and SOLO buttons: silence or restore every pad whose state changes.
export function setButtons(blocks: readonly PadBlock[], memory: MixMemory, buttons: Buttons): ButtonsEdit {
  const start: ButtonsEdit = { blocks: [], memory: { ...memory, ...buttons }, changes: [] };
  return blocks.reduce((acc, block) => {
    const e = editPad(block, acc.memory, (p) => ({ ...p, muted: isSilent(p.pad, buttons) }));
    return { blocks: [...acc.blocks, e.block], memory: e.memory, changes: [...acc.changes, ...e.changes] };
  }, start);
}

// ---- banks: the same for a bank's volume

export interface BankView {
  volume: number; // as the desk shows it (the remembered volume while silent)
  silent: boolean;
  mute: boolean;
  solo: boolean;
}

export function viewBank(deviceVolume: number, memory: MixMemory, bank: number): BankView {
  const remembered = memory.levels[bank];
  return {
    volume: remembered ?? deviceVolume, silent: remembered !== undefined,
    mute: memory.mutes.includes(bank), solo: memory.solos.includes(bank),
  };
}

export interface BankEdit {
  memory: MixMemory;
  sends: { bank: number; volume: number }[]; // the volumes the device needs
}

// Move a bank's fader: a silent bank only changes the volume it goes back to.
export function setBankVolume(memory: MixMemory, bank: number, volume: number): BankEdit {
  if (memory.levels[bank] === undefined) return { memory, sends: [{ bank, volume }] };
  return { memory: { ...memory, levels: { ...memory.levels, [bank]: volume } }, sends: [] };
}

// New MUTE and SOLO buttons for the banks, given the volumes the device has.
export function setBankButtons(deviceVolumes: readonly number[], memory: MixMemory, buttons: Buttons): BankEdit {
  let levels = memory.levels;
  const sends: BankEdit["sends"] = [];
  deviceVolumes.forEach((volume, bank) => {
    const remembered = levels[bank];
    const silent = isSilent(bank, buttons);
    if (silent && remembered === undefined) {
      levels = { ...levels, [bank]: volume };
      sends.push({ bank, volume: 0 });
    } else if (!silent && remembered !== undefined) {
      levels = forget(levels, bank);
      sends.push({ bank, volume: remembered });
    }
  });
  return { memory: { ...memory, ...buttons, levels }, sends };
}

// Mute memory saved before SOLO was a plain record of muted pads (or banks) → level.
export function readMixMemory(saved: unknown): MixMemory {
  if (typeof saved !== "object" || saved === null) return emptyMixMemory;
  if ("levels" in saved) return { ...emptyMixMemory, ...(saved as Partial<MixMemory>) };
  const levels = saved as Record<number, number>;
  return { levels, mutes: Object.keys(levels).map(Number), solos: [] };
}
