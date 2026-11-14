// The spike's MIDI link: chosen ports (remembered by name), device ID and channel, a timed log of everything sent
// and received, and a subscription to incoming SysEx.

import { findInputByName, findOutputByName, isSysex, listInputs, listOutputs, requestMidi, toHex, type PortInfo } from "@synth-editors/midi";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_DEVICE_ID } from "../core/sysex";

export interface LogLine {
  t: number; // ms since the app started
  text: string;
}

export type SysexListener = (msg: number[], t: number) => void;

const MAX_LOG = 400;

function useStored(key: string, initial: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? initial);
  const set = useCallback((v: string) => {
    localStorage.setItem(key, v);
    setValue(v);
  }, [key]);
  return [value, set];
}

function useMidiAccess(note: (text: string) => void) {
  const [access, setAccess] = useState<MIDIAccess>();
  const [inputs, setInputs] = useState<PortInfo[]>([]);
  const [outputs, setOutputs] = useState<PortInfo[]>([]);
  useEffect(() => {
    requestMidi().then((a) => {
      const refresh = () => {
        setInputs(listInputs(a));
        setOutputs(listOutputs(a));
      };
      setAccess(a);
      refresh();
      a.onstatechange = refresh;
    }).catch((e: unknown) => note(`MIDI unavailable: ${String(e)}`));
  }, [note]);
  return { access, inputs, outputs };
}

export function useJvLink() {
  const [log, setLog] = useState<LogLine[]>([]);
  const note = useCallback((text: string) => {
    setLog((l) => [...l.slice(-(MAX_LOG - 1)), { t: performance.now(), text }]);
  }, []);
  const { access, inputs, outputs } = useMidiAccess(note);
  const [outName, setOutName] = useStored("jv2080.out", "");
  const [inName, setInName] = useStored("jv2080.in", "");
  const [deviceText, setDevice] = useStored("jv2080.device", String(DEFAULT_DEVICE_ID));
  const [channelText, setChannel] = useStored("jv2080.channel", "0");
  const listeners = useRef(new Set<SysexListener>());

  useEffect(() => {
    const input = access && findInputByName(access, inName);
    if (!input) return;
    input.onmidimessage = (e) => {
      const bytes = Array.from(e.data ?? []);
      if (!isSysex(bytes)) return;
      note(`in  ${bytes.length} B: ${toHex(bytes)}`);
      for (const fn of listeners.current) fn(bytes, e.timeStamp);
    };
    return () => {
      input.onmidimessage = null;
    };
  }, [access, inName, note]);

  const send = useCallback((bytes: number[], label: string) => {
    const out = access && findOutputByName(access, outName);
    note(`out ${label}: ${toHex(bytes)}${out ? "" : "  (no output chosen, not sent)"}`);
    out?.send(bytes);
  }, [access, outName, note]);

  const subscribe = useCallback((fn: SysexListener) => {
    listeners.current.add(fn);
    return () => void listeners.current.delete(fn);
  }, []);

  return {
    inputs, outputs, outName, setOutName, inName, setInName,
    device: Number(deviceText), setDevice: (d: number) => setDevice(String(d)),
    channel: Number(channelText), setChannel: (c: number) => setChannel(String(c)),
    log, note, clearLog: () => setLog([]), send, subscribe,
  };
}

export type JvLink = ReturnType<typeof useJvLink>;
