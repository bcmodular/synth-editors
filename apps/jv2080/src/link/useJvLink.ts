// The MIDI link to the JV: chosen ports (remembered by name), device ID and patch channel, and a subscription to
// incoming SysEx. Everything sent and received is logged to the console (console.debug, "Verbose" in DevTools).

import { findInputByName, findOutputByName, isSysex, listInputs, listOutputs, requestMidi, toHex, type PortInfo } from "@synth-editors/midi";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_DEVICE_ID } from "../core/sysex";

export type SysexListener = (msg: number[], t: number) => void;

function useStored(key: string, initial: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? initial);
  const set = useCallback((v: string) => {
    localStorage.setItem(key, v);
    setValue(v);
  }, [key]);
  return [value, set];
}

function useMidiAccess() {
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
    }).catch((e: unknown) => console.error("MIDI unavailable:", e));
  }, []);
  return { access, inputs, outputs };
}

export function useJvLink() {
  const note = useCallback((text: string) => console.debug(`[jv ${performance.now().toFixed(0)} ms] ${text}`), []);
  const { access, inputs, outputs } = useMidiAccess();
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
    note, send, subscribe,
  };
}

export type JvLink = ReturnType<typeof useJvLink>;
