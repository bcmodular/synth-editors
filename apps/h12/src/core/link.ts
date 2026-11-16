// Talking to the H12 one request at a time: send on an output ("lane"), wait for the matching answer on any of the
// H12's inputs. Finding the SysEx port is the first use (docs/h12-spec.md › Constraints › SysEx port): the firmware
// status request goes to each H12 output in turn, and the first one answered is the H12's own port. Independent of
// Web MIDI, so it runs under vitest; hub/useHub.ts connects it to real ports.

import { Status } from "./status";
import { Command, parseAnswer, readStatus, type Answer } from "./sysex";

export interface Lane {
  name: string;
  send(data: number[]): void;
}

// Subscribes to every H12 input; returns an unsubscribe.
export type Listen = (onMessage: (data: number[], input: string) => void) => () => void;

export interface Reply {
  answer: Answer;
  input: string; // the input it arrived on
}

export const PROBE_MS = 400;
export const REPLY_MS = 1000;

const BODY = 6;
const STATUS_WITH_INDEX_LENGTH = 11;

// The index a request asks about, when its answer carries one in byte 9.
function requestIndex(request: readonly number[]): number | undefined {
  if (request[BODY] === Command.readSetting) return request[BODY + 3];
  return request.length === STATUS_WITH_INDEX_LENGTH ? request[BODY + 2] : undefined;
}

export function answers(request: readonly number[], answer: Answer): boolean {
  if (answer.command !== request[BODY]) return false;
  if (answer.kind !== "answer") return true; // an error or corrupt answer to the same command
  const index = requestIndex(request);
  return answer.id === request[BODY + 1] && (index === undefined || answer.bytes[9] === index);
}

// Sends one request and resolves with its answer, or undefined if none comes within timeoutMs.
export function ask(lane: Lane, listen: Listen, request: number[], timeoutMs = REPLY_MS): Promise<Reply | undefined> {
  return new Promise((resolve) => {
    let stop = () => undefined as void;
    const timer = setTimeout(() => done(undefined), timeoutMs);
    const done = (reply: Reply | undefined) => {
      clearTimeout(timer);
      stop();
      resolve(reply);
    };
    stop = listen((data, input) => {
      const answer = parseAnswer(data);
      if (answer && answers(request, answer)) done({ answer, input });
    });
    lane.send(request);
  });
}

export type Probe =
  | { kind: "found"; lane: Lane; reply: Reply }
  | { kind: "silent"; tried: string[] }; // no H12 output answered

// Natural order, so "Port 2" comes before "Port 10" and virtual cable 1 (the expected answerer) is asked first.
export const byName = (a: Lane, b: Lane): number => a.name.localeCompare(b.name, undefined, { numeric: true });

// Asks each output in turn and stops at the first answer, so as little SysEx as possible goes down other lanes.
export async function findSysexPort(lanes: Lane[], listen: Listen, isCancelled = () => false): Promise<Probe> {
  const tried: string[] = [];
  for (const lane of [...lanes].sort(byName)) {
    if (isCancelled()) break;
    tried.push(lane.name);
    const reply = await ask(lane, listen, readStatus(Status.firmware), PROBE_MS);
    if (reply) return { kind: "found", lane, reply };
  }
  return { kind: "silent", tried };
}
