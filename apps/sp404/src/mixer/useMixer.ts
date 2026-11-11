// The desk's state and actions over the device link: pads and banks as the desk shows them (app-side MUTE and SOLO
// laid over the device's values), edits sent through the session's coalescing queue, and the buttons kept per
// project.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MixChange, MixField, MixerPad } from "../core/mixer";
import { bankVolumeFrame, mixChangeFrame } from "../core/serialMessages";
import {
  editPad, emptyMixMemory, readMixMemory, setBankButtons, setBankVolume as editBankVolume, setButtons, setField, setFields,
  toggleMute, toggleSolo, viewBank, viewPad, type BankEdit, type BankView, type Buttons, type DeskPad, type MixMemory,
} from "./mixerState";
import type { Device } from "./useDevice";

// The buttons and remembered levels for one project, kept in localStorage under `name`.
function useProjectMemory(name: string, project: number | undefined) {
  const key = project === undefined ? undefined : `sp404.${name}.${project}`;
  const load = useCallback((): MixMemory => {
    try {
      return key ? readMixMemory(JSON.parse(localStorage.getItem(key) ?? "{}")) : emptyMixMemory;
    } catch {
      return emptyMixMemory;
    }
  }, [key]);
  const [memory, setMemory] = useState<MixMemory>(load);
  useEffect(() => setMemory(load()), [load]);
  const save = useCallback((next: MixMemory) => {
    setMemory(next);
    if (key) localStorage.setItem(key, JSON.stringify(next));
  }, [key]);
  return [memory, save] as const;
}

type Session = Device["session"];

// The pads: values sent as they change, MUTE and SOLO across the project.
function usePads(device: Device["device"], session: Session) {
  const [memory, save] = useProjectMemory("mutes", device.project);
  const pads: DeskPad[] = useMemo(() => device.pads.map((b) => viewPad(b, memory)), [device.pads, memory]);

  const send = useCallback((changes: MixChange[]) => {
    for (const c of changes) session.current?.send(`${c.field}:${c.pad}`, mixChangeFrame(c));
  }, [session]);

  const edit = useCallback((pad: number, change: (p: MixerPad) => MixerPad) => {
    const block = device.pads.find((b) => b.pad === pad);
    if (!block) return;
    const e = editPad(block, memory, change);
    session.current?.notePad(e.block);
    save(e.memory);
    send(e.changes);
  }, [device.pads, memory, save, send, session]);

  const setValue = useCallback((pad: number, field: MixField, value: number) => edit(pad, setField(field, value)), [edit]);
  const setValues = useCallback((pad: number, values: Partial<MixerPad["mix"]>) => edit(pad, setFields(values)), [edit]);

  const press = useCallback((buttons: Buttons) => {
    const e = setButtons(device.pads, memory, buttons);
    for (const block of e.blocks) session.current?.notePad(block);
    save(e.memory);
    send(e.changes);
  }, [device.pads, memory, save, send, session]);
  const mute = useCallback((pad: number) => press(toggleMute(memory, pad)), [press, memory]);
  const solo = useCallback((pad: number) => press(toggleSolo(memory, pad)), [press, memory]);

  return { pads, setValue, setValues, mute, solo };
}

// The bank volumes, with MUTE and SOLO across the banks.
function useBanks(device: Device["device"], session: Session) {
  const [memory, save] = useProjectMemory("bankMutes", device.project);
  const banks: BankView[] = useMemo(
    () => device.bankVolumes.map((v, bank) => viewBank(v, memory, bank)), [device.bankVolumes, memory],
  );

  const apply = useCallback((e: BankEdit) => {
    save(e.memory);
    for (const { bank, volume } of e.sends) {
      session.current?.noteBankVolume(bank, volume);
      session.current?.send(`bank:${bank}`, bankVolumeFrame(bank, volume));
    }
  }, [save, session]);

  const setBankVolume = useCallback((bank: number, volume: number) =>
    apply(editBankVolume(memory, bank, volume)), [apply, memory]);
  const press = useCallback((buttons: Buttons) =>
    apply(setBankButtons(device.bankVolumes, memory, buttons)), [apply, memory, device.bankVolumes]);
  const muteBank = useCallback((bank: number) => press(toggleMute(memory, bank)), [press, memory]);
  const soloBank = useCallback((bank: number) => press(toggleSolo(memory, bank)), [press, memory]);

  return { banks, setBankVolume, muteBank, soloBank };
}

// Renaming pads' samples and the current project.
function useNames(session: Session) {
  const renamePad = useCallback((pad: number, name: string) => void session.current?.renamePad(pad, name), [session]);
  const renameProject = useCallback((name: string) => void session.current?.renameProject(name), [session]);
  return { renamePad, renameProject };
}

export function useMixer({ device, session }: Device) {
  return { ...usePads(device, session), ...useBanks(device, session), ...useNames(session), status: device.status };
}

export type Mixer = ReturnType<typeof useMixer>;
