// The desk's pads: what the device reports, with the app-side mute laid over it. A muted pad sits at level 0 on
// the device while the app remembers the level to go back to (`MuteMemory`).

import { deviceMix, padChanges, type MixChange, type MixerPad, type MixField } from "../core/mixer";
import type { PadBlock } from "../core/serialMessages";

// Muted pads → the level they go back to.
export type MuteMemory = Readonly<Record<number, number>>;

export function viewPad(block: PadBlock, memory: MuteMemory): MixerPad {
  const remembered = memory[block.pad];
  const muted = remembered !== undefined;
  return { pad: block.pad, name: block.name, mix: { ...block.mix, level: muted ? remembered : block.mix.level }, muted };
}

export interface Edit {
  block: PadBlock; // the device's values afterwards
  memory: MuteMemory;
  changes: MixChange[]; // what to send
}

function withMemory(memory: MuteMemory, pad: MixerPad): MuteMemory {
  const { [pad.pad]: _, ...rest } = memory;
  return pad.muted ? { ...rest, [pad.pad]: pad.mix.level } : rest;
}

// Apply `change` to the pad as the desk shows it, and work out what the device needs.
export function editPad(block: PadBlock, memory: MuteMemory, change: (p: MixerPad) => MixerPad): Edit {
  const before = viewPad(block, memory);
  const after = change(before);
  return {
    block: { ...block, mix: deviceMix(after) },
    memory: withMemory(memory, after),
    changes: padChanges(before, after),
  };
}

export const setField = (field: MixField, value: number) => (p: MixerPad): MixerPad => ({
  ...p, mix: { ...p.mix, [field]: value },
});

export const toggleMute = (p: MixerPad): MixerPad => ({ ...p, muted: !p.muted });

// ---- bank mute: the same idea for a bank's volume

// Muted banks → the volume they go back to.
export type BankMuteMemory = Readonly<Record<number, number>>;

export interface BankView {
  volume: number; // as the desk shows it (the remembered volume while muted)
  muted: boolean;
}

export function viewBank(deviceVolume: number, memory: BankMuteMemory, bank: number): BankView {
  const remembered = memory[bank];
  return remembered === undefined ? { volume: deviceVolume, muted: false } : { volume: remembered, muted: true };
}

export interface BankEdit {
  memory: BankMuteMemory;
  send?: number; // the volume to send, if the device's changes
}

function forget(memory: BankMuteMemory, bank: number): BankMuteMemory {
  const { [bank]: _, ...rest } = memory;
  return rest;
}

// Move a bank's fader: a muted bank only changes the volume it goes back to.
export function setBankVolume(memory: BankMuteMemory, bank: number, volume: number): BankEdit {
  return memory[bank] === undefined ? { memory, send: volume } : { memory: { ...memory, [bank]: volume } };
}

export function toggleBankMute(memory: BankMuteMemory, bank: number, deviceVolume: number): BankEdit {
  const remembered = memory[bank];
  if (remembered === undefined) return { memory: { ...memory, [bank]: deviceVolume }, send: 0 };
  return { memory: forget(memory, bank), send: remembered };
}
