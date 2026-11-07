// Top strip PATCHES (16 slots of the open set) and MORPH (target slot + amount).
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
import type { Session } from "./useSession";
import type { SetActions } from "./useSetActions";

export const PATCH_DRAG_TYPE = "application/x-tb3-patch";

export function PatchesBlock(p: {
  session: Session;
  actions: SetActions;
  findPatch: (path: string) => Patch | undefined;
  browserOpen: boolean;
  onToggleBrowser: () => void;
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
    s.preview(slot.patch, `slot:${i}`);
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
      title="PATCHES"
      className="patches"
      extra={
        <>
          <button
            className={`btn ${s.mode === "store" ? "sel blink" : ""}`}
            disabled={!s.patch}
            onClick={() => s.setMode(s.mode === "store" ? null : "store")}
          >
            STORE
          </button>
          <button className={`btn ${p.browserOpen ? "sel" : ""}`} onClick={p.onToggleBrowser}>
            LIBRARY {p.browserOpen ? "▴" : "▾"}
          </button>
        </>
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
        <span className="status" title={setPath ?? undefined}>
          {s.mode === "store"
            ? "Click a slot to store the current patch. Esc cancels."
            : `${setName}${s.dirty ? " ●" : ""}`}
        </span>
        <button className="btn mini" disabled={!s.dirty} onClick={p.actions.saveSet}>
          SAVE SET
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
    <Section title="MORPH" className="morph">
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
          disabled={!target || !s.patch}
          width={150}
        />
      </div>
    </Section>
  );
}
