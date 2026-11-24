// Routing, outputs and scenes (firmware 4): addresses, and the values they take as data tables
// (docs/x32-osc-reference.md §1, §2, §8). Loaded by the fake desk under plain Node, hence the .ts import.

import { p, pad2, type Param } from "./addresses.ts";

// Logical outputs: main = Outputs 1-16 (1-8 are the Rack's XLR outs), aux = aux outs 1-6, p16 = the P16 outputs.
export type OutputKind = "main" | "aux" | "p16";
export const OUTPUT_COUNT: Record<OutputKind, number> = { main: 16, aux: 6, p16: 16 };

export interface Logical {
  kind: OutputKind;
  n: number;
}

export const output = (o: Logical): Param => p(`/outputs/${o.kind}/${pad2(o.n)}/src`, "i");
// Where an output taps its source (OUTPUT_POS).
export const outputPos = (o: Logical): Param => p(`/outputs/${o.kind}/${pad2(o.n)}/pos`, "i");

// 8-channel routing blocks, and user routing slots.
export const IN_BLOCKS = ["1-8", "9-16", "17-24", "25-32"] as const;
export type Block = (typeof IN_BLOCKS)[number];
export const routingIn = (block: Block): Param => p(`/config/routing/IN/${block}`, "i");
export const routingCard = (block: Block): Param => p(`/config/routing/CARD/${block}`, "i");
export const USER_IN_SLOTS = 32;
export const USER_OUT_SLOTS = 48;
export const userIn = (n: number): Param => p(`/config/userrout/in/${pad2(n)}`, "i");
export const userOut = (n: number): Param => p(`/config/userrout/out/${pad2(n)}`, "i");

// Scenes 0-99.
export const SCENE_SLOTS = 100;
export const scene = (n: number) => {
  const base = `/-show/showfile/scene/${String(n).padStart(3, "0")}`;
  return { name: p(`${base}/name`, "s"), hasdata: p(`${base}/hasdata`, "i") };
};
export const SAVE = "/save";

// Snippets 0-99: what each holds is set by its filters (bitmaps), which /save reads (Maillot p. 47-48, 50).
export const snippet = (n: number) => {
  const base = `/-show/showfile/snippet/${String(n).padStart(3, "0")}`;
  return {
    name: p(`${base}/name`, "s"), hasdata: p(`${base}/hasdata`, "i"),
    eventtyp: p(`${base}/eventtyp`, "i"), channels: p(`${base}/channels`, "i"), auxbuses: p(`${base}/auxbuses`, "i"),
    maingrps: p(`${base}/maingrps`, "i"),
  };
};
export const LOAD = "/load";

// The desk's FX library: /-libs/fx/001-100. A preset's index in /load is its number less one.
export const FX_LIBRARY_SIZE = 100;
export const libFx = (n: number) => {
  const base = `/-libs/fx/${String(n).padStart(3, "0")}`;
  return { name: p(`${base}/name`, "s"), hasdata: p(`${base}/hasdata`, "i") };
};

// User routing sources (`/config/userrout/in|out/NN`): base + n. Outputs, P16 and aux outs are for out slots only.
export const USER_SOURCE = { local: 0, card: 128, aux: 160, outputs: 168, p16: 184, auxOut: 200 } as const;

// `/config/routing/IN/…` blocks reading user-in slots 1-8 … 25-32.
export const IN_USER_BLOCK: Record<Block, number> = { "1-8": 20, "9-16": 21, "17-24": 22, "25-32": 23 };
// `/config/routing/CARD/…`: P16 1-8 and 9-16, or user-out slots 17-24 and 25-32.
export const CARD_FROM_P16 = { "1-8": 22, "9-16": 23 } as const;
export const CARD_FROM_USER_OUT = { "17-24": 28, "25-32": 29 } as const;

// `/outputs/…/src`: fixed values, and bases to add a number to (mix bus n = 3 + n, ch n direct out = 25 + n, …).
export const OUTPUT_SOURCE = { off: 0, mainL: 1, mainR: 2, bus: 3, directCh: 25, directAux: 57, directFxrtn: 65 } as const;
// `/outputs/…/pos`: 6 = pre-fader, 8 = post-fader.
export const OUTPUT_POS = { pre: 6, post: 8 } as const;
