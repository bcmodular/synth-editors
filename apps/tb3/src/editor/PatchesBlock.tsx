// Sidebar PATCH (what the editor shows, save as .syx), SET (the open set's 16 slots and its
// file buttons) and MORPH (target slot, amount, send rate).
//   click a filled slot: recall · click an empty slot: store the patch in the editor there
//   DELETE, then click: clear · GRAB (or Option), then hold: audition · double-click: rename
//   right-click: menu · drop a patch from the browser: load into slot
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
    : s.mode === "delete"
      ? ["DELETE", "Click slots to clear them. Esc ends."]
      : s.mode === "grab"
        ? ["GRAB", "Hold a slot to audition it. Esc ends."]
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
          {line ?? "hold ▶ in the library, or GRAB a slot"}
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
  const { slots, active, setPath } = s.state;
  const ask = useDialog();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dropOn, setDropOn] = useState<number | null>(null);

  const replaceOk = async (i: number) =>
    !slots[i] || (await confirmed(ask, `Replace slot ${i + 1}?`, `“${slots[i]!.name}” will be replaced.`));

  const onClick = (i: number, e: ReactMouseEvent) => {
    if (e.altKey || s.mode === "grab") return; // audition, on pointer down
    if (s.mode === "delete") {
      if (slots[i]) s.clear(i); // stays in delete mode, like the TouchOSC panel
    } else if (s.mode === "target") {
      s.setMode(null);
      if (slots[i]) s.chooseMorphTarget(i);
    } else if (slots[i]) {
      s.recall(i);
    } else if (s.activePatch) {
      s.store(i);
    }
  };

  const storeOver = async (i: number) => {
    if (await replaceOk(i)) s.store(i);
  };

  const modeButton = (mode: "delete" | "grab", label: string, title: string) => (
    <button
      className={`btn mini mode-${mode} ${s.mode === mode ? "sel" : ""}`}
      title={title}
      onClick={() => s.setMode(s.mode === mode ? null : mode)}
    >
      {label}
    </button>
  );

  const onPointerDown = (i: number, e: ReactPointerEvent) => {
    const slot = slots[i];
    if (!(e.altKey || s.mode === "grab") || !slot || e.button !== 0) return;
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
        <span className="row tight">
          {modeButton("delete", "DELETE", "Then click slots to clear them")}
          {modeButton("grab", "GRAB", "Then hold a slot to audition it (or Option-hold a slot)")}
        </span>
      }
    >
      <div className={`slots16 ${s.mode ? `armed ${s.mode}` : ""}`}>
        {slots.map((slot, i) => {
          const cls = [
            "slot",
            slot ? "filled" : "",
            active === i ? "active" : "",
            s.modified[i] ? "modified" : "",
            s.previewKey === `slot:${i}` ? "preview" : "",
            s.morphTarget === i ? "target" : "",
            dropOn === i ? "drop" : "",
          ].join(" ");
          return (
            <button
              key={i}
              className={cls}
              title={
                slot
                  ? `${i + 1} · ${slot.name}${s.modified[i] ? " (unsaved edits)" : ""}`
                  : `${i + 1} · empty${s.activePatch ? ": click to store the patch in the editor" : ""}`
              }
              onClick={(e) => onClick(i, e)}
              onPointerDown={(e) => onPointerDown(i, e)}
              onDoubleClick={() => slot && !s.mode && void rename(i)}
              onContextMenu={(e) =>
                setMenu(
                  menuAt(e, [
                    {
                      label: slot ? "Replace with the patch in the editor…" : "Store the patch in the editor",
                      onClick: () => void storeOver(i),
                      disabled: !s.activePatch,
                    },
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
        <button
          className="btn mini"
          disabled={!target && s.mode !== "target"}
          title="Stop morphing; the editor keeps the blend it shows"
          onClick={() => {
            if (s.mode === "target") s.setMode(null);
            s.chooseMorphTarget(null);
          }}
        >
          CLEAR
        </button>
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
