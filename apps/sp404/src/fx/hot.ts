// The parameters being pointed at in an effect's help panel, shared with the copy of the module beside it: pointing
// at a help row lights up the matching controls, and pointing at a control lights up its row. `active` only inside a
// help panel, so the FX row's own modules are drawn as they are. As the JV-2080 editor's help does.

import { createContext, useContext } from "react";

export interface Hot {
  active: boolean;
  hot: ReadonlySet<string>; // parameter keys (core/effects.ts)
  hover: (keys: readonly string[]) => void;
}

const NOBODY: Hot = { active: false, hot: new Set(), hover: () => {} };

export const HotContext = createContext<Hot>(NOBODY);

export const useHot = () => useContext(HotContext);

// Props for an element standing for `keys`: lit while any is pointed at, pointing at it points at them. Outside a help
// panel, just the class.
export function hotProps({ active, hot, hover }: Hot, keys: readonly string[], className: string) {
  if (!active || keys.length === 0) return { className };
  const lit = keys.some((k) => hot.has(k));
  return {
    className: `${className} hot-ctl ${lit ? "hot" : ""}`,
    onPointerEnter: () => hover(keys),
    onPointerLeave: () => hover([]),
  };
}

// For an SVG part of a drawing (a handle, a bar): lit while any of `keys` is pointed at; no ring or tint of its own,
// the drawing's styles show it (.hdl.hot, .bar.hot).
export function hotSvgProps({ active, hot, hover }: Hot, keys: readonly string[], className: string) {
  if (!active || keys.length === 0) return { className };
  return {
    className: `${className} ${keys.some((k) => hot.has(k)) ? "hot" : ""}`,
    onPointerEnter: () => hover(keys),
    onPointerLeave: () => hover([]),
  };
}

// The effect's parameter keys in order, for drawings that know their parameters by index (a handle's drag).
export const ParamKeysContext = createContext<readonly string[]>([]);
