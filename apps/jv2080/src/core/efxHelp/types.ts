// The help for one EFX type: what it does, tips, the parameters it describes in its own way (the rest come from
// common.ts) and its signal flow.

import type { Flow } from "./flow";

export interface EfxHelp {
  summary: string;
  notes?: readonly string[];
  params?: Readonly<Record<string, string>>;
  flow: Flow;
}
