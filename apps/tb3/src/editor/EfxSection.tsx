// EFX1 / EFX2 panel: type buttons, ON switch, mode segmented control(s), slots in a 2-column
// grid that keeps the efx.ts null holes as empty cells. EQ adds a response curve beside the slots.
import { eqResponse } from "../core/eqResponse";
import { efxTypes } from "../core/efx";
import type { EfxButton, EfxNum, EfxSlot, EfxType } from "../core/efx";
import { getEfxRaw, getEfxType } from "../core/patch";
import { EqView } from "../ui/EqView";
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

function Slots(p: { efx: EfxNum; type: EfxType; faderWidth: number; labelWidth: number }) {
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
              width={p.faderWidth}
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

function EqPanel(p: { efx: EfxNum; type: EfxType }) {
  const { patch } = useEditor();
  const b = (offset: number) => (patch ? getEfxRaw(patch, p.efx, offset) : 0);
  const ys = patch
    ? eqResponse({
        lowCut: b(0x54),
        lowGain: b(0x55),
        lmFreq: b(0x56),
        lmQ: b(0x57),
        lmGain: b(0x58),
        hmFreq: b(0x59),
        hmQ: b(0x5a),
        hmGain: b(0x5b),
        hiCut: b(0x5c),
        hiGain: b(0x5d),
        level: b(0x5e),
      })
    : null;
  return (
    <div className="row top eq">
      <EqView ys={ys} width={240} height={167} />
      <Slots efx={p.efx} type={p.type} faderWidth={118} labelWidth={62} />
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
        <Slots efx={p.efx} type={type} faderWidth={170} labelWidth={74} />
      )}
    </Section>
  );
}
