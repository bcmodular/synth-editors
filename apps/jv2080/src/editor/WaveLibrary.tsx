// The wave library: a panel over the editor for one tone, with search, the instrument categories
// (core/waveCategories.ts) and the waves as a grid. A click sets the wave on the JV straight away, so you hear it, and
// leaves the panel open to try others; a double-click picks and closes. Escape or a press outside closes it.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findWaves, WAVE_CATEGORIES, type WaveEntry } from "../core/waveCategories";
import type { WaveGroup } from "../core/waves";
import { useDismiss } from "../ui/useDismiss";

export interface WaveLibraryProps {
  title: string;
  colour: string;
  current: { group: WaveGroup | undefined; number: number };
  onPick: (wave: WaveEntry) => void;
  onClose: () => void;
}

const ALL = "All";

function CategoryList({ query, category, onCategory }: { query: string; category: string; onCategory: (c: string) => void }) {
  return (
    <div className="wl-cats">
      {[ALL, ...WAVE_CATEGORIES].map((c) => {
        const count = findWaves(query, c === ALL ? undefined : c).length;
        return (
          <button key={c} className={`wl-cat ${c === category ? "on" : ""}`} disabled={count === 0} onClick={() => onCategory(c)}>
            <span>{c}</span>
            <em>{count}</em>
          </button>
        );
      })}
    </div>
  );
}

export function WaveLibrary({ title, colour, current, onPick, onClose }: WaveLibraryProps) {
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useDismiss(panel, onClose);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const waves = useMemo(() => findWaves(query, category === ALL ? undefined : category), [query, category]);
  useEffect(() => search.current?.focus(), []);
  const host = document.querySelector<HTMLElement>(".editor") ?? document.body;
  const isCurrent = (w: WaveEntry) => w.group === current.group && w.number === current.number;
  return createPortal(
    <div className="wavelib" ref={panel} role="dialog" aria-label={title} style={{ ["--acc" as string]: colour }}>
      <div className="wl-head">
        <span className="wl-title">{title}</span>
        <input ref={search} className="pick wl-search" placeholder="Search waves" value={query}
          onChange={(e) => setQuery(e.target.value)} />
        <span className="wl-count">{waves.length} waves</span>
      </div>
      <div className="wl-body">
        <CategoryList query={query} category={category} onCategory={setCategory} />
        <div className="wl-grid">
          {waves.map((w) => (
            <button key={`${w.group}-${w.number}`} className={`wl-wave ${isCurrent(w) ? "on" : ""}`}
              onClick={() => onPick(w)} onDoubleClick={() => { onPick(w); onClose(); }}>
              <span className="wl-name">{w.name.replace(/^REV /, "")}</span>
              <span className="wl-tags">
                {w.reversed && <i>REV</i>}
                <i>{w.group} {String(w.number + 1).padStart(3, "0")}</i>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    host,
  );
}
