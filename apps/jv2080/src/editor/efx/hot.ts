// The EFX parameters being pointed at in the help panel (its list or its flow), shared with the copy of the EFX
// section beside it, so the matching controls light up; pointing at a control there lights up the help.

import { createContext, useContext } from "react";

export interface EfxHot {
  hot: ReadonlySet<string>;
  hover: (names: readonly string[]) => void;
}

const NOBODY: EfxHot = { hot: new Set(), hover: () => {} };

export const EfxHotContext = createContext<EfxHot>(NOBODY);

export const useEfxHot = () => useContext(EfxHotContext);

// Props for an element standing for `names`: lit while any is pointed at, pointing at it points at them.
export function hotProps({ hot, hover }: EfxHot, names: readonly string[], className: string) {
  const lit = names.some((n) => hot.has(n));
  return {
    className: `${className} ${lit ? "hot" : ""}`,
    onPointerEnter: () => hover(names),
    onPointerLeave: () => hover([]),
  };
}
