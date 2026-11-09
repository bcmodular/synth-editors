// The desk's state and actions over the device link: pads and banks as the desk shows them (app-side mute laid
// over the device's values), edits sent through the session's coalescing queue, and mute memory kept per project.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MixChange, MixField, MixerPad } from "../core/mixer";
import { bankVolumeFrame, mixChangeFrame } from "../core/serialMessages";
import {
  editPad, setBankVolume as editBankVolume, setField, toggleBankMute, toggleMute, viewBank, viewPad,
  type BankEdit, type BankMuteMemory, type BankView, type MuteMemory,
} from "./mixerState";
import type { Device } from "./useDevice";

type Memory = Readonly<Record<number, number>>;

// Mute memory for one project, kept in localStorage under `name`.
function useProjectMemory(name: string, project: number | undefined) {
  const key = project === undefined ? undefined : `sp404.${name}.${project}`;
  const load = useCallback((): Memory => {
    try {
      return key ? (JSON.parse(localStorage.getItem(key) ?? "{}") as Memory) : {};
    } catch {
      return {};
    }
  }, [key]);
  const [memory, setMemory] = useState<Memory>(load);
  useEffect(() => setMemory(load()), [load]);
  const save = useCallback((next: Memory) => {
    setMemory(next);
    if (key) localStorage.setItem(key, JSON.stringify(next));
  }, [key]);
  return [memory, save] as const;
}

export function useMixer({ device, session }: Device) {
  const [padMemory, savePads] = useProjectMemory("mutes", device.project);
  const [bankMemory, saveBanks] = useProjectMemory("bankMutes", device.project);

  const pads: MixerPad[] = useMemo(() => device.pads.map((b) => viewPad(b, padMemory)), [device.pads, padMemory]);
  const banks: BankView[] = useMemo(
    () => device.bankVolumes.map((v, bank) => viewBank(v, bankMemory, bank)), [device.bankVolumes, bankMemory],
  );

  const send = useCallback((changes: MixChange[]) => {
    for (const c of changes) session.current?.send(`${c.field}:${c.pad}`, mixChangeFrame(c));
  }, [session]);

  const edit = useCallback((pad: number, change: (p: MixerPad) => MixerPad) => {
    const block = device.pads.find((b) => b.pad === pad);
    if (!block) return;
    const e = editPad(block, padMemory as MuteMemory, change);
    session.current?.notePad(e.block);
    savePads(e.memory);
    send(e.changes);
  }, [device.pads, padMemory, savePads, send, session]);

  const setValue = useCallback((pad: number, field: MixField, value: number) => edit(pad, setField(field, value)), [edit]);
  const mute = useCallback((pad: number) => edit(pad, toggleMute), [edit]);

  const applyBank = useCallback((bank: number, e: BankEdit) => {
    saveBanks(e.memory);
    if (e.send === undefined) return;
    session.current?.noteBankVolume(bank, e.send);
    session.current?.send(`bank:${bank}`, bankVolumeFrame(bank, e.send));
  }, [saveBanks, session]);

  const setBankVolume = useCallback((bank: number, volume: number) =>
    applyBank(bank, editBankVolume(bankMemory as BankMuteMemory, bank, volume)), [applyBank, bankMemory]);
  const muteBank = useCallback((bank: number) =>
    applyBank(bank, toggleBankMute(bankMemory, bank, device.bankVolumes[bank] ?? 127)), [applyBank, bankMemory, device.bankVolumes]);

  return { pads, banks, status: device.status, setValue, mute, setBankVolume, muteBank };
}

export type Mixer = ReturnType<typeof useMixer>;
