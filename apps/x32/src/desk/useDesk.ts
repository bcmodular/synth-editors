// The connection to the desk: one DeskClient over the UDP relay, feeding the cache. Each time the desk becomes
// reachable it is read in full (a change made while it was out of reach is picked up); notifications keep it current
// after that. Changing the address restarts everything.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  reread: () => void; // read the whole desk again (after a scene or snippet load changed it under the cache)
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

// The full read in progress, if any: started again each time the desk becomes reachable, or when asked.
class DeskReads {
  private reading: AbortController | null = null;

  constructor(private readonly client: DeskClient, private readonly report: (p: ReadProgress) => void) {}

  restart(): void {
    this.reading?.abort();
    this.reading = this.client.link === "connected" ? readDesk(this.client, this.report) : null;
  }

  stop(): void {
    this.reading?.abort();
  }
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
  const rereadRef = useRef<() => void>(() => {});

  useEffect(() => void deskHost().then(setHost), []);
  useEffect(() => cache.onChange(() => setCached(cache.size)), [cache]);
  useEffect(() => onSocketError(setSocketError), []);
  useEffect(() => {
    if (link === "connected") setSocketError(null);
  }, [link]);

  useEffect(() => {
    if (!host) return;
    const c = new DeskClient(relay);
    const reads = new DeskReads(c, setRead);
    const offMessages = c.onMessage((m) => cache.take(m));
    const offLink = c.onLink((state, i) => {
      setLink(state);
      setInfo(i);
      reads.restart();
    });
    rereadRef.current = () => reads.restart();
    setLink("connecting");
    c.start();
    setClient(c);
    return () => {
      reads.stop();
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
  const reread = useCallback(() => rereadRef.current(), []);
  return { host, link, info, read, cached, cache, client, changeHost, finder, socketError, reread };
}
