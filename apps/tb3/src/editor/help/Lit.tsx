// Inside a help panel's copy of a section, a control lights up while the help points at its parameters (and pointing
// at it points at them). Outside a help panel it's left as it is. (After apps/jv2080/src/editor/help/Lit.tsx.)
import type { ReactNode } from "react";
import { useHot } from "./hot";

export function Lit({ ids, children }: { ids: readonly string[]; children: ReactNode }) {
  const { active, hot, hover } = useHot();
  if (!active) return <>{children}</>;
  const lit = ids.some((id) => hot.has(id));
  return (
    <div className={`hot-ctl ${lit ? "hot" : ""}`} onPointerEnter={() => hover(ids)} onPointerLeave={() => hover([])}>
      {children}
    </div>
  );
}
