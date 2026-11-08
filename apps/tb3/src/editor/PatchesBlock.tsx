// Sidebar PATCH (what the editor shows, save as .syx), SET (the open set's 16 slots and its
// file buttons) and MORPH (target slot, amount, send rate).
//   click: recall · Option + hold: audition · double-click: rename · right-click: menu
//   STORE, then click: store the active patch · drop a patch from the browser: load into slot
import { useState } from "react";
import type { DragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Patch } from "../core/patch";
import { nameFromPath } from "../core/patchSet";
import { HFader } from "../ui/Fader";
import { ContextMenu, askName, confirmed, menuAt, useDialog } from "../ui/Dialog";
import type { MenuState } from "../ui/Dialog";
import { Section } from "../ui/controls";
import { MORPH_RATES } from "./useSession";
import type { Session } from "./useSession";
import type { SetActions } from "./useSetActions";

export const PATCH_DRAG_TYPE = "application/x-tb3-patch";

export function PatchBlock(p: { session: Session; actions: SetActions; hasLibrary: boolean }) {
  const s = p.session;
  const { slots, active } = s.state;
  const name = active !== null ? slots[active]!.name : s.activePatch ? (s.currentName ?? "Synced from TB-3") : "–";
  const where = active !== null ? `SLOT ${active + 1}` : s.activePatch ? "NOT IN SET" : "";
  const modified = active !== null && s.modified[active];
  // Under the name: the patch being auditioned (the editor shows it until release), or a slot prompt.
  const [lbl, line] = s.previewName
    ? ["AUDITION", s.previewName]
    : s.mode === "store"
      ? ["STORE", "Click a slot to store it. Esc cancels."]
      : s.mode === "target"
        ? ["MORPH", "Click a slot to morph towards. Esc cancels."]
        : ["AUDITION", null];
  return (
    <Section
      title="PATCH"
      className="patch"
      extra={
        <button
          className="btn"
          disabled={!p.hasLibrary || !s.activePatch}
          title="Save the patch in the editor as a .syx file"
          onClick={() => s.activePatch && p.actions.savePatchAs(s.activePatch, s.currentName ?? "Untitled")}
        >
          SAVE AS…
        </button>
      }
    >
      <div className="patchname" title={name}>
        <span className="big">{name}</span>
        {modified && <span className="mod">●</span>}
        {where && <span className="where">{where}</span>}
      </div>
      <div className={`nowline ${s.previewName ? "audition" : ""}`}>
        <span className="lbl">{lbl}</span>
        <span className={`v ${line ? "" : "dim"}`} title={line ?? undefined}>
          {line ?? "hold ▶ in the library, or Option-click a slot"}
        </span>
      </div>
    </Section>
  );
}

