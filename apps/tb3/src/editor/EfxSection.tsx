// EFX1 / EFX2 panel: type buttons, ON switch, mode segmented control(s), slots in a 2-column
// grid that keeps the efx.ts null holes as empty cells. EQ adds an editable response curve beside
// the slots.
import { EQ_FREQS, EQ_Q, HPF_FREQS, LPF_FREQS } from "../core/display";
import { EQ_MAX_HZ, EQ_MIN_HZ, eqGainDb, eqResponse, parseHz } from "../core/eqResponse";
import type { EqSettings } from "../core/eqResponse";
import { efxTypes } from "../core/efx";
import type { EfxButton, EfxNum, EfxSlot, EfxType } from "../core/efx";
import { getEfxRaw, getEfxType } from "../core/patch";
import { EqView } from "../ui/EqView";
import type { EqHandle } from "../ui/EqView";
import { HFader } from "../ui/Fader";
import { LedButton, Section, Segmented } from "../ui/controls";
import { useEditor } from "./EditorContext";

// Group `set` buttons by offset: each group is one segmented control.
function buttonGroups(buttons: (EfxButton | null)[]): EfxButton[][] {
  const groups = new Map<number, EfxButton[]>();
  for (const b of buttons) {
    if (!b || b.action !== "set") continue;
    groups.set(b.offset, [...(groups.get(b.offset) ?? []), b]);
  }
  return [...groups.values()];
}

// Slots whose default is the middle are bipolar (gain in dB): fill and zero line from there.
const slotCenter = (s: EfxSlot) => (s.default === 0.5 ? s.max / 2 : undefined);

// Slot faders stretch to fill their half of the section.
function Slots(p: { efx: EfxNum; type: EfxType; labelWidth: number }) {
  const ed = useEditor();
  const byte = (offset: number) => (ed.patch ? getEfxRaw(ed.patch, p.efx, offset) : 0);
  return (
    <div className="slots">
      {p.type.slots.map((s, i) =>
        s ? (
          <div key={s.offset} className={`hrow ${s.disabledBy.some((o) => byte(o) !== 0) ? "dim" : ""}`}>
            <span className="lbl" style={{ width: p.labelWidth }}>
              {s.name}
            </span>
            <HFader
              width="fill"
              value={byte(s.offset)}
              max={s.max}
              center={slotCenter(s)}
              format={s.display}
              defaultValue={Math.round(s.default * s.max)}
              onChange={(v) => ed.setEfxByte(p.efx, s.offset, v)}
              disabled={!ed.patch}
            />
          </div>
        ) : (
          <div key={`hole-${i}`} className="hole" />
        ),
      )}
    </div>
  );
}

// Byte offsets of the EQ's settings in the EFX1 block.
const EQ_OFFSETS = {
  lowCut: 0x54,
  lowGain: 0x55,
  lmFreq: 0x56,
  lmQ: 0x57,
  lmGain: 0x58,
  hmFreq: 0x59,
  hmQ: 0x5a,
  hmGain: 0x5b,
  hiCut: 0x5c,
  hiGain: 0x5d,
  level: 0x5e,
} as const satisfies Record<keyof EqSettings, number>;

const hzTable = (labels: readonly string[], flat: number) => labels.map((l) => parseHz(l) ?? flat);
const EQ_HZ = hzTable(EQ_FREQS, EQ_MIN_HZ);
const LOW_CUT_HZ = hzTable(HPF_FREQS, EQ_MIN_HZ); // "Flat" at the left edge
const HI_CUT_HZ = hzTable(LPF_FREQS, EQ_MAX_HZ); // "Flat" at the right edge
const SHELF_HANDLE_HZ = { low: 40, high: 8000 }; // kept clear of the cut handles at the edges
const GAIN_MAX = 40;
const GAIN_ZERO = 20;

