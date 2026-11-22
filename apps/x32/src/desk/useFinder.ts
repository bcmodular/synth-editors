// Finding the desk on the network. With no address set yet (first run), the app looks by itself and connects when
// exactly one desk answers; otherwise "Find desk" lists what answered, to pick from.

import { useCallback, useEffect, useRef, useState } from "react";
import type { FoundDesk } from "../core/discovery";
import { deskHost, findDesks } from "./relay";

export interface Finder {
  finding: boolean;
  found: FoundDesk[] | null; // null until a search has finished
  find: () => Promise<FoundDesk[]>;
}

export function useFinder(connect: (host: string) => Promise<boolean>): Finder {
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<FoundDesk[] | null>(null);
  const looked = useRef(false);

  const find = useCallback(async () => {
    setFinding(true);
    const desks = await findDesks();
    setFound(desks);
    setFinding(false);
    return desks;
  }, []);

  useEffect(() => {
    if (looked.current) return;
    looked.current = true;
    void deskHost().then(async (host) => {
      if (host) return;
      const desks = await find();
      if (desks.length === 1) await connect(desks[0]!.host);
    });
  }, [find, connect]);

  return { finding, found, find };
}
