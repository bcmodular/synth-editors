// Inside a help panel's copy of a section, a control lights up while the help points at its parameters (and
// pointing at it points at them). Outside a help panel it's left as it is.

import type { ReactNode } from "react";
import { hotProps, useHot } from "./hot";

// `fit` for a control that stretches: "grow" fills its row (an envelope graph), "fill" its column (a fader), so the
// wrapper does too.
export function Lit({ ids, fit, children }: { ids: readonly string[]; fit?: "grow" | "fill"; children: ReactNode }) {
  const hot = useHot();
  if (!hot.active) return <>{children}</>;
  return <div {...hotProps(hot, ids, fit ? `hot-ctl ${fit}` : "hot-ctl")}>{children}</div>;
}
