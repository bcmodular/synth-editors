// Sidebar PATCH (what the editor shows, save as .syx), SET (the open set's 64 slots, 8 × 8 as on the
// Launchpad, and its file buttons) and MORPH (target slot, amount, send rate).
//   click a filled slot: recall · click an empty slot: store the patch in the editor there
//   DELETE, then click: clear · GRAB (or Option), then hold: audition · double-click: rename
//   right-click: menu · drop a patch from the browser: load into slot · drag a slot onto another: swap
//   (⌘-drag: copy, asking before replacing a filled slot)
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Patch } from "../core/patch";
import { nameFromPath } from "../core/patchSet";
import { HFader } from "../ui/Fader";
import { ContextMenu } from "../ui/Dialog";
import { askName, confirmed, menuAt, useDialog } from "../ui/dialogs";
import type { MenuState } from "../ui/dialogs";
import { Section } from "../ui/controls";
import { copyHeld } from "../ui/platform";
import { PATCH_DRAG_TYPE, SLOT_DRAG_TYPE } from "./dragTypes";
import { rowColour } from "./slotColours";
import { MORPH_RATES } from "./useSession";
import type { Move } from "./sessionState";
import type { Session } from "./useSession";
import type { SetActions } from "./useSetActions";

// Under the patch name, while a slot mode is on.
const MODE_PROMPTS: Record<NonNullable<Session["mode"]>, [string, string]> = {
  delete: ["DELETE", "Click slots to clear them. Esc ends."],
  grab: ["GRAB", "Hold a slot to audition it. Esc ends."],
  target: ["MORPH", "Click a slot to morph towards. Esc cancels."],
};

// The patch name, where it lives, and whether it has unsaved edits.
function patchHeading(s: Session): { name: string; where: string; modified: boolean } {
  const { slots, active } = s.state;
  if (active !== null) return { name: slots[active]!.name, where: `SLOT ${active + 1}`, modified: s.modified[active]! };
  if (s.activePatch) return { name: s.currentName ?? "Synced from TB-3", where: "NOT IN SET", modified: false };
  return { name: "–", where: "", modified: false };
}

// Under the name: the patch being auditioned (the editor shows it until release), or a slot prompt.
function nowLine(s: Session): [string, string | null] {
  if (s.previewName) return ["AUDITION", s.previewName];
  return s.mode ? MODE_PROMPTS[s.mode] : ["AUDITION", null];
}

export function PatchBlock(p: { session: Session; actions: SetActions; hasLibrary: boolean }) {
  const s = p.session;
  const { name, where, modified } = patchHeading(s);
  const [lbl, line] = nowLine(s);
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

const classes = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

// Shift or GRAB: slots audition on pointer down instead of reacting to clicks.
const auditions = (s: Session, e: { shiftKey: boolean }) => e.shiftKey || s.mode === "grab";
const startsAudition = (s: Session, e: ReactPointerEvent) => e.button === 0 && auditions(s, e);

// A click on slot `i`, by mode. DELETE stays on, like the TouchOSC panel; picking a target ends.
// GRAB auditions on pointer down instead.
const SLOT_CLICKS: Record<NonNullable<Session["mode"]> | "none", (s: Session, i: number) => void> = {
  grab: () => {},
  delete: (s, i) => s.state.slots[i] && s.clear(i),
  target: (s, i) => {
    s.setMode(null);
    if (s.state.slots[i]) s.chooseMorphTarget(i);
  },
  none: (s, i) => {
    if (s.state.slots[i]) s.recall(i);
    else if (s.activePatch) s.store(i);
  },
};

function slotTitle(s: Session, i: number): string {
  const slot = s.state.slots[i];
  if (slot) return `${i + 1} · ${slot.name}${s.modified[i] ? " (unsaved edits)" : ""}`;
  return `${i + 1} · empty${s.activePatch ? ": click to store the patch in the editor" : ""}`;
}

const slotClass = (s: Session, i: number, dropOn: number | null) =>
  classes(
    "slot",
    s.state.slots[i] && "filled",
    s.state.active === i && "active",
    s.modified[i] && "modified",
    s.previewKey === `slot:${i}` && "preview",
    s.morphTarget === i && "target",
    dropOn === i && "drop",
  );

// Dragging onto slot `i`: a library patch copies in (asking before replacing a filled slot), another slot swaps
// with it, or with Option (Ctrl) held copies over it, asking the same way. A filled slot drags only while no mode is on.
function useSlotDrag(
  s: Session,
  findPatch: (path: string) => Patch | undefined,
  replaceOk: (i: number) => Promise<boolean>,
) {
  const { slots } = s.state;
  const [dropOn, setDropOn] = useState<number | null>(null);

  // Another slot: swap, or with the copy key held copy over (asking first if this one is filled).
  const dropSlot = async (move: Move, e: DragEvent) => {
    if (!copyHeld(e)) return s.swap(move);
    if (move.from !== move.to && (await replaceOk(move.to))) s.copy(move);
  };

  const dropPatch = async (i: number, e: DragEvent) => {
    const path = e.dataTransfer.getData(PATCH_DRAG_TYPE);
    const patch = findPatch(path);
    if (patch && (await replaceOk(i))) s.loadIntoSlot(i, { name: nameFromPath(path), patch });
  };

  const dragOver = (e: DragEvent) => {
    const slot = e.dataTransfer.types.includes(SLOT_DRAG_TYPE);
    if (!slot && !e.dataTransfer.types.includes(PATCH_DRAG_TYPE)) return false;
    e.preventDefault();
    e.dataTransfer.dropEffect = slot && !copyHeld(e) ? "move" : "copy";
    return true;
  };

  const dragProps = (i: number) => ({
    draggable: Boolean(slots[i]) && !s.mode,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(SLOT_DRAG_TYPE, String(i));
      e.dataTransfer.effectAllowed = "copyMove";
    },
    onDragOver: (e: DragEvent) => dragOver(e) && setDropOn(i),
    onDragLeave: () => setDropOn((d) => (d === i ? null : d)),
    onDrop: (e: DragEvent) => {
      setDropOn(null);
      e.preventDefault();
      const from = e.dataTransfer.getData(SLOT_DRAG_TYPE);
      void (from ? dropSlot({ from: Number(from), to: i }, e) : dropPatch(i, e));
    },
  });

  return { dropOn, dragProps };
}

