// Sync modes over the H12 link (core/sync.ts, through settings/useWriter.ts): reads each device's mode and whether
// the Nome II's input lets Start/Stop through, and changes them. Before the first write, the previous message
// filters are kept (core/backup.ts), once.

import { useCallback } from "react";
import { mapperFormatProblem } from "../core/status";
import {
  allExternal, MODES, planned, setMode, setNomeTransport, SYNC_SETTINGS, syncState, type SyncDevice, type SyncMode,
} from "../core/sync";
import type { HubState } from "../hub/useHub";
import { useWriter, type Wording, type WriterSpec } from "../settings/useWriter";

// Firmware 5.0 may store filters differently too: the same guard as targets until it's checked.
const SPEC: WriterSpec = { list: SYNC_SETTINGS, backupKey: "h12.syncBackup", guard: (hub) => mapperFormatProblem(hub.firmware) };

const labelOf = (mode: SyncMode) => MODES.find((m) => m.mode === mode)!.label;

const wording = (what: string, unchanged: string): Wording => ({ doing: `Setting ${what}`, done: `Set ${what}`,
  stopped: `Stopped setting ${what}`, unchanged });

export function useSync(hub: HubState, note: (text: string) => void = () => undefined) {
  const { current, apply, ...writer } = useWriter(hub, SPEC, note);
  const state = current ? syncState(current) : undefined;

  const setDeviceMode = useCallback((device: SyncDevice, mode: SyncMode) => {
    const what = `${device.name} to ${labelOf(mode)}`;
    void apply(wording(what, `${device.name} is already ${labelOf(mode)}`), (c) => planned(setMode(c, device, mode)));
  }, [apply]);
  const setAllExternal = useCallback(() => {
    void apply(wording("every device to External", "Every device is already External"), (c) => planned(allExternal(c)));
  }, [apply]);
  const setNomeOpen = useCallback((open: boolean) => {
    const what = open ? "the Nome II's input to let Start/Stop through" : "the Nome II's input to block Start/Stop";
    void apply(wording(what, `The Nome II's input already ${open ? "lets Start/Stop through" : "blocks Start/Stop"}`),
      (c) => planned(setNomeTransport(c, open)));
  }, [apply]);

  return { state, ...writer, setDeviceMode, setAllExternal, setNomeOpen };
}

export type Sync = ReturnType<typeof useSync>;
