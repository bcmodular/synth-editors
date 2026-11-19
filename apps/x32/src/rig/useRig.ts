// The rig as the desk has it now, worked out again shortly after any value changes (a burst of reads or
// notifications is one update).

import { useEffect, useState } from "react";
import type { DeskCache } from "../core/cache";
import { deriveRig, type Rig } from "../core/rig";

const SETTLE_MS = 100;

export function useRig(cache: DeskCache): Rig {
  const [rig, setRig] = useState(() => deriveRig((a) => cache.get(a)));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = cache.onChange(() => {
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        setRig(deriveRig((a) => cache.get(a)));
      }, SETTLE_MS);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [cache]);
  return rig;
}
