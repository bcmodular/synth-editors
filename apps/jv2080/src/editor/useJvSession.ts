// The editor's session: the patch being edited, kept in step with the JV's temporary patch. Edits update the patch
// and go to the JV as DT1s (coalesced per address, so a drag sends at most one per frame); DT1s from the JV (eg. an
// edit on its panel) update the patch. The whole patch can be read from the JV or sent to it.

import { useCallback, useEffect, useMemo, useState } from "react";
import { programChange, type Bank } from "../core/banks";
import { applyDt1, bufferToPatch, emptyPatch, paramAddress, paramDt1, patchName, patchToDt1s, setParam, type Patch } from "../core/patch";
import type { ParamDef } from "../core/params";
import { addrHex, parseDt1 } from "../core/sysex";
import { readPatch, sendPaced } from "../link/readPatch";
import type { JvLink } from "../link/useJvLink";
import { createEditQueue } from "./editQueue";

export interface JvSession {
  patch: Patch | null;
  busy: boolean;
  setValue: (p: ParamDef, value: number, tone?: number) => void;
  syncFromJv: () => Promise<void>;
  syncToJv: () => Promise<void>;
  loadFromBank: (bank: Bank, number: number) => Promise<void>;
}

// DT1s that arrive outside a read update the patch.
function useIncomingEdits(link: JvLink, busy: boolean, setPatch: (f: (p: Patch | null) => Patch | null) => void) {
  useEffect(() => link.subscribe((msg) => {
    const dt = busy ? undefined : parseDt1(msg);
    if (dt?.checksumOk) setPatch((p) => p && applyDt1(p, dt.addr, dt.data));
  }), [link.subscribe, busy, setPatch]);
}

export function useJvSession(link: JvLink): JvSession {
  const [patch, setPatch] = useState<Patch | null>(null);
  const [busy, setBusy] = useState(false);
  const { send, device } = link;
  const queue = useMemo(() => createEditQueue((msg) => send(msg, "DT1 edit")), [send]);
  useIncomingEdits(link, busy, setPatch);

  const setValue = useCallback((p: ParamDef, value: number, tone = 0) => {
    setPatch((cur) => cur && setParam(cur, p, value, tone));
    queue.push(addrHex(paramAddress(p, tone)), paramDt1(p, value, tone, device));
  }, [queue, device]);

  const syncFromJv = useCallback(async () => {
    setBusy(true);
    const buffer = emptyPatch();
    const ok = await readPatch(link, buffer, () => {});
    const read = ok ? bufferToPatch(buffer) : undefined;
    if (read) setPatch(read);
    link.note(read ? `read "${patchName(read)}"` : "read incomplete");
    setBusy(false);
  }, [link]);

  const syncToJv = useCallback(async () => {
    if (!patch) return;
    setBusy(true);
    await sendPaced(link, patchToDt1s(patch, device), "DT1 patch");
    setBusy(false);
  }, [link, patch, device]);

  // The JV handles MIDI in order, so the read can follow the program change straight away.
  const loadFromBank = useCallback(async (bank: Bank, number: number) => {
    programChange(bank, number, link.channel).forEach((m, i) => send(m, ["bank MSB", "bank LSB", "program"][i]!));
    await syncFromJv();
  }, [link.channel, send, syncFromJv]);

  return { patch, busy, setValue, syncFromJv, syncToJv, loadFromBank };
}

