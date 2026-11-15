// Inside a help panel's copy of a section, a control lights up while the help points at its parameters (and
// pointing at it points at them). Outside a help panel it's left as it is.

import type { ReactNode } from "react";
import { hotProps, useHot } from "./hot";

// `grow` for a control that fills its row (an envelope graph), so the wrapper does too.
export function Lit({ ids, grow, children }: { ids: readonly string[]; grow?: boolean; children: ReactNode }) {
  const hot = useHot();
  if (!hot.active) return <>{children}</>;
  return <div {...hotProps(hot, ids, grow ? "hot-ctl grow" : "hot-ctl")}>{children}</div>;
}
