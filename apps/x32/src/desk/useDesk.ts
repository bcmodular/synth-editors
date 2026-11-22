// The connection to the desk: one DeskClient over the UDP relay, feeding the cache. Each time the desk becomes
// reachable it is read in full (a change made while it was out of reach is picked up); notifications keep it current
// after that. Changing the address restarts everything.

import { useCallback, useEffect, useMemo, useState } from "react";
import { DeskCache } from "../core/cache";
import { DeskClient, type DeskInfo, type LinkState } from "../core/client";
import { deskReadList } from "../core/readList";
import { readAll, type ReadProgress } from "../core/reader";
import { deskHost, onSocketError, relay, setDeskHost } from "./relay";
import { useFinder, type Finder } from "./useFinder";

export interface Desk {
  host: string;
  link: LinkState;
  info: DeskInfo | null;
  read: ReadProgress | null; // the latest full read, or the one in progress
  cached: number; // values the app knows
  cache: DeskCache;
  client: DeskClient | null;
  changeHost: (text: string) => Promise<boolean>;
  finder: Finder;
  socketError: string | null; // the latest send error since the desk last answered
}

const PROGRESS_EVERY = 100; // reads between progress updates
const worthReporting = (p: ReadProgress) => p.done % PROGRESS_EVERY === 0 || p.done === p.total;

// Read everything; the answers reach the cache through the client's message listener.
function readDesk(client: DeskClient, report: (p: ReadProgress) => void): AbortController {
  const abort = new AbortController();
  const progress = (p: ReadProgress) => {
    if (abort.signal.aborted) return;
    if (worthReporting(p)) report(p);
  };
  void readAll(client, deskReadList(), progress, abort.signal);
  return abort;
}

export function useDesk(): Desk {
  const cache = useMemo(() => new DeskCache(), []);
  const [host, setHost] = useState("");
  const [client, setClient] = useState<DeskClient | null>(null);
  const [link, setLink] = useState<LinkState>("connecting");
  const [info, setInfo] = useState<DeskInfo | null>(null);
  const [read, setRead] = useState<ReadProgress | null>(null);
  const [cached, setCached] = useState(0);
  const [socketError, setSocketError] = useState<string | null>(null);

  useEffect(() => void deskHost().then(setHost), []);
  useEffect(() => cache.onChange(() => setCached(cache.size)), [cache]);
  useEffect(() => onSocketError(setSocketError), []);
  useEffect(() => {
    if (link === "connected") setSocketError(null);
  }, [link]);

  useEffect(() => {
    if (!host) return;
    const c = new DeskClient(relay);
    let reading: AbortController | null = null;
    const offMessages = c.onMessage((m) => cache.take(m));
    const offLink = c.onLink((state, i) => {
      setLink(state);
      setInfo(i);
      reading?.abort();
      reading = state === "connected" ? readDesk(c, setRead) : null;
    });
    setLink("connecting");
    c.start();
    setClient(c);
    return () => {
      reading?.abort();
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

  const finder = useFinder(changeHost);
  return { host, link, info, read, cached, cache, client, changeHost, finder, socketError };
}
