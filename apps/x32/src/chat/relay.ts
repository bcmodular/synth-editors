// The Claude relay and chat log in the main process (electron/main.cjs, exposed by preload.cjs). The API key stays
// there; this side only sends requests and gets messages back.

import type { Create } from "../core/agent";
import type { ChatEntry } from "../core/chatLog";

export interface ClaudeStatus {
  ready: boolean;
  problem: "no-key" | null;
  model: string;
  keychain: { service: string; account: string };
}

interface ClaudeBridge {
  status(): Promise<ClaudeStatus>;
  create: Create;
  log(entry: ChatEntry): Promise<void>;
}

declare global {
  interface Window {
    claude: ClaudeBridge;
  }
}

export const claudeStatus = (): Promise<ClaudeStatus> => window.claude.status();
export const createMessage: Create = (request) => window.claude.create(request);
export const logChat = (entry: ChatEntry): Promise<void> => window.claude.log(entry);
