// The pad mixer's link to the SP-404: loads the current project (settings and every pad block), polls status,
// reloads when the project changes, re-reads the selected pad (when it changes, and every few polls, to pick up edits
// made on the device), and drains
// a coalescing write queue. Plain TypeScript over a SerialLink so it can be tested with fake streams.

import { BANK_COUNT, PADS_PER_BANK } from "../core/padNotes";
import { SendQueue } from "../core/sendQueue";
import type { Frame } from "../core/serialFrames";
import {
  parsePadBlock, parseStatus, readPadFrame, selectedPadNumber, statusFrame, type DeviceStatus, type PadBlock,
} from "../core/serialMessages";
import { parseProjectNotice, parseProjectSettings, projectSettingsFrame } from "../core/serialProject";
import type { SerialLink } from "../serial/serialLink";

// Fast enough to catch short hits; each poll is 12 bytes out and 35 back.
export const POLL_MS = 150;
// A settings frame from the device can carry bank volumes from before the user's last move; ignore them a while.
// The same goes for re-reading a pad the app has just changed.
const LOCAL_EDIT_HOLD_MS = 1500;
// Edits on the device go to the selected pad; re-read it every this many polls (about half a second).
export const REREAD_EVERY = 3;
const PAD_COUNT = BANK_COUNT * PADS_PER_BANK;

export interface DeviceState {
  loading: boolean;
  project?: number; // 0-based
  projectName: string;
  pads: PadBlock[]; // loaded pads only, in pad order
  bankVolumes: number[];
  status?: DeviceStatus;
  // The latest pad hit seen on the device; `seq` counts hits so the same pad hit twice still shows.
  hit?: { pad: number; seq: number };
}

// Whether a pad was hit between two polls. Hitting a pad selects it and restarts its frame count, so a hit shows as
// a new selection, a pad starting to sound, or the count going backwards (a short sound can be over by the poll).
export function wasHit(before: DeviceStatus | undefined, after: DeviceStatus): boolean {
  if (!before || after.mode !== 0) return false; // a playing pattern restarts the count without a hand hit
  if (selectedPadNumber(before) !== selectedPadNumber(after)) return true;
  if (after.playingFrames === undefined) return false;
  return before.playingFrames === undefined || after.playingFrames < before.playingFrames;
}

export const emptyDeviceState = (): DeviceState => ({
  loading: true, projectName: "", pads: [], bankVolumes: Array<number>(BANK_COUNT).fill(127),
});

const replace = (pads: PadBlock[], block: PadBlock): PadBlock[] =>
  [...pads.filter((p) => p.pad !== block.pad), ...(block.empty ? [] : [block])].sort((a, b) => a.pad - b.pad);

export class Sp404Session {
  private state = emptyDeviceState();
  private readonly queue = new SendQueue<Uint8Array>();
  private draining = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private loadingProject: Promise<void> | undefined;
  private bankEditAt = -Infinity;
  private readonly padEditAt = new Map<number, number>();
  private polls = 0;
  private readonly unlisten: () => void;

  constructor(private readonly link: SerialLink, private readonly onChange: (s: DeviceState) => void) {
    this.unlisten = link.onFrame((f) => this.onFrame(f));
  }

  async start(): Promise<void> {
    await this.load();
    this.timer = setInterval(() => void this.poll(), POLL_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.unlisten();
    this.queue.clear();
  }

  // Queue a write; a newer one with the same key (e.g. "level:12") replaces it if it hasn't gone yet.
  send(key: string, frame: Uint8Array): void {
    this.queue.put(key, frame);
    void this.drain();
  }

  // Apply a pad's new values locally, so the next status poll or re-read doesn't fight the user's edit.
  notePad(block: PadBlock): void {
    this.padEditAt.set(block.pad, Date.now());
    this.update({ pads: replace(this.state.pads, block) });
  }

  noteBankVolume(bank: number, volume: number): void {
    this.bankEditAt = Date.now();
    this.update({ bankVolumes: this.state.bankVolumes.map((v, i) => (i === bank ? volume : v)) });
  }

  load(): Promise<void> {
    this.loadingProject ??= this.loadProject().finally(() => (this.loadingProject = undefined));
    return this.loadingProject;
  }

  private update(patch: Partial<DeviceState>): void {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    for (let frame = this.queue.take(); frame; frame = this.queue.take()) await this.link.send(frame);
    this.draining = false;
  }

  private async readPad(pad: number): Promise<PadBlock | undefined> {
    return this.link.request(readPadFrame(pad), (f) => {
      const block = parsePadBlock(f);
      return block?.pad === pad ? block : undefined;
    });
  }

  private async loadProject(): Promise<void> {
    this.update({ loading: true });
    const status = await this.link.request(statusFrame(), parseStatus);
    const project = status?.project ?? 0;
    const settings = await this.link.request(projectSettingsFrame(project), parseProjectSettings);
    const pads: PadBlock[] = [];
    for (let pad = 0; pad < PAD_COUNT; pad++) {
      const block = await this.readPad(pad);
      if (block && !block.empty) pads.push(block);
    }
    this.update({
      loading: false, project, status, pads,
      projectName: settings?.name ?? "",
      bankVolumes: settings?.bankVolumes ?? this.state.bankVolumes,
    });
  }

  private async poll(): Promise<void> {
    if (this.loadingProject) return;
    const status = await this.link.request(statusFrame(), parseStatus);
    if (!status) return;
    const before = this.state.status;
    this.update({ status, hit: this.hitAfter(before, status) });
    if (status.project !== this.state.project) return void this.load();
    const pad = selectedPadNumber(status);
    if (this.dueForReread(before, pad)) await this.refreshPad(pad);
  }

  private hitAfter(before: DeviceStatus | undefined, status: DeviceStatus): DeviceState["hit"] {
    if (!wasHit(before, status)) return this.state.hit;
    return { pad: selectedPadNumber(status), seq: (this.state.hit?.seq ?? 0) + 1 };
  }

  // When the selection changes, and every few polls unless the app changed the pad itself a moment ago (the device
  // may not have caught up).
  private dueForReread(before: DeviceStatus | undefined, pad: number): boolean {
    this.polls = (this.polls + 1) % REREAD_EVERY;
    if (before !== undefined && selectedPadNumber(before) !== pad) return true;
    return this.polls === 0 && Date.now() - (this.padEditAt.get(pad) ?? -Infinity) > LOCAL_EDIT_HOLD_MS;
  }

  // A reading taken while the app was changing the pad is out of date; keep the app's values.
  private async refreshPad(pad: number): Promise<void> {
    const asked = Date.now();
    const block = await this.readPad(pad);
    if (block && (this.padEditAt.get(pad) ?? -Infinity) < asked) this.update({ pads: replace(this.state.pads, block) });
  }

  private isCurrentProject(project: number): boolean {
    return project === this.state.project && !this.loadingProject;
  }

  // The device announces project changes and pad edits (1A), and sends its settings (7D) when banks change.
  private onFrame(frame: Frame): void {
    const notice = parseProjectNotice(frame);
    if (notice !== undefined && !this.loadingProject) void this.load();
    const settings = parseProjectSettings(frame);
    if (!settings || !this.isCurrentProject(settings.project)) return;
    const fresh = Date.now() - this.bankEditAt > LOCAL_EDIT_HOLD_MS;
    this.update({ projectName: settings.name, ...(fresh ? { bankVolumes: settings.bankVolumes } : {}) });
  }
}
