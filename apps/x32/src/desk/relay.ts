// The UDP relay in the main process (electron/main.cjs, exposed by preload.cjs), as a transport for DeskClient.

import type { Transport } from "../core/client";
import { foundDesks, XINFO, type DiscoveryReply, type FoundDesk } from "../core/discovery";

interface X32Bridge {
  host(): Promise<string>;
  setHost(text: string): Promise<string | null>;
  discover(query: Uint8Array): Promise<DiscoveryReply[]>;
  send(bytes: Uint8Array): void;
  onMessage(listener: (bytes: Uint8Array) => void): () => void;
}

declare global {
  interface Window {
    x32: X32Bridge;
  }
}

export const relay: Transport = {
  send: (bytes) => window.x32.send(bytes),
  onMessage: (listener) => window.x32.onMessage(listener),
};

export const deskHost = (): Promise<string> => window.x32.host();
// The address the app will talk to, as "host:port", or null if it wasn't accepted.
export const setDeskHost = (text: string): Promise<string | null> => window.x32.setHost(text);
// Every desk that answers a broadcast on the local network.
export const findDesks = async (): Promise<FoundDesk[]> => foundDesks(await window.x32.discover(XINFO));
