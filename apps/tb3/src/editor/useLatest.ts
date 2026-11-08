import { useCallback, useRef, useState } from "react";

// State kept in a ref as well, so callbacks read the latest without re-binding.
export function useLatest<T>(initial: T | (() => T)) {
  const [state, setState] = useState(initial);
  const ref = useRef(state);
  const commit = useCallback((next: T) => {
    ref.current = next;
    setState(next);
  }, []);
  return { state, ref, commit };
}

export type Latest<T> = ReturnType<typeof useLatest<T>>;
