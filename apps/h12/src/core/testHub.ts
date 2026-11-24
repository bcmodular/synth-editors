// A stateful fake H12 for the unit tests: keeps settings, answers reads and writes as the hub does, and records
// every request.

import type { Io } from "./switcher";
import { checksum, Command, decodeWord, encodeWord, HEADER, HUB, Setting, WORD_BYTES } from "./sysex";

export interface TestHubInit {
  preset?: number;
  settings?: Record<string, number[]>; // "setting:index" → words
  failWrite?: string; // "setting:index" answered with error 0x7C
  garble?: string; // "setting:index" stores a different value from the one written
}

const frame = (body: number[]) => [...HEADER, HUB, ...body, checksum(body), 0xf7];
// A mapper never written reads as the factory one, with firmware 4.x's init byte 5A.
export const FACTORY_MAPPER = [0x7f007f00, 0x7f007f00, 0x00f00f0f, 0x5a000187, 0, 0];
const SIZES: Record<number, number> = { [Setting.routing]: 1, [Setting.messageFilter]: 1, [Setting.mapper]: 6,
  [Setting.currentPreset]: 1 };

export function testHub(init: TestHubInit = {}) {
  const settings = new Map(Object.entries(init.settings ?? {}));
  settings.set(`${Setting.currentPreset}:0`, [init.preset ?? 0]);
  const sent: number[][] = [];
  const listeners = new Set<(data: number[], input: string) => void>();

  const read = (id: number, index: number) => {
    const words = settings.get(`${id}:${index}`)
      ?? (id === Setting.mapper ? FACTORY_MAPPER : new Array<number>(SIZES[id] ?? 1).fill(0));
    return frame([0x42, id, words.length, index, ...words.flatMap(encodeWord)]);
  };
  const write = (d: number[]) => {
    const [id, size, index] = [d[7]!, d[8]!, d[9]!];
    const key = `${id}:${index}`;
    if (key === init.failWrite) return frame([0x43, 0x7c]);
    const words = Array.from({ length: size }, (_, i) => decodeWord(d, 10 + i * WORD_BYTES));
    settings.set(key, key === init.garble ? words.map((w) => w ^ 1) : words);
    return frame([0x43, id, 0, index]);
  };
  const answer = (d: number[]) => (d[6] === Command.writeSetting ? write(d) : read(d[7]!, d[9]!));

  const io: Io = {
    lane: { name: "H12MIDI-Pro Port 1", send: (d) => {
      sent.push(d);
      const a = answer(d);
      queueMicrotask(() => listeners.forEach((fn) => fn(a, "H12MIDI-Pro Port 1")));
    } },
    listen: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const writes = () => sent.filter((d) => d[6] === Command.writeSetting).map((d) => `${d[7]}:${d[9]}`);
  return { io, settings, sent, writes };
}