function EqPanel(p: { efx: EfxNum; type: EfxType }) {
  const ed = useEditor();
  const patch = ed.patch;
  const b = (offset: number) => (patch ? getEfxRaw(patch, p.efx, offset) : 0);
  const set = (offset: number) => (v: number) => ed.setEfxByte(p.efx, offset, v);
  const e = Object.fromEntries(Object.entries(EQ_OFFSETS).map(([k, o]) => [k, b(o)])) as unknown as EqSettings;
  const at = (hz: number) => eqGainDb(e, hz);
  const gain = (offset: number) => ({ raw: b(offset), max: GAIN_MAX, onChange: set(offset) });
  const O = EQ_OFFSETS;
  const handles: EqHandle[] = [
    {
      key: "lc",
      label: "CUT",
      below: true,
      hz: LOW_CUT_HZ[e.lowCut]!,
      db: at(LOW_CUT_HZ[e.lowCut]!),
      freq: { table: LOW_CUT_HZ, index: e.lowCut, onChange: set(O.lowCut) },
      wheel: { value: e.lowCut, max: LOW_CUT_HZ.length - 1, onChange: set(O.lowCut) },
      onReset: () => set(O.lowCut)(0),
    },
    {
      key: "lo",
      label: "LOW",
      hz: SHELF_HANDLE_HZ.low,
      db: at(SHELF_HANDLE_HZ.low),
      gain: gain(O.lowGain),
      wheel: { value: e.lowGain, max: GAIN_MAX, onChange: set(O.lowGain) },
      onReset: () => set(O.lowGain)(GAIN_ZERO),
    },
    ...(["lm", "hm"] as const).map((band) => {
      const o = band === "lm" ? { f: O.lmFreq, q: O.lmQ, g: O.lmGain } : { f: O.hmFreq, q: O.hmQ, g: O.hmGain };
      const hz = EQ_HZ[b(o.f)] ?? EQ_MIN_HZ;
      return {
        key: band,
        label: band === "lm" ? "LM" : "HM",
        hz,
        db: at(hz),
        freq: { table: EQ_HZ, index: b(o.f), onChange: set(o.f) },
        gain: gain(o.g),
        wheel: { value: b(o.q), max: EQ_Q.length - 1, onChange: set(o.q) }, // scroll = Q
        onReset: () => set(o.g)(GAIN_ZERO),
      };
    }),
    {
      key: "hi",
      label: "HIGH",
      hz: SHELF_HANDLE_HZ.high,
      db: at(SHELF_HANDLE_HZ.high),
      gain: gain(O.hiGain),
      wheel: { value: e.hiGain, max: GAIN_MAX, onChange: set(O.hiGain) },
      onReset: () => set(O.hiGain)(GAIN_ZERO),
    },
    {
      key: "hc",
      label: "CUT",
      below: true,
      hz: HI_CUT_HZ[e.hiCut]!,
      db: at(HI_CUT_HZ[e.hiCut]!),
      freq: { table: HI_CUT_HZ, index: e.hiCut, onChange: set(O.hiCut) },
      wheel: { value: e.hiCut, max: HI_CUT_HZ.length - 1, onChange: set(O.hiCut) },
      onReset: () => set(O.hiCut)(HI_CUT_HZ.length - 1),
    },
  ];
  return (
    <div className="row top eq">
      <EqView ys={patch ? eqResponse(e) : null} handles={handles} width={240} height={167} />
      <Slots efx={p.efx} type={p.type} labelWidth={62} />
    </div>
  );
}

export function EfxSection(p: { efx: EfxNum }) {
  const ed = useEditor();
  const types = efxTypes(p.efx);
  const disabled = !ed.patch;
  const typeIdx = ed.patch ? getEfxType(ed.patch, p.efx) : 0;
  const type = types[typeIdx] ?? types[0]!;
  const byte = (offset: number) => (ed.patch ? getEfxRaw(ed.patch, p.efx, offset) : 0);
  const sw = type.swOffset;

  return (
    <Section
      title={`EFX${p.efx} · ${disabled ? "–" : type.name}`}
      className="efx"
      extra={
        sw !== undefined && (
          <LedButton
            label="ON"
            on={byte(sw) !== 0}
            disabled={disabled}
            onToggle={() => ed.setEfxByte(p.efx, sw, byte(sw) ? 0 : 1)}
          />
        )
      }
    >
      <div className="types">
        {types.map((t, i) => (
          <button
            key={t.name}
            className={`btn ${!disabled && i === typeIdx ? "sel" : ""}`}
            disabled={disabled}
            onClick={() => ed.setEfxType(p.efx, i)}
          >
            {t.name}
          </button>
        ))}
      </div>
      {buttonGroups(type.buttons).map((g) => (
        <Segmented
          key={g[0]!.offset}
          options={g.map((b) => ({ label: b.name, value: b.value ?? 0 }))}
          value={byte(g[0]!.offset)}
          onChange={(v) => ed.setEfxByte(p.efx, g[0]!.offset, v)}
          disabled={disabled}
        />
      ))}
      {type.name === "EQ" ? (
        <EqPanel efx={p.efx} type={type} />
      ) : (
        <Slots efx={p.efx} type={type} labelWidth={74} />
      )}
    </Section>
  );
}
