// Patch library: the sidebar under PATCHES and MORPH.
//   folders: click to select (the default folder for saves) · triangle or double-click to open · drop patches/sets/folders on them to move
//   patches: double-click to load into the editor (not the set) · hold ▶ to audition ·
//            drag onto a slot · right-click for load / rename / trash
//   sets: double-click to open
import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { nameFromPath } from "../core/patchSet";
import { Section } from "../ui/controls";
import { ContextMenu, askName, confirmed, menuAt, useDialog } from "../ui/Dialog";
import type { MenuItem, MenuState } from "../ui/Dialog";
import { PATCH_DRAG_TYPE } from "./PatchesBlock";
import { joinPath, parentOf } from "./useLibrary";
import type { LibEntry, Library } from "./useLibrary";
import type { Session } from "./useSession";
import type { SetActions } from "./useSetActions";

const MOVE_DRAG_TYPE = "application/x-tb3-move";

const when = (ms: number | undefined) =>
  ms ? new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "–";

// Hover text: the path, and for files when they were created and last changed.
const tip = (e: LibEntry) =>
  [
    e.path,
    e.error && `Not a TB-3 patch: ${e.error}`,
    e.kind !== "dir" && `Created ${when(e.created)}\nModified ${when(e.modified)}`,
  ]
    .filter(Boolean)
    .join("\n");

