// EFX1 / EFX2 panel: type buttons, ON switch, mode segmented control(s), slots in a 2-column
// grid that keeps the efx.ts null holes as empty cells. EQ is laid out by band instead.
import { efxTypes } from "../core/efx";
import type { EfxButton, EfxNum, EfxSlot, EfxType } from "../core/efx";
import { getEfxRaw, getEfxType } from "../core/patch";
import { HFader, VFader } from "../ui/Fader";
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

const EQ_BANDS: { name: string; slots: [number, string][] }[] = [
  {
    name: "LOW",
    slots: [
      [0x54, "CUT"],
      [0x55, "GAIN"],
    ],
  },
  {
    name: "LOW MID",
    slots: [
      [0x56, "FREQ"],
      [0x57, "Q"],
      [0x58, "GAIN"],
    ],
  },
  {
    name: "HIGH MID",
    slots: [
      [0x59, "FREQ"],
      [0x5a, "Q"],
      [0x5b, "GAIN"],
    ],
  },
  {
    name: "HIGH",
    slots: [
      [0x5c, "CUT"],
      [0x5d, "GAIN"],
    ],
  },
  { name: "OUT", slots: [[0x5e, "LEVEL"]] },
];

function EqBands(p: { efx: EfxNum; type: EfxType }) {
  const ed = useEditor();
  const disabled = !ed.patch;
  return (
    <div className="eq">
      {EQ_BANDS.map((band) => (
        <div key={band.name} className="band">
          <h3>{band.name}</h3>
          <div className="row tight">
            {band.slots.map(([offset, label]) => {
              const s = p.type.slots.find((x) => x?.offset === offset);
              if (!s) return null;
              return (
                <VFader
                  key={offset}
                  height={80}
                  value={ed.patch ? getEfxRaw(ed.patch, p.efx, offset) : 0}
                  max={s.max}
                  center={slotCenter(s)}
                  format={s.display}
                  defaultValue={Math.round(s.default * s.max)}
                  onChange={(v) => ed.setEfxByte(p.efx, offset, v)}
                  disabled={disabled}
                  label={<span className="lbl">{label}</span>}
                />
              );
            })}
          </div>
        </div>
      ))}
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
        <EqBands efx={p.efx} type={type} />
      ) : (
        <div className="slots">
          {type.slots.map((s, i) =>
            s ? (
              <div key={s.offset} className={`hrow ${s.disabledBy.some((o) => byte(o) !== 0) ? "dim" : ""}`}>
                <span className="lbl" style={{ width: 74 }}>
                  {s.name}
                </span>
                <HFader
                  width={170}
                  value={byte(s.offset)}
                  max={s.max}
                  center={slotCenter(s)}
                  format={s.display}
                  defaultValue={Math.round(s.default * s.max)}
                  onChange={(v) => ed.setEfxByte(p.efx, s.offset, v)}
                  disabled={disabled}
                />
              </div>
            ) : (
              <div key={`hole-${i}`} className="hole" />
            ),
          )}
        </div>
      )}
    </Section>
  );
}
