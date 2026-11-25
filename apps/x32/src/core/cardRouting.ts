// What reaches the DAW (Reaper) on each USB card output. A card output can only take a logical output (Outputs 1-16, P16 1-16,
// aux outs 1-6), each of which taps a source such as a channel's direct out. So card 1-16 go through P16 1-16, and
// card 17-32 through user-out slots 17-32, each pointing at a logical output the rig file doesn't already use for a
// bus (docs/x32-spec.md, open questions).

import {
  CARD_FROM_P16, CARD_FROM_USER_OUT, output, OUTPUT_POS, OUTPUT_SOURCE, outputPos, routingCard, userOut, USER_SOURCE,
  type Logical,
} from "./routing";
import { busOutputs, type CardSource, type RigCardOut, type RigFile } from "./rigFile";
import { at, outputLabel, type Target } from "./targets";

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
// Free logical outputs for card 17-32, in the order they're used: Outputs 9-16 (no socket on the Rack), then the
// spare XLR outs 5-8 and aux outs 3-5 (their sockets carry the same signal).
const POOL: Logical[] = [
  ...range(9, 16).map((n) => ({ kind: "main" as const, n })),
  ...range(5, 8).map((n) => ({ kind: "main" as const, n })),
  ...range(3, 5).map((n) => ({ kind: "aux" as const, n })),
];

const key = (o: Logical) => `${o.kind}${o.n}`;

const DIRECT_OUT_BASE = { ch: OUTPUT_SOURCE.directCh, auxin: OUTPUT_SOURCE.directAux, fxrtn: OUTPUT_SOURCE.directFxrtn };

function sourceValue(s: CardSource): number {
  if (s.kind === "main") return s.side === "L" ? OUTPUT_SOURCE.mainL : OUTPUT_SOURCE.mainR;
  return DIRECT_OUT_BASE[s.kind] + s.n;
}

const sourceName = (s: CardSource) => (s.kind === "main" ? `main ${s.side}` : `${s.kind === "auxin" ? "aux" : s.kind} ${s.n}`);

// A logical output set to carry one card output's source.
function feed(o: Logical, c: RigCardOut): Target[] {
  const where = outputLabel(o.kind, o.n);
  return [
    at("card", 5)(output(o), sourceValue(c.source), `${where} ← ${sourceName(c.source)} (for card ${c.card})`),
    at("card", 5)(outputPos(o), OUTPUT_POS[c.tap], `${where} taken ${c.tap}-fader`),
  ];
}

function p16Block(block: "1-8" | "9-16", byCard: Map<number, RigCardOut>): Target[] {
  const cards = block === "1-8" ? range(1, 8) : range(9, 16);
  if (!cards.some((n) => byCard.has(n))) return [];
  const feeds = cards.flatMap((n) => {
    const c = byCard.get(n);
    return c ? feed({ kind: "p16", n }, c) : [at("card", 5)(output({ kind: "p16", n }), 0, `P16 ${n} off (card ${n} unused)`)];
  });
  return [at("card", 5)(routingCard(block), CARD_FROM_P16[block], `card out ${block} ← P16 ${block}`), ...feeds];
}

function userOutBlock(first: 17 | 25, byCard: Map<number, RigCardOut>, pool: Logical[]): Target[] {
  const cards = range(first, first + 7);
  if (!cards.some((n) => byCard.has(n))) return [];
  const block = `${first}-${first + 7}` as "17-24" | "25-32";
  const slots = cards.flatMap((n) => {
    const c = byCard.get(n);
    if (!c) return [at("card", 5)(userOut(n), 0, `card out ${n} unused`)];
    const o = pool.shift();
    if (!o) throw new Error(`No free output left for card out ${n}: the desk has 31 for the card`);
    const value = (o.kind === "main" ? USER_SOURCE.outputs : USER_SOURCE.auxOut) + o.n;
    return [at("card", 5)(userOut(n), value, `card out ${n} ← ${outputLabel(o.kind, o.n)}`), ...feed(o, c)];
  });
  return [at("card", 5)(routingCard(block), CARD_FROM_USER_OUT[block], `card out ${block} ← user routing`), ...slots];
}

export function cardTargets(rig: RigFile): Target[] {
  const byCard = new Map(rig.cardOut.map((c) => [c.card, c]));
  const used = new Set(rig.buses.flatMap((b) => busOutputs(b).map(key)));
  const pool = POOL.filter((o) => !used.has(key(o)));
  return [
    ...p16Block("1-8", byCard), ...p16Block("9-16", byCard),
    ...userOutBlock(17, byCard, pool), ...userOutBlock(25, byCard, pool),
  ];
}
