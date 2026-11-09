// SHOW BANKS: which banks the desk shows, remembered per project. Until the user picks, it shows the first two
// banks that have samples.

import { useCallback, useMemo, useState } from "react";

const DEFAULT_SHOWN = 2;
const key = (project: number) => `sp404.showBanks.${project}`;

function stored(project: number | undefined): number[] | undefined {
  if (project === undefined) return undefined;
  try {
    const value = localStorage.getItem(key(project));
    return value ? (JSON.parse(value) as number[]) : undefined;
  } catch {
    return undefined;
  }
}

export function useShownBanks(project: number | undefined, loaded: ReadonlySet<number>) {
  const [picked, setPicked] = useState<Record<number, number[]>>({});
  const chosen = project === undefined ? undefined : (picked[project] ?? stored(project));
  const list = useMemo(() => {
    const banks = chosen ?? [...loaded].sort((a, b) => a - b).slice(0, DEFAULT_SHOWN);
    return banks.filter((b) => loaded.has(b)).sort((a, b) => a - b);
  }, [chosen, loaded]);
  const shown = useMemo(() => new Set(list), [list]);

  const toggle = useCallback((bank: number) => {
    if (project === undefined) return;
    const next = shown.has(bank) ? list.filter((b) => b !== bank) : [...list, bank];
    setPicked((p) => ({ ...p, [project]: next }));
    localStorage.setItem(key(project), JSON.stringify(next));
  }, [project, list, shown]);

  return { list, shown, toggle };
}
