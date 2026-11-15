// The parameters being pointed at in a help panel (its rows), shared with the copy of the section beside it, so the
// matching controls light up; pointing at a control there lights up its row. `active` only inside a help panel, so the
// editor's own sections are drawn as they are. (After apps/jv2080/src/editor/help/hot.ts.)
import { createContext, useContext } from "react";

export interface Hot {
  active: boolean;
  hot: ReadonlySet<string>;
  hover: (ids: readonly string[]) => void;
}

const NOBODY: Hot = { active: false, hot: new Set(), hover: () => {} };

export const HotContext = createContext<Hot>(NOBODY);

export const useHot = () => useContext(HotContext);