// What a slot does, beyond plain clicks: renaming, Replace (with a confirm), dropping library
// patches on it, and its context menu.
function useSlotActions(s: Session, actions: SetActions, findPatch: (path: string) => Patch | undefined) {
  const { slots } = s.state;
  const ask = useDialog();
  const [menu, setMenu] = useState<MenuState | null>(null);

  const replaceOk = async (i: number) =>
    !slots[i] || (await confirmed(ask, `Replace slot ${i + 1}?`, `“${slots[i]!.name}” will be replaced.`));

  const storeOver = async (i: number) => {
    if (await replaceOk(i)) s.store(i);
  };

  const rename = async (i: number) => {
    const name = await askName(ask, `Rename slot ${i + 1}`, slots[i]?.name);
    if (name) s.rename(i, name);
  };

  const { dropOn, dragProps } = useSlotDrag(s, findPatch, replaceOk);

  const audition = (i: number, e: ReactPointerEvent) => {
    const slot = slots[i];
    if (!slot || !startsAudition(s, e)) return;
    e.preventDefault();
    s.preview(slot.patch, `slot:${i}`, slot.name);
    window.addEventListener("pointerup", () => s.endPreview(), { once: true });
  };

  const openMenu = (i: number, e: ReactMouseEvent) => {
    const slot = slots[i];
    setMenu(
      menuAt(e, [
        {
          label: slot ? "Replace with the patch in the editor…" : "Store the patch in the editor",
          onClick: () => void storeOver(i),
          disabled: !s.activePatch,
        },
        { label: "Rename…", onClick: () => void rename(i), disabled: !slot },
        { label: "Save as .syx…", onClick: () => slot && actions.savePatchAs(slot.patch, slot.name), disabled: !slot },
        { label: "Revert to saved", onClick: () => s.revertSlot(i), disabled: !s.changed[i] },
        { label: "Clear", onClick: () => s.clear(i), disabled: !slot },
      ]),
    );
  };

  return {
    menu,
    closeMenu: () => setMenu(null),
    dropOn,
    slotProps: (i: number) => ({
      ...dragProps(i),
      onClick: (e: ReactMouseEvent) => auditions(s, e) || SLOT_CLICKS[s.mode ?? "none"](s, i),
      onPointerDown: (e: ReactPointerEvent) => audition(i, e),
      onDoubleClick: () => slots[i] && !s.mode && void rename(i),
      onContextMenu: (e: ReactMouseEvent) => openMenu(i, e),
    }),
  };
}

function SetFileLine(p: { session: Session; actions: SetActions }) {
  const { setPath } = p.session.state;
  const { dirty } = p.session;
  return (
    <>
      <div className="setline">
        <span className="lbl">FILE</span>
        <span className="v" title={setPath ?? undefined}>
          {setPath ? nameFromPath(setPath) : "Unsaved set"}
          {dirty ? " ●" : ""}
        </span>
      </div>
      <div className="setbtns">
        <button className="btn mini" onClick={p.actions.newSet}>
          NEW
        </button>
        <button className="btn mini" disabled={!dirty} onClick={p.actions.saveSet}>
          SAVE
        </button>
        <button className="btn mini" onClick={p.actions.saveSetAs}>
          SAVE AS…
        </button>
        <button
          className="btn mini"
          disabled={!dirty}
          title="Put every slot back as the set was last opened or saved (undoable)"
          onClick={p.session.revertSet}
        >
          REVERT
        </button>
      </div>
    </>
  );
}

function ModeButton(p: { session: Session; mode: "delete" | "grab"; label: string; title: string }) {
  const s = p.session;
  return (
    <button
      className={`btn mini mode-${p.mode} ${s.mode === p.mode ? "sel" : ""}`}
      title={p.title}
      onClick={() => s.setMode(s.mode === p.mode ? null : p.mode)}
    >
      {p.label}
    </button>
  );
}

export function SetBlock(p: {
  session: Session;
  actions: SetActions;
  findPatch: (path: string) => Patch | undefined;
}) {
  const s = p.session;
  const { menu, closeMenu, dropOn, slotProps } = useSlotActions(s, p.actions, p.findPatch);
  return (
    <Section
      title="SET"
      className="patches"
      extra={
        <span className="row tight">
          <ModeButton session={s} mode="delete" label="DELETE" title="Then click slots to clear them" />
          <ModeButton
            session={s}
            mode="grab"
            label="GRAB"
            title="Then hold a slot to audition it (or Shift-hold a slot)"
          />
        </span>
      }
    >
      <div className={`slotgrid ${s.mode ? `armed ${s.mode}` : ""}`}>
        {s.state.slots.map((_, i) => (
          <button
            key={i}
            className={slotClass(s, i, dropOn)}
            style={{ "--row": rowColour(i).screen } as CSSProperties}
            title={slotTitle(s, i)}
            {...slotProps(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <SetFileLine session={s} actions={p.actions} />
      <ContextMenu menu={menu} onClose={closeMenu} />
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
          title="Stop morphing and go back to the patch from before the morph"
          onClick={() => {
            if (s.mode === "target") s.setMode(null);
            s.clearMorph();
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
