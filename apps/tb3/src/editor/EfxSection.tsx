// EFX1 / EFX2 panel: type buttons, ON switch, mode segmented control(s), slots in a 2-column
// grid that keeps the efx.ts null holes as empty cells.
import { efxTypes } from "../core/efx";
import type { EfxButton, EfxNum } from "../core/efx";
import { getEfxRaw, getEfxType } from "../core/patch";
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
      <div className="slots">
        {type.slots.map((s, i) =>
          s ? (
            <div key={s.offset} className={`hrow ${s.disabledBy.some((o) => byte(o) !== 0) ? "dim" : ""}`}>
              <span className="lbl" style={{ width: 74 }}>
                {s.name}
              </span>
              <HFader
                width={120}
                value={byte(s.offset)}
                max={s.max}
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
    </Section>
  );
}
