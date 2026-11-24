// What the Reaper bridge script publishes and accepts. Mirrors apps/song-manager/reaper/SongManager/*.lua.

export type TrackInput =
  | { kind: "none" }
  | { kind: "midi"; port: string; channel: number } // port "all" = all MIDI inputs; channel 0 = all
  | { kind: "audio"; channel: number; stereo: boolean }; // channel is 1-based

export interface TrackState {
  guid: string;
  index: number; // 1-based position in Reaper
  name: string;
  part: string | null; // Song Manager part id, stored in the track's P_EXT:SongManager
  input: TrackInput;
  recordMode: number;
  monitor: number; // 0 off, 1 on, 2 not when playing
  midiOut: { port: string; channel: number } | null;
  noteFilter: number[] | null;
  arm: boolean;
  mute: boolean;
  solo: number; // 0 off, 1 solo, 2 solo in place, 5 and 6 safe solo
}

export interface BridgeState {
  tracks: TrackState[];
  playing: boolean;
  paused: boolean;
  recording: boolean;
  tempo: number;
  ports: { inputs: string[]; outputs: string[] };
}

type Track = { track: string }; // a track GUID

export type Command =
  | { type: "ping" }
  | { type: "get-state" }
  | { type: "create-track"; name?: string; part?: string; index?: number }
  | ({ type: "delete-track" } & Track)
  | ({ type: "set-name"; name: string } & Track)
  | ({ type: "set-part"; part: string | null } & Track)
  | ({ type: "set-input"; input: TrackInput } & Track)
  | ({ type: "set-monitor"; mode: 0 | 1 | 2 } & Track)
  | ({ type: "set-hw-midi-out"; port: string | null; channel?: number } & Track)
  | ({ type: "arm" | "mute" | "solo"; on: boolean } & Track)
  | ({ type: "set-note-filter"; notes: number[] | null } & Track)
  | { type: "notes-off"; port: string; channels?: number[] }
  | { type: "add-marker"; name: string; bar?: number; position?: number }
  | ({ type: "save-fx-chain" } & Track);

export interface CommandResult {
  id: string | null;
  ok: boolean;
  data?: unknown;
  error?: string;
}
