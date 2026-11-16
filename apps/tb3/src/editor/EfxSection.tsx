// EFX1 / EFX2 panel: type buttons, ON switch, mode segmented control(s), then the type's drawing (editor/efx/), which
// shows and sets its own values, beside knobs for the rest.
import { useState } from "react";
import { efxTypes } from "../core/efx";
import type { EfxButton, EfxNum, EfxSlot, EfxType } from "../core/efx";
import { getEfxRaw, getEfxType } from "../core/patch";
import { Knob } from "../ui/Knob";
import { useSize } from "../ui/useSize";
import { LedButton, Section, Segmented } from "../ui/controls";
import { efxTarget } from "./ccTargets";
import { useEditor } from "./EditorContext";
import { Pickable } from "./Param";
import { EFX_VIEWS } from "./efx";
import { efxHelp, efxId } from "./help/content";
import { HelpButton } from "./help/HelpPanel";
import { Lit } from "./help/Lit";

// Group `set` buttons by offset: each group is one segmented control.
function buttonGroups(buttons: (EfxButton | null)[]): EfxButton[][] {
  const groups = new Map<number, EfxButton[]>();
  for (const b of buttons) {
    if (!b || b.action !== "set") continue;
    groups.set(b.offset, [...(groups.get(b.offset) ?? []), b]);
  }
  return [...groups.values()];
}

// Slots whose default is the middle are bipolar (gain in dB): the ring fills from there.
const slotCenter = (s: EfxSlot) => (s.default === 0.5 ? s.max / 2 : undefined);

const DRAWING_H = { plain: 167, withModes: 136 }; // shorter under a row of mode buttons

interface KnobsProps {
  efx: EfxNum;
  slots: EfxSlot[];
  byte: (offset: number) => number;
}

// A knob for each slot the drawing doesn't set; dimmed while a setting it depends on is off (RATE under BPM SYNC).
function SlotKnobs({ efx, slots, byte }: KnobsProps) {
  const ed = useEditor();
  return (
    <div className="efxknobs">
      {slots.map((s) => (
        <Pickable key={s.offset} spec={{ name: s.name, target: efxTarget(efx, s.offset), assign: null }} className="knobcell">
        <Lit ids={[efxId(s.offset)]}>
        <Knob
          label={s.name}
          value={byte(s.offset)}
          max={s.max}
          center={slotCenter(s)}
          format={s.display}
          defaultValue={Math.round(s.default * s.max)}
          onChange={(v) => ed.setEfxByte(efx, s.offset, v)}
          disabled={!ed.patch}
          dim={s.disabledBy.some((o) => byte(o) !== 0)}
        />
        </Lit>
        </Pickable>
      ))}
    </div>
  );
}

// The drawing takes the width the knobs leave.
function DrawingBox({ efx, type, height }: { efx: EfxNum; type: EfxType; height: number }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const { width } = useSize(box);
  const drawing = EFX_VIEWS[type.name];
  return (
    <div ref={setBox} className="efxdraw" style={{ height }}>
      {drawing && width > 0 && <drawing.View efx={efx} type={type} size={{ width, height }} />}
    </div>
  );
}

// The type's drawing, then knobs (two rows) for what it doesn't set; BYPASS has neither.
function Body({ efx, type, byte }: { efx: EfxNum; type: EfxType; byte: (offset: number) => number }) {
  const drawing = EFX_VIEWS[type.name];
  const height = type.buttons.some(Boolean) ? DRAWING_H.withModes : DRAWING_H.plain;
  const inView = new Set(drawing ? drawing.inView(byte) : []);
  const rest = type.slots.filter((s): s is EfxSlot => s !== null && !inView.has(s.offset));
  return (
    <div className="row top efxbody" style={{ ["--cols" as string]: Math.ceil(rest.length / 2) }}>
      {drawing && (
        <Lit ids={[...inView].map(efxId)}>
          <DrawingBox efx={efx} type={type} height={height} />
        </Lit>
      )}
      <SlotKnobs efx={efx} slots={rest} byte={byte} />
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
      title={disabled ? "–" : type.name}
      className={`efx efx${p.efx}`}
      info={<HelpButton label={`EFX${p.efx}`} useContent={efxHelp(p.efx)} side={<EfxSection efx={p.efx} />} sideWidth={780} />}
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
        <Lit key={g[0]!.offset} ids={[efxId(g[0]!.offset)]}>
          <Segmented
            options={g.map((b) => ({ label: b.name, value: b.value ?? 0 }))}
            value={byte(g[0]!.offset)}
            onChange={(v) => ed.setEfxByte(p.efx, g[0]!.offset, v)}
            disabled={disabled}
          />
        </Lit>
      ))}
      <Body efx={p.efx} type={type} byte={byte} />
    </Section>
  );
}
