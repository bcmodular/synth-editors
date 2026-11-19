// The connection to the desk: one DeskClient over the UDP relay, feeding the cache. Changing the address restarts it.

import { useCallback, useEffect, useMemo, useState } from "react";
import { DeskCache } from "../core/cache";
import { DeskClient, type DeskInfo, type LinkState } from "../core/client";
import { deskHost, relay, setDeskHost } from "./relay";

export interface Desk {
  host: string;
  link: LinkState;
  info: DeskInfo | null;
  cached: number; // values the app knows
  cache: DeskCache;
  client: DeskClient | null;
  changeHost: (text: string) => Promise<boolean>;
}

export function useDesk(): Desk {
  const cache = useMemo(() => new DeskCache(), []);
  const [host, setHost] = useState("");
  const [client, setClient] = useState<DeskClient | null>(null);
  const [link, setLink] = useState<LinkState>("connecting");
  const [info, setInfo] = useState<DeskInfo | null>(null);
  const [cached, setCached] = useState(0);

  useEffect(() => void deskHost().then(setHost), []);
  useEffect(() => cache.onChange(() => setCached(cache.size)), [cache]);

  useEffect(() => {
    if (!host) return;
    const c = new DeskClient(relay);
    const offMessages = c.onMessage((m) => cache.take(m));
    const offLink = c.onLink((state, i) => {
      setLink(state);
      setInfo(i);
    });
    setLink("connecting");
    c.start();
    setClient(c);
    return () => {
      offMessages();
      offLink();
      c.stop();
    };
  }, [host, cache]);

  const changeHost = useCallback(async (text: string) => {
    const accepted = await setDeskHost(text);
    if (accepted) setHost(accepted);
    return accepted !== null;
  }, []);

  return { host, link, info, cached, cache, client, changeHost };
}
