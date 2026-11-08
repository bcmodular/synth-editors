// Patch library: the sidebar under PATCHES and MORPH.
//   folders: click to select (the default folder for saves) · triangle or double-click to open · drop patches/sets/folders on them to move
//   patches: double-click to load into the editor (not the set) · hold ▶ to audition ·
//            drag onto a slot · right-click for load / rename / trash
//   sets: double-click to open
import { useMemo, useState } from "react";
import type { DragEvent, MouseEvent as ReactMouseEvent } from "react";
import { nameFromPath } from "../core/patchSet";
import { Section } from "../ui/controls";
import { ContextMenu } from "../ui/Dialog";
import { askName, confirmed, menuAt, useDialog } from "../ui/dialogs";
import type { MenuItem, MenuState } from "../ui/dialogs";
import { MOVE_DRAG_TYPE, PATCH_DRAG_TYPE } from "./dragTypes";
import { displayName, entryTip, filterTree, moveTarget, renameTarget } from "./libraryTree";
import type { Move } from "./libraryTree";
import { joinPath, parentOf } from "./useLibrary";
import type { LibEntry, Library } from "./useLibrary";
import type { Session } from "./useSession";
import type { SetActions } from "./useSetActions";

const ROOT = ""; // the library folder itself

// File operations on the library, reporting failures through `onError`.
function useLibraryOps(onFolder: (dir: string) => void, onError: (msg: string) => void) {
  const ask = useDialog();
  const files = window.tb3Files;
  const run = (fn: (f: NonNullable<typeof files>) => Promise<unknown>) => {
    if (!files) return;
    void fn(files).catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
  };
  return {
    newFolder: (dir: string) =>
      run(async (f) => {
        const name = await askName(ask, "New folder", "New folder");
        if (!name) return;
        await f.mkdir(joinPath(dir, name));
        onFolder(joinPath(dir, name));
      }),
    rename: (e: LibEntry) =>
      run(async (f) => {
        const name = await askName(ask, `Rename ${e.kind === "dir" ? "folder" : "file"}`, displayName(e));
        if (name) await f.rename(e.path, renameTarget(e, name));
      }),
    trash: (e: LibEntry) =>
      run(async (f) => {
        if (await confirmed(ask, "Move to Trash?", e.path, "MOVE TO TRASH")) await f.trash(e.path);
      }),
    move: (m: Move) => {
      const to = moveTarget(m);
      if (to) run((f) => f.rename(m.from, to));
    },
    reveal: (path: string) => void files?.reveal(path),
  };
}

type Ops = ReturnType<typeof useLibraryOps>;

// Folders accept moves of anything in the library. The innermost folder wins over the tree (the
// root) around it.
function useDropTargets(move: Ops["move"]) {
  const [dropOn, setDropOn] = useState<string | null>(null);
  const dropTarget = (dir: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(MOVE_DRAG_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDropOn(dir);
    },
    onDragLeave: () => setDropOn((d) => (d === dir ? null : d)),
    onDrop: (e: DragEvent) => {
      setDropOn(null);
      const from = e.dataTransfer.getData(MOVE_DRAG_TYPE);
      if (!from) return;
      e.preventDefault();
      e.stopPropagation();
      move({ from, into: dir });
    },
  });
  return { dropOn, dropTarget };
}

// Everything a row needs from the browser.
interface RowCtx {
  isOpen: (path: string) => boolean;
  toggle: (path: string) => void;
  folder: string;
  dropOn: string | null;
  dropTarget: ReturnType<typeof useDropTargets>["dropTarget"];
  previewKey: string | null;
  onFolder: (dir: string) => void;
  activate: (e: LibEntry) => void; // double-click
  openMenu: (ev: ReactMouseEvent, e: LibEntry) => void;
  session: Session;
}

const classes = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

// Expanding is the disclosure triangle (or double-click); clicking the row picks the save folder.
function Twist(p: { open: boolean; onToggle: () => void }) {
  return (
    <span
      className="twist open-toggle"
      onClick={(ev) => {
        ev.stopPropagation();
        p.onToggle();
      }}
      onDoubleClick={(ev) => ev.stopPropagation()}
    >
      {p.open ? "▾" : "▸"}
    </span>
  );
}