// Entries whose name matches, plus the folders leading to them.
function filter(entries: LibEntry[], q: string): LibEntry[] {
  const out: LibEntry[] = [];
  for (const e of entries) {
    const kids = e.children ? filter(e.children, q) : [];
    if (e.name.toLowerCase().includes(q) || kids.length) out.push(e.children ? { ...e, children: kids } : e);
  }
  return out;
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
  const ask = useDialog();
  const files = window.tb3Files;
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const tree = useMemo(() => (q ? filter(lib.tree, q) : lib.tree), [lib.tree, q]);

  const run = (fn: () => Promise<unknown>) =>
    void fn().catch((e: unknown) => p.onError(e instanceof Error ? e.message : String(e)));

  const newFolder = (dir: string) =>
    run(async () => {
      const name = await askName(ask, "New folder", "New folder");
      if (!name || !files) return;
      const path = joinPath(dir, name);
      await files.mkdir(path);
      p.onFolder(path);
    });

  const rename = (e: LibEntry) =>
    run(async () => {
      const ext = e.kind === "dir" ? "" : e.name.slice(e.name.lastIndexOf("."));
      const name = await askName(
        ask,
        `Rename ${e.kind === "dir" ? "folder" : "file"}`,
        e.kind === "dir" ? e.name : nameFromPath(e.name),
      );
      if (!name || !files) return;
      await files.rename(e.path, joinPath(parentOf(e.path), name.endsWith(ext) ? name : name + ext));
    });

  const trash = (e: LibEntry) =>
    run(async () => {
      if (!files || !(await confirmed(ask, "Move to Trash?", e.path, "MOVE TO TRASH"))) return;
      await files.trash(e.path);
    });

  const move = (from: string, dir: string) =>
    run(async () => {
      if (!files || parentOf(from) === dir || dir === from || dir.startsWith(`${from}/`)) return;
      await files.rename(from, joinPath(dir, from.split("/").pop()!));
    });

  const load = (e: LibEntry) => e.patch && s.load(e.patch, nameFromPath(e.name));

  const dropTarget = (dir: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(MOVE_DRAG_TYPE)) return;
      e.preventDefault();
      e.stopPropagation(); // the innermost folder wins over the tree (the root) around it
      e.dataTransfer.dropEffect = "move";
      setDropOn(dir);
    },
    onDragLeave: () => setDropOn((d) => (d === dir ? null : d)),
    onDrop: (e: DragEvent) => {
      setDropOn(null);
      const from = e.dataTransfer.getData(MOVE_DRAG_TYPE);
      if (from) {
        e.preventDefault();
        e.stopPropagation();
        move(from, dir);
      }
    },
  });

  const menuItems = (e: LibEntry): MenuItem[] => [
    ...(e.kind === "dir" ? [{ label: "New folder…", onClick: () => newFolder(e.path) }] : []),
    ...(e.kind === "set" ? [{ label: "Open set", onClick: () => p.actions.openSet(e.path) }] : []),
    ...(e.kind === "patch"
      ? [{ label: "Load into editor", onClick: () => load(e), disabled: !e.patch }]
      : []),
    { label: "Rename…", onClick: () => rename(e) },
    { label: "Move to Trash", onClick: () => trash(e) },
    { label: "Reveal in Finder", onClick: () => void files?.reveal(e.path) },
  ];

  // Expanding is the disclosure triangle (or double-click); clicking the row picks the save folder.
  const toggle = (path: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(path)) n.delete(path);
      else n.add(path);
      return n;
    });
  const twist = (path: string, open: boolean) => (
    <span
      className="twist open-toggle"
      onClick={(ev) => {
        ev.stopPropagation();
        toggle(path);
      }}
      onDoubleClick={(ev) => ev.stopPropagation()}
    >
      {open ? "▾" : "▸"}
    </span>
  );

  const row = (e: LibEntry, depth: number) => {
    const isDir = e.kind === "dir";
    const open = Boolean(q) || !collapsed.has(e.path);
    const valid = e.kind === "patch" && e.patch;
    const cls = [
      "librow",
      e.kind,
      e.error ? "bad" : "",
      isDir && p.folder === e.path ? "current" : "",
      dropOn === e.path ? "drop" : "",
      s.previewKey === `file:${e.path}` ? "preview" : "",
    ].join(" ");
    return (
      <div key={e.path}>
        <div
          className={cls}
          style={{ paddingLeft: 8 + depth * 16 }}
          draggable
          onDragStart={(ev) => {
            ev.dataTransfer.setData(MOVE_DRAG_TYPE, e.path);
            if (valid) ev.dataTransfer.setData(PATCH_DRAG_TYPE, e.path);
            ev.dataTransfer.effectAllowed = "copyMove";
          }}
          onClick={() => p.onFolder(isDir ? e.path : parentOf(e.path))}
          onDoubleClick={() => (isDir ? toggle(e.path) : e.kind === "set" ? p.actions.openSet(e.path) : load(e))}
          onContextMenu={(ev) => setMenu(menuAt(ev, menuItems(e)))}
          {...(isDir ? dropTarget(e.path) : {})}
          title={tip(e)}
        >
          {isDir ? twist(e.path, open) : <span className="twist" />}
          {!isDir && <span className="icon">{e.kind === "set" ? "▦" : "♪"}</span>}
          <span className="name">{isDir ? e.name : nameFromPath(e.name)}</span>
          {e.kind === "set" && <span className="tag">SET</span>}
          {e.error && <span className="tag bad">INVALID</span>}
          {valid && (
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
          )}
        </div>
        {isDir && open && e.children?.map((c) => row(c, depth + 1))}
      </div>
    );
  };

  // The library folder itself: the top of the tree, a save folder and a drop target like any other.
  const rootOpen = Boolean(q) || !collapsed.has("");
  const rootRow = (root: string) => (
    <div
      className={`librow dir root ${p.folder === "" ? "current" : ""} ${dropOn === "" ? "drop" : ""}`}
      style={{ paddingLeft: 8 }}
      title={root}
      onClick={() => p.onFolder("")}
      onDoubleClick={() => toggle("")}
      onContextMenu={(ev) =>
        setMenu(
          menuAt(ev, [
            { label: "New folder…", onClick: () => newFolder("") },
            { label: "Reveal in Finder", onClick: () => void files?.reveal("") },
          ]),
        )
      }
      {...dropTarget("")}
    >
      {twist("", rootOpen)}
      <span className="name">{root.split("/").pop()}</span>
    </div>
  );

  return (
    <Section
      title="LIBRARY"
      className="library"
      extra={
        <button className="btn" disabled={!lib.available} onClick={() => void lib.choose()}>
          {lib.root ? "CHANGE…" : "CHOOSE…"}
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
        <button className="btn mini" disabled={!lib.root} onClick={() => newFolder(p.folder)}>
          + SUB-FOLDER
        </button>
      </div>
      <div className={`libtree ${dropOn === "" ? "drop" : ""}`} {...dropTarget("")}>
        {!lib.available ? (
          <p className="status">The patch library needs the desktop app.</p>
        ) : lib.error ? (
          <p className="status err">{lib.error}</p>
        ) : !lib.root ? (
          <p className="status">Choose a folder of TB-3 .syx patches to start.</p>
        ) : (
          <>
            {rootRow(lib.root)}
            {!rootOpen ? null : tree.length ? (
              tree.map((e) => row(e, 1))
            ) : (
              <p className="status">{q ? "Nothing matches." : "This folder has no .syx patches or sets yet."}</p>
            )}
          </>
        )}
      </div>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </Section>
  );
}
