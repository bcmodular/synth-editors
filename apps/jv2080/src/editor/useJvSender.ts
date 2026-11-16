// What goes to the JV, and what it holds. The JV has one temporary patch; `held` is our idea of it. A new patch
// (recall, undo, a file, an audition) goes as only the bytes that differ from what it holds (core/diff), paced, one
// patch after another; single edits go through the edit queue, coalesced per address. With `offline` (demo mode)
// nothing is sent.
import { useCallback, useMemo, useRef } from "react";
import { diffPatch } from "../core/diff";
import { paramAddress, paramDt1, patchToDt1s, type Patch } from "../core/patch";
import type { ParamDef } from "../core/params";
import { addrHex } from "../core/sysex";
import { sendPaced } from "../link/readPatch";
import type { JvLink } from "../link/useJvLink";
import { createEditQueue } from "./editQueue";

export function useJvSender(link: JvLink, offline: boolean) {
  const { device } = link;
  const held = useRef<Patch | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const send = useMemo(() => (offline ? () => {} : link.send), [offline, link.send]);
  const queue = useMemo(() => createEditQueue((msg) => send(msg, "DT1 edit")), [send]);

  // Bulk sends go one after another, so two patches' bytes never interleave.
  const sendBulk = useCallback((messages: number[][], label: string) => {
    if (offline || !messages.length) return chain.current;
    chain.current = chain.current.then(() => sendPaced({ send }, messages, label));
    return chain.current;
  }, [offline, send]);

  const sendPatch = useCallback((p: Patch) => {
    const messages = held.current ? diffPatch(held.current, p, device) : patchToDt1s(p, device);
    held.current = p;
    void sendBulk(messages, "DT1 patch");
  }, [device, sendBulk]);

  // The whole patch, whatever the JV is thought to hold (SYNC TO JV).
  const sendWhole = useCallback((p: Patch) => {
    held.current = p;
    return sendBulk(patchToDt1s(p, device), "DT1 patch");
  }, [device, sendBulk]);

  // One edit already applied to the patch (`after`): its DT1, coalesced by `key`.
  const sendEdit = useCallback((after: Patch, key: string, msg: number[]) => {
    held.current = after;
    queue.push(key, msg);
  }, [queue]);

  // A value to the JV only, the patch unchanged (solo, auditioning a wave).
  const sendParam = useCallback((p: ParamDef, value: number, tone = 0) => {
    queue.push(addrHex(paramAddress(p, tone)), paramDt1(p, value, tone, device));
  }, [queue, device]);

  // The JV is known to hold `p` (read from it, or changed on its panel).
  const holds = useCallback((p: Patch) => {
    held.current = p;
  }, []);

  return { send, sendPatch, sendWhole, sendEdit, sendParam, holds };
}

export type JvSender = ReturnType<typeof useJvSender>;
