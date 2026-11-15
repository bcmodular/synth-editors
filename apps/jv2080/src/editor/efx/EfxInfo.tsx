// The (i) on the EFX section: help for the current EFX type (core/efxHelp), with its signal flow and each
// parameter's current value, beside a working copy of the EFX section (`side`), so the effect can be edited, or its
// type changed, while reading about it.

import type { ReactNode } from "react";
import { EFX_GENERAL_NOTE, efxHelp, paramHelp } from "../../core/efxHelp";
import type { EfxParamDef } from "../../core/efx";
import { HelpButton, type HelpContent } from "../help/HelpPanel";
import { useEfx } from "./useEfx";

// A parameter's range as the panel shows it; a long list as its first and last entries.
const rangeOf = (p: EfxParamDef) => (p.labels && p.labels.length > 6 ? `${p.labels[0]}…${p.labels[p.labels.length - 1]}` : p.range);

function useEfxContent(): HelpContent {
  const { type, typeRaw, params, get } = useEfx();
  const help = efxHelp(typeRaw);
  return {
    title: type?.name ?? "EFX",
    summary: help?.summary ?? "",
    rows: params.map((x) => ({ label: x.p.name, ids: [x.p.name], text: paramHelp(typeRaw, x.p.name) ?? "", value: x.text, range: rangeOf(x.p) })),
    notes: [...(help?.notes ?? []), EFX_GENERAL_NOTE],
    flow: help?.flow,
    get,
  };
}

const EFX_SIDE = { width: 560, height: 440 };

export function EfxInfoButton({ side }: { side: ReactNode }) {
  return <HelpButton label="this effect" useContent={useEfxContent} side={side} sideStyle={EFX_SIDE} />;
}
