import { useEffect, useRef } from "react";
import type { LogLine } from "../link/useJvLink";

export function LogPanel({ log, onClear }: { log: LogLine[]; onClear: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  // A block body: scrollIntoView returns a Promise in current Chromium, and React would take it for a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [log]);
  const first = log[0]?.t ?? 0;
  return (
    <section className="log">
      <h2>Log <button onClick={onClear}>CLEAR</button></h2>
      <pre>
        {log.map((l) => `${((l.t - first) / 1000).toFixed(3).padStart(8)}  ${l.text}`).join("\n")}
        <div ref={end} />
      </pre>
    </section>
  );
}
