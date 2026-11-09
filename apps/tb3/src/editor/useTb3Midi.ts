// MIDI ports (remembered by name), TB-3 channel, log, and the Sync from TB-3 handshake.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  findInputByName,
  findOutputByName,
  listInputs,
  listOutputs,
  requestMidi,
  toHex,
  type PortInfo,
} from "@synth-editors/midi";
import { patchFromSysex } from "../core/patch";
import type { Patch } from "../core/patch";
import { PATCH_BLOCKS, addrKey, parseDt1, rq1 } from "../core/sysex";
import { createPacer } from "./pacer";
import type { Tb3Sender } from "./pacer";
import { load, save } from "./storage";

export type PortRole = "tb3In" | "tb3Out" | "lpIn" | "lpOut";
const ROLES: PortRole[] = ["tb3In", "tb3Out", "lpIn", "lpOut"];
const LOG_LIMIT = 200;
const SYNC_TIMEOUT_MS = 2000;
const BLOCK_KEYS = new Set(PATCH_BLOCKS.map((b) => addrKey(b.addr)));

export type SyncState = { kind: "idle" } | { kind: "waiting"; got: number } | { kind: "error"; message: string };

export function useTb3Midi(onPatch: (p: Patch) => void) {
  const [access, setAccess] = useState<MIDIAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<PortInfo[]>([]);
  const [outputs, setOutputs] = useState<PortInfo[]>([]);
  const [ports, setPorts] = useState<Record<PortRole, string | null>>(
    () => Object.fromEntries(ROLES.map((r) => [r, load(`port.${r}`)])) as Record<PortRole, string | null>,
  );
  const [channel, setChannelState] = useState(() => Number(load("tb3.channel")) || 2);
  const [log, setLog] = useState<string[]>([]);
  const [sync, setSync] = useState<SyncState>({ kind: "idle" });
  const pending = useRef<Map<string, number[]> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;

  const addLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLog((prev) => [`${stamp}  ${line}`, ...prev].slice(0, LOG_LIMIT));
  }, []);

  useEffect(() => {
    requestMidi()
      .then((a) => {
        const refresh = () => {
          setInputs(listInputs(a));
          setOutputs(listOutputs(a));
        };
        refresh();
        a.onstatechange = refresh;
        setAccess(a);
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  const choosePort = (role: PortRole, name: string) => {
    save(`port.${role}`, name);
    setPorts((prev) => ({ ...prev, [role]: name }));
  };

  const setChannel = (ch: number) => {
    save("tb3.channel", String(ch));
    setChannelState(ch);
  };

  const tb3Out = access ? findOutputByName(access, ports.tb3Out) : undefined;
  const tb3OutRef = useRef(tb3Out);
  tb3OutRef.current = tb3Out;

  // Stable sender for everything to the TB-3: always the currently selected output, paced so a
  // burst never arrives back to back (see pacer.ts).
  const tb3 = useMemo<Tb3Sender>(() => {
    const pacer = createPacer();
    return { send: (msg) => tb3OutRef.current?.send(msg, pacer.at(msg.length)), backlog: pacer.backlog };
  }, []);

  const finishSync = useCallback(() => {
    clearTimeout(timer.current);
    const blocks = pending.current;
    pending.current = null;
    if (!blocks) return;
    try {
      onPatchRef.current(patchFromSysex([...blocks.values()]));
      setSync({ kind: "idle" });
      addLog(`TB-3 ← patch (${blocks.size} blocks)`);
    } catch (e) {
      setSync({ kind: "error", message: String(e instanceof Error ? e.message : e) });
    }
  }, [addLog]);

  useEffect(() => {
    const input = access && findInputByName(access, ports.tb3In);
    if (!input) return;
    input.onmidimessage = (e) => {
      if (!e.data) return;
      const msg = parseDt1(e.data);
      if (!msg) {
        addLog(`TB-3 ← ${toHex(e.data)}`);
        return;
      }
      const key = addrKey(msg.addr);
      const blocks = pending.current;
      if (!blocks || !BLOCK_KEYS.has(key)) return; // outside a sync: ignored in Phase 2
      blocks.set(key, Array.from(e.data));
      setSync({ kind: "waiting", got: blocks.size });
      if (blocks.size === BLOCK_KEYS.size) finishSync();
    };
    return () => {
      input.onmidimessage = null;
    };
  }, [access, inputs, ports.tb3In, addLog, finishSync]); // `inputs` changes on (re)connect

  const syncFromTb3 = () => {
    if (!tb3Out || !(access && findInputByName(access, ports.tb3In))) {
      setSync({ kind: "error", message: "Choose the TB-3 input and output in MIDI settings" });
      return;
    }
    pending.current = new Map();
    setSync({ kind: "waiting", got: 0 });
    for (const b of PATCH_BLOCKS) tb3.send(rq1(b.addr, b.size));
    addLog(`TB-3 → RQ1 × ${PATCH_BLOCKS.length}`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const got = pending.current?.size ?? 0;
      pending.current = null;
      setSync({ kind: "error", message: `No reply from TB-3 (got ${got}/${PATCH_BLOCKS.length} blocks)` });
    }, SYNC_TIMEOUT_MS);
  };

  const sendAllToTb3 = (msgs: number[][]) => {
    if (!tb3Out) {
      setSync({ kind: "error", message: "Choose the TB-3 output in MIDI settings" });
      return;
    }
    msgs.forEach(tb3.send);
    addLog(`TB-3 → DT1 × ${msgs.length}`);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    access,
    error,
    inputs,
    outputs,
    ports,
    choosePort,
    channel,
    setChannel,
    log,
    sync,
    connected: Boolean(tb3Out),
    tb3,
    syncFromTb3,
    sendAllToTb3,
  };
}

export type Tb3Midi = ReturnType<typeof useTb3Midi>;
