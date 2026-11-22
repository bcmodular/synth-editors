// The fake desk as the real X32 Rack came out of the box (read 22 Nov 2026, fw 4.15), for testing setup from the rig
// file: default bus names, XLR outs 1-6 carrying buses 1-6 and 7-8 the main mix, FX 1-4 fed by buses 13-16, and send
// tap points EQ-> on buses 1-8 and post on 9-16.

import { config, fx, send, strip, STRIP_COUNT, type StripKind } from "../src/core/addresses.ts";
import { output } from "../src/core/routing.ts";
import { blankDesk, numbers, put, type Values } from "./rig.ts";

const INPUTS: StripKind[] = ["ch", "auxin", "fxrtn"];

export function factoryDesk(): Values {
  const values = blankDesk();
  numbers(12).forEach((n) => put(values, config(strip("bus", n)).name, `MixBus ${n}`));
  numbers(4).forEach((n) => put(values, config(strip("bus", 12 + n)).name, `Fx ${n}`));
  [4, 5, 6, 7, 8, 9, 1, 2].forEach((src, i) => put(values, output({ kind: "main", n: i + 1 }), src));
  numbers(4).forEach((slot) => {
    put(values, fx(slot).source("l"), 12 + slot);
    put(values, fx(slot).source("r"), 12 + slot);
  });
  for (const kind of INPUTS) {
    numbers(STRIP_COUNT[kind]).forEach((n) => {
      for (let bus = 1; bus <= 15; bus += 2) put(values, send(strip(kind, n), bus).type, bus < 9 ? 2 : 4);
    });
  }
  put(values, config(strip("auxin", 7)).name, "USB L");
  put(values, config(strip("auxin", 8)).name, "USB R");
  return values;
}