// Hold to audition a patch file.
function PlayButton(p: { entry: LibEntry; session: Session }) {
  const { entry: e, session: s } = p;
  return (
    <button
      className="btn mini play"
      title="Hold to audition"
      onClick={(ev) => ev.stopPropagation()}
      onPointerDown={(ev) => {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        s.preview(e.patch!, `file:${e.path}`, nameFromPath(e.name));
        window.addEventListener("pointerup", () => s.endPreview(), { once: true });
      }}
    >
      ▶
    </button>
  );
}

function EntryLabel(p: { entry: LibEntry }) {
  const e = p.entry;
  return (
    <>
      {e.kind !== "dir" && <span className="icon">{e.kind === "set" ? "▦" : "♪"}</span>}
      <span className="name">{displayName(e)}</span>
      {e.kind === "set" && <span className="tag">SET</span>}
      {e.error && <span className="tag bad">INVALID</span>}
    </>
  );
}

const isPlayable = (e: LibEntry) => e.kind === "patch" && Boolean(e.patch);

const rowClass = (e: LibEntry, ctx: RowCtx) =>
  classes(
    "librow",
    e.kind,
    e.error && "bad",
    e.kind === "dir" && ctx.folder === e.path && "current",
    ctx.dropOn === e.path && "drop",
    ctx.previewKey === `file:${e.path}` && "preview",
  );

// Anything can move to another folder; valid patches can also be dropped on a slot.
function startDrag(ev: DragEvent, e: LibEntry) {
  ev.dataTransfer.setData(MOVE_DRAG_TYPE, e.path);
  if (isPlayable(e)) ev.dataTransfer.setData(PATCH_DRAG_TYPE, e.path);
  ev.dataTransfer.effectAllowed = "copyMove";
}

// Folders: the disclosure triangle and drops. Files: an empty gutter.
function folderParts(e: LibEntry, ctx: RowCtx) {
  if (e.kind !== "dir") return { open: false, twist: <span className="twist" />, drop: {} };
  const open = ctx.isOpen(e.path);
  return {
    open,
    twist: <Twist open={open} onToggle={() => ctx.toggle(e.path)} />,
    drop: ctx.dropTarget(e.path),
  };
}

function LibRow(p: { entry: LibEntry; depth: number; ctx: RowCtx }) {
  const { entry: e, ctx } = p;
  const { open, twist, drop } = folderParts(e, ctx);
  return (
    <div>
      <div
        className={rowClass(e, ctx)}
        style={{ paddingLeft: 8 + p.depth * 16 }}
        draggable
        onDragStart={(ev) => startDrag(ev, e)}
        onClick={() => ctx.onFolder(e.kind === "dir" ? e.path : parentOf(e.path))}
        onDoubleClick={() => ctx.activate(e)}
        onContextMenu={(ev) => ctx.openMenu(ev, e)}
        {...drop}
        title={entryTip(e)}
      >
        {twist}
        <EntryLabel entry={e} />
        {isPlayable(e) && <PlayButton entry={e} session={ctx.session} />}
      </div>
      {open && e.children?.map((c) => <LibRow key={c.path} entry={c} depth={p.depth + 1} ctx={ctx} />)}
    </div>
  );
}

// What shows in place of the tree when there is none.
function libraryStatus(lib: Library): { text: string; err?: boolean } | null {
  if (!lib.available) return { text: "The patch library needs the desktop app." };
  if (lib.error) return { text: lib.error, err: true };
  if (!lib.root) return { text: "Choose a folder of TB-3 .syx patches to start." };
  return null;
}

function useCollapsed() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (path: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (!n.delete(path)) n.add(path);
      return n;
    });
  return { collapsed, toggle };
}

