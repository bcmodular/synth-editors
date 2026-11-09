// Phase 0 serial session: connect over Web Serial, poll status, read pad blocks, set pad values. Read-only
// commands and set-parameter only; nothing that changes the project's contents.

import { useCallback, useEffect, useRef, useState } from "react";
import type { MixField } from "../core/mixer";
import { BANK_COUNT, PADS_PER_BANK } from "../core/padNotes";
import { CHANNEL_CONTROL, longFrame, shortFrame } from "../core/serialFrames";
import {
  bankVolumeFrame, mixChangeFrame, parsePadBlock, parseStatus, readPadFrame, statusFrame, type DeviceStatus,
  type PadBlock,
} from "../core/serialMessages";
import { choosePort, openSp404 } from "../serial/openPort";
import { CaptureLog } from "./captureLog";
import { SerialLink } from "../serial/serialLink";

const POLL_MS = 500;
// Raw sends are limited to commands that read, or set one parameter: 01 set, 9E pad, FE status, FD project.
const RAW_ALLOWED = new Set([0x01, 0x9e, 0xfe, 0xfd]);

async function openPort(): Promise<SerialPort> {
  return openSp404(await choosePort());
}

function parseHex(text: string): number[] {
  const bytes = text.trim().split(/[\s,]+/).filter(Boolean).map((h) => parseInt(h, 16));
  if (bytes.some((b) => !(b >= 0 && b <= 255))) throw new Error(`Not hex bytes: ${text}`);
  return bytes;
}

export function useSerial() {
  const [, setTick] = useState(0);
  const log = useRef(new CaptureLog(() => setTick((t) => t + 1))).current;
  const link = useRef<SerialLink | null>(null);
  const port = useRef<SerialPort | null>(null);
  const [connected, setConnected] = useState(false);
  const [polling, setPolling] = useState(false);
  const [status, setStatus] = useState<DeviceStatus>();
  const [pads, setPads] = useState<PadBlock[]>([]);
  const [error, setError] = useState<string>();

  const run = useCallback(async (task: () => Promise<void>) => {
    setError(undefined);
    await task().catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      log.note(`error: ${message}`);
    });
  }, [log]);

  // One capture file per app run, started before anything is sent (MIDI notes go in it too).
  const [file, setFile] = useState<string>();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void log.start().then(setFile);
  }, [log]);

  const note = useCallback((text: string) => log.note(text), [log]);

  const connect = () => run(async () => {
    port.current = await openPort();
    const { readable, writable } = port.current;
    if (!readable || !writable) throw new Error("Port opened without streams");
    link.current = new SerialLink({ readable, writable }, (d, b) => log.bytes(d, b));
    log.note(`connected; capture file ${file ?? "(none: not in Electron)"}`);
    setConnected(true);
  });

  const disconnect = () => run(async () => {
    setPolling(false);
    await link.current?.close();
    await port.current?.close();
    link.current = port.current = null;
    log.note("disconnected");
    setConnected(false);
  });

  const pollOnce = useCallback(async () => {
    const reply = await link.current?.request(statusFrame(), parseStatus);
    if (reply) setStatus(reply);
  }, []);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => void pollOnce(), POLL_MS);
    return () => clearInterval(id);
  }, [polling, pollOnce]);

  const readPads = () => run(async () => {
    log.note("reading all pads");
    const found: PadBlock[] = [];
    for (let pad = 0; pad < BANK_COUNT * PADS_PER_BANK; pad++) {
      const block = await link.current?.request(readPadFrame(pad), (f) => {
        const b = parsePadBlock(f);
        return b?.pad === pad ? b : undefined;
      });
      if (block && !block.empty) found.push(block);
      if (!block) log.note(`no reply for pad ${pad}`);
    }
    setPads(found);
    log.note(`read pads: ${found.length} loaded`);
  });

  const setPadValue = (pad: number, field: MixField, value: number) => run(async () => {
    log.note(`set pad ${pad} ${field} = ${value}`);
    await link.current?.send(mixChangeFrame({ pad, field, value }));
  });

  const setBankVolume = (bank: number, volume: number) => run(async () => {
    log.note(`set bank ${bank} volume = ${volume}`);
    await link.current?.send(bankVolumeFrame(bank, volume));
  });

  const sendRaw = (text: string, long: boolean) => run(async () => {
    const bytes = parseHex(text);
    if (!RAW_ALLOWED.has(bytes[0] ?? -1)) throw new Error("Only 01, 9E, FE and FD commands can be sent raw");
    log.note(`raw ${long ? "long" : "short"}: ${text}`);
    await link.current?.send(long ? longFrame(CHANNEL_CONTROL, bytes) : shortFrame(CHANNEL_CONTROL, bytes));
  });

  return {
    connected, polling, status, pads, error, file, lines: log.lines, note,
    connect, disconnect, readPads, setPadValue, setBankVolume, sendRaw,
    setPolling, pollOnce: () => run(pollOnce),
    reveal: () => void window.sp404Capture?.reveal(),
  };
}

export type SerialSession = ReturnType<typeof useSerial>;
