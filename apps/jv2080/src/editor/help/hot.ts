// The parameters being pointed at in a help panel (its list or its flow), shared with the copy of the section beside
// it, so the matching controls light up; pointing at a control there lights up the help. `active` only inside a
// help panel, so the editor's own sections are drawn as they are.

import { createContext, useContext } from "react";

export interface Hot {
  active: boolean;
  hot: ReadonlySet<string>;
  hover: (names: readonly string[]) => void;
}

const NOBODY: Hot = { active: false, hot: new Set(), hover: () => {} };

export const HotContext = createContext<Hot>(NOBODY);

export const useHot = () => useContext(HotContext);

// Props for an element standing for `names`: lit while any is pointed at, pointing at it points at them.
export function hotProps({ hot, hover }: Hot, names: readonly string[], className: string) {
  const lit = names.some((n) => hot.has(n));
  return {
    className: `${className} ${lit ? "hot" : ""}`,
    onPointerEnter: () => hover(names),
    onPointerLeave: () => hover([]),
  };
}
