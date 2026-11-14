// Parts several EFX drawings share: the HPF / LPF band, regions stacked down a drawing, and a tone panel
// with EQ LOW / HIGH handles.
import { parseHz } from "../../core/eqResponse";
import type { ReactNode } from "react";
import { Band, dbScale, freqX, Handle, highShelf, lowShelf, Response, Svg } from "../../ui/draw";
import type { BandEdge, Px, Region } from "../../ui/draw";
import { useEfxView } from "./viewContext";
import type { EfxView, EfxViewProps } from "./viewContext";

const BAND_PX = 140; // drag across a filter table

function edge(c: EfxView, offset: number): BandEdge {
  return {
    hz: parseHz(c.text(offset)) ?? undefined,
    label: c.name(offset),
    onPointerDown: c.drag({ x: { offset, px: BAND_PX } }),
    onReset: c.reset(offset),
  };
}

// The band a pair of filter slots passes (HPF / LPF tables), either edge dragged sideways.
export function FilterBand(p: { c: EfxView; region: Region; lo?: number; hi?: number; title?: string }) {
  const { c, lo, hi } = p;
  return (
    <Band
      region={p.region}
      lo={lo === undefined ? undefined : edge(c, lo)}
      hi={hi === undefined ? undefined : edge(c, hi)}
      title={p.title ?? "FILTER"}
    />
  );
}

export const BAND_H = 26;

// A drawing split into a main region and a strip `strip` px tall under it, `gap` apart.
export function split(c: EfxView, strip: Px, gap = 4): [Region, Region] {
  const { width, height } = c.size;
  return [
    { width, height: height - strip - gap, top: 0 },
    { width, height: strip, top: height - strip },
  ];
}

interface OverBandProps {
  props: EfxViewProps;
  label: string;
  Main: (p: { c: EfxView; region: Region }) => ReactNode;
  lo?: number;
  hi?: number;
  title?: string;
}

// A drawing whose main part sits over a filter band (delay, reverb, chorus).
export function OverBand({ props, label, Main, lo, hi, title }: OverBandProps) {
  const c = useEfxView(props);
  const [main, band] = split(c, BAND_H);
  return (
    <Svg size={c.size} label={label}>
      <Main c={c} region={main} />
      <FilterBand c={c} region={band} lo={lo} hi={hi} title={title} />
    </Svg>
  );
}

// The ±15 dB EQ LOW / EQ HIGH shelves (ring mod, bit crush): handles dragged up and down; `extra` adds to the curve.
export function TonePanel(p: { c: EfxView; region: Region; low: number; high: number; extra?: (hz: number) => number }) {
  const { c, region } = p;
  const db = (offset: number) => c.raw(offset) - 15;
  const [lo, hi] = [db(p.low), db(p.high)];
  const y = dbScale(region, 18);
  const curve = (f: number) => lowShelf(f, 150, lo) + highShelf(f, 5000, hi) + (p.extra?.(f) ?? 0);
  const handle = (offset: number, hz: number, v: number) => (
    <Handle size={c.size} x={freqX(hz, region.width)} y={y(v)} label={c.name(offset)} cursor="ns-resize"
      onPointerDown={c.drag({ y: { offset, px: 90 } })} onReset={c.reset(offset)} />
  );
  return (
    <g>
      <Response region={region} range={18} curve={curve} />
      {handle(p.low, 60, lo)}
      {handle(p.high, 12000, hi)}
    </g>
  );
}
