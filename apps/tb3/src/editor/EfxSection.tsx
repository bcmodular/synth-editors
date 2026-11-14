// EFX1 / EFX2 panel: type buttons, ON switch, mode segmented control(s), then the type's drawing (editor/efx/) beside
// its slots in a 2-column grid that keeps the efx.ts null holes as empty cells. Slots set in the drawing show as
// readouts (name and value) instead of faders, as on the SP-404 editor.
import { efxTypes } from "../core/efx";
import type { EfxButton, EfxNum, EfxSlot, EfxType } from "../core/efx";
import { getEfxRaw, getEfxType } from "../core/patch";
import { HFader } from "../ui/Fader";
import { LedButton, Section, Segmented } from "../ui/controls";
import { useEditor } from "./EditorContext";
import { EFX_VIEWS } from "./efx";

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

const DRAWING_W = 240;
const DRAWING_H = { plain: 167, withModes: 136 }; // shorter under a row of mode buttons

interface SlotsProps {
  efx: EfxNum;
  type: EfxType;
  inView: ReadonlySet<number>;
  byte: (offset: number) => number;
}

function SlotRow({ efx, slot: s, inView, byte }: Omit<SlotsProps, "type"> & { slot: EfxSlot }) {
  const ed = useEditor();
  const dim = s.disabledBy.some((o) => byte(o) !== 0);
  const value = byte(s.offset);
  return (
    <div className={`hrow ${dim ? "dim" : ""} ${inView.has(s.offset) ? "readout" : ""}`}>
      <span className="lbl">{s.name}</span>
      {inView.has(s.offset) ? (
        <em className="rv">{ed.patch ? s.display(value) : ""}</em>
      ) : (
        <HFader
          width="fill"
          value={value}
          max={s.max}
          center={slotCenter(s)}
          format={s.display}
          defaultValue={Math.round(s.default * s.max)}
          onChange={(v) => ed.setEfxByte(efx, s.offset, v)}
          disabled={!ed.patch}
        />
      )}
    </div>
  );
}

// Slot faders stretch to fill their half of the space beside the drawing.
function Slots(p: SlotsProps) {
  return (
    <div className="slots">
      {p.type.slots.map((s, i) =>
        s ? <SlotRow key={s.offset} {...p} slot={s} /> : <div key={`hole-${i}`} className="hole" />,
      )}
    </div>
  );
}

function Body({ efx, type, byte }: { efx: EfxNum; type: EfxType; byte: (offset: number) => number }) {
  const ed = useEditor();
  const drawing = EFX_VIEWS[type.name];
  const height = type.buttons.some(Boolean) ? DRAWING_H.withModes : DRAWING_H.plain;
  const inView = new Set(ed.patch && drawing ? drawing.inView(byte) : []);
  return (
    <div className="row top efxbody">
      {drawing && <drawing.View efx={efx} type={type} size={{ width: DRAWING_W, height }} />}
      <Slots efx={efx} type={type} inView={inView} byte={byte} />
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
      <Body efx={p.efx} type={type} byte={byte} />
    </Section>
  );
}