export function LibraryBrowser(p: {
  library: Library;
  session: Session;
  actions: SetActions;
  folder: string;
  onFolder: (dir: string) => void;
  onError: (msg: string) => void;
}) {
  const { library: lib, session: s } = p;
  const ops = useLibraryOps(p.onFolder, p.onError);
  const [query, setQuery] = useState("");
  const { collapsed, toggle } = useCollapsed();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const { dropOn, dropTarget } = useDropTargets(ops.move);
  const q = query.trim().toLowerCase();
  const tree = useMemo(() => (q ? filterTree(lib.tree, q) : lib.tree), [lib.tree, q]);
  const load = (e: LibEntry) => e.patch && s.load(e.patch, nameFromPath(e.name));

  // The first menu item and the double-click action depend on the kind of entry.
  const kindItem: Record<LibEntry["kind"], (e: LibEntry) => MenuItem> = {
    dir: (e) => ({ label: "New folder…", onClick: () => ops.newFolder(e.path) }),
    set: (e) => ({ label: "Open set", onClick: () => p.actions.openSet(e.path) }),
    patch: (e) => ({ label: "Load into editor", onClick: () => load(e), disabled: !e.patch }),
  };
  const menuItems = (e: LibEntry): MenuItem[] => [
    kindItem[e.kind](e),
    { label: "Rename…", onClick: () => ops.rename(e) },
    { label: "Move to Trash", onClick: () => ops.trash(e) },
    { label: "Reveal in Finder", onClick: () => ops.reveal(e.path) },
  ];
  const activations: Record<LibEntry["kind"], (e: LibEntry) => void> = {
    dir: (e) => toggle(e.path),
    set: (e) => p.actions.openSet(e.path),
    patch: load,
  };

  const ctx: RowCtx = {
    isOpen: (path) => Boolean(q) || !collapsed.has(path),
    toggle,
    folder: p.folder,
    dropOn,
    dropTarget,
    previewKey: s.previewKey,
    onFolder: p.onFolder,
    activate: (e) => activations[e.kind](e),
    openMenu: (ev, e) => setMenu(menuAt(ev, menuItems(e))),
    session: s,
  };
  const rootMenu = (ev: ReactMouseEvent) =>
    setMenu(
      menuAt(ev, [
        { label: "New folder…", onClick: () => ops.newFolder(ROOT) },
        { label: "Reveal in Finder", onClick: () => ops.reveal(ROOT) },
      ]),
    );
  const status = libraryStatus(lib);
  const chooseLabel = lib.root ? "CHANGE…" : "CHOOSE…";

  return (
    <Section
      title="LIBRARY"
      className="library"
      extra={
        <button className="btn" disabled={!lib.available} onClick={() => void lib.choose()}>
          {chooseLabel}
        </button>
      }
    >
      <div className="libbar">
        <input
          className="search"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
        <button className="btn mini" disabled={!lib.root} onClick={() => ops.newFolder(p.folder)}>
          + SUB-FOLDER
        </button>
      </div>
      <div className={classes("libtree", dropOn === ROOT && "drop")} {...dropTarget(ROOT)}>
        {status ? (
          <p className={classes("status", status.err && "err")}>{status.text}</p>
        ) : (
          <LibraryTree root={lib.root!} tree={tree} searching={Boolean(q)} ctx={ctx} onRootMenu={rootMenu} />
        )}
      </div>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </Section>
  );
}

// The library folder itself at the top of the tree (a save folder and a drop target like any
// other), then its contents.
function LibraryTree(p: {
  root: string;
  tree: LibEntry[];
  searching: boolean;
  ctx: RowCtx;
  onRootMenu: (ev: ReactMouseEvent) => void;
}) {
  const { ctx } = p;
  const open = ctx.isOpen(ROOT);
  const empty = p.searching ? "Nothing matches." : "This folder has no .syx patches or sets yet.";
  return (
    <>
      <div
        className={classes("librow dir root", ctx.folder === ROOT && "current", ctx.dropOn === ROOT && "drop")}
        style={{ paddingLeft: 8 }}
        title={p.root}
        onClick={() => ctx.onFolder(ROOT)}
        onDoubleClick={() => ctx.toggle(ROOT)}
        onContextMenu={p.onRootMenu}
        {...ctx.dropTarget(ROOT)}
      >
        <Twist open={open} onToggle={() => ctx.toggle(ROOT)} />
        <span className="name">{p.root.split("/").pop()}</span>
      </div>
      {open && p.tree.map((e) => <LibRow key={e.path} entry={e} depth={1} ctx={ctx} />)}
      {open && !p.tree.length && <p className="status">{empty}</p>}
    </>
  );
}