export function SetBlock(p: {
  session: Session;
  actions: SetActions;
  findPatch: (path: string) => Patch | undefined;
}) {
  const s = p.session;
  const { slots, active, unsent, setPath } = s.state;
  const ask = useDialog();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dropOn, setDropOn] = useState<number | null>(null);

  const replaceOk = async (i: number) =>
    !slots[i] || (await confirmed(ask, `Replace slot ${i + 1}?`, `“${slots[i]!.name}” will be replaced.`));

  const onClick = async (i: number, e: ReactMouseEvent) => {
    if (e.altKey) return; // Option is audition
    if (s.mode === "store") {
      s.setMode(null);
      if (await replaceOk(i)) s.store(i);
    } else if (s.mode === "target") {
      s.setMode(null);
      if (slots[i]) s.chooseMorphTarget(i);
    } else if (slots[i]) {
      s.recall(i);
    }
  };

  const onPointerDown = (i: number, e: ReactPointerEvent) => {
    const slot = slots[i];
    if (!e.altKey || !slot || e.button !== 0) return;
    e.preventDefault();
    s.preview(slot.patch, `slot:${i}`, slot.name);
    window.addEventListener("pointerup", () => s.endPreview(), { once: true });
  };

  const rename = async (i: number) => {
    const name = await askName(ask, `Rename slot ${i + 1}`, slots[i]?.name);
    if (name) s.rename(i, name);
  };

  const onDrop = async (i: number, e: DragEvent) => {
    setDropOn(null);
    const path = e.dataTransfer.getData(PATCH_DRAG_TYPE);
    const patch = path ? p.findPatch(path) : undefined;
    if (!patch) return;
    e.preventDefault();
    if (await replaceOk(i)) s.loadIntoSlot(i, { name: nameFromPath(path), patch });
  };

  const setName = setPath ? nameFromPath(setPath) : "Unsaved set";
  return (
    <Section
      title="SET"
      className="patches"
      extra={
        <button
          className={`btn ${s.mode === "store" ? "sel blink" : ""}`}
          disabled={!s.activePatch}
          title="Store the patch in the editor into a slot of the set"
          onClick={() => s.setMode(s.mode === "store" ? null : "store")}
        >
          STORE
        </button>
      }
    >
      <div className={`slots16 ${s.mode ? "armed" : ""}`}>
        {slots.map((slot, i) => {
          const cls = [
            "slot",
            slot ? "filled" : "",
            active === i ? "active" : "",
            s.modified[i] ? "modified" : "",
            slot && unsent[i] ? "unsent" : "",
            s.previewKey === `slot:${i}` ? "preview" : "",
            s.morphTarget === i ? "target" : "",
            dropOn === i ? "drop" : "",
          ].join(" ");
          const notes = [s.modified[i] && "unsaved edits", slot && unsent[i] && "not sent since opening"].filter(
            Boolean,
          );
          return (
            <button
              key={i}
              className={cls}
              title={
                slot ? `${i + 1} · ${slot.name}${notes.length ? ` (${notes.join(", ")})` : ""}` : `${i + 1} · empty`
              }
              onClick={(e) => void onClick(i, e)}
              onPointerDown={(e) => onPointerDown(i, e)}
              onDoubleClick={() => slot && !s.mode && void rename(i)}
              onContextMenu={(e) =>
                setMenu(
                  menuAt(e, [
                    { label: "Rename…", onClick: () => void rename(i), disabled: !slot },
                    {
                      label: "Save as .syx…",
                      onClick: () => slot && p.actions.savePatchAs(slot.patch, slot.name),
                      disabled: !slot,
                    },
                    { label: "Clear", onClick: () => s.clear(i), disabled: !slot },
                  ]),
                )
              }
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(PATCH_DRAG_TYPE)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setDropOn(i);
              }}
              onDragLeave={() => setDropOn((d) => (d === i ? null : d))}
              onDrop={(e) => void onDrop(i, e)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="setline">
        <span className="lbl">FILE</span>
        <span className="v" title={setPath ?? undefined}>
          {setName}
          {s.dirty ? " ●" : ""}
        </span>
        <button className="btn mini" onClick={p.actions.newSet}>
          NEW
        </button>
        <button className="btn mini" disabled={!s.dirty} onClick={p.actions.saveSet}>
          SAVE
        </button>
        <button className="btn mini" onClick={p.actions.saveSetAs}>
          SAVE AS…
        </button>
      </div>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </Section>
  );
}

export function MorphBlock(p: { session: Session }) {
  const s = p.session;
  const target = s.morphTarget === null ? null : s.state.slots[s.morphTarget];
  return (
    <Section
      title="MORPH"
      className="morph"
      extra={
        <span
          className="tag"
          title="Fast moves between very different patches can leave the TB-3 out of step. SYNC TO TB-3 resends the whole patch."
        >
          EXPERIMENTAL
        </span>
      }
    >
      <div className="hrow">
        <span className="lbl" style={{ width: 60 }}>
          TARGET
        </span>
        <button
          className={`btn mini ${s.mode === "target" ? "sel blink" : ""}`}
          onClick={() => s.setMode(s.mode === "target" ? null : "target")}
        >
          PICK
        </button>
        <span className="v morphname" title={target?.name}>
          {target ? `${s.morphTarget! + 1} · ${target.name}` : s.mode === "target" ? "click a slot" : "–"}
        </span>
      </div>
      <div className="hrow">
        <span className="lbl" style={{ width: 60 }}>
          AMOUNT
        </span>
        <HFader
          value={s.morphAmount}
          max={127}
          onChange={s.setMorph}
          format={(v) => `${Math.round((v / 127) * 100)}%`}
          disabled={!target || !s.activePatch}
          width={150}
        />
      </div>
      <div className="hrow" title="Most changes per second sent to the TB-3 while morphing">
        <span className="lbl" style={{ width: 60 }}>
          RATE
        </span>
        <HFader
          value={Math.max(0, MORPH_RATES.indexOf(s.morphRate as (typeof MORPH_RATES)[number]))}
          max={MORPH_RATES.length - 1}
          onChange={(i) => s.setMorphRate(MORPH_RATES[i]!)}
          format={(i) => `${MORPH_RATES[i]}/s`}
          width={150}
        />
      </div>
    </Section>
  );
}
