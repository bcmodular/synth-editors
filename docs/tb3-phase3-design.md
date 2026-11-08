# TB-3 Phase 3 — Patch library, slots and sets (design draft)

Status: **implemented**. It replaces the PLAN.md Phase 3 outline, which followed the TouchOSC
model (16 slots + JSON banks). Here the file system is a first-class part of the editor.

Code: `core/patchSet.ts` (file and set formats), `editor/useSession.ts` (slots, active patch, what
the TB-3 holds, preview, STORE, morph, recovery), `editor/useLibrary.ts` + `electron/main.cjs`
(file access over IPC), `editor/PatchesBlock.tsx` (PATCHES and MORPH), `editor/LibraryBrowser.tsx`.

## Concepts

- **Library**: one root folder, chosen once and remembered. It holds `.syx` patches and `.tb3set`
  set files, in any number of subfolders.
- **Patch file**: a `.syx` dump of the 11 TB-3 blocks (the same format as Phase 1's
  `patchFromSysex` / `patchToSysex`). The name is the filename without its extension.
- **Set**: 16 slots, each either empty or a self-contained patch plus a name. A set is a
  "mega-patch". Loading a file into a slot **copies** it, so the set never refers back to library
  files, and renaming, moving or deleting files can't break a set.
- **Active patch**: what the editor shows and the TB-3 plays. It's either one of the slots or the
  **unslotted buffer** (after Sync from TB-3, after loading a file without putting it in the set, or
  before any slot has been used). The PATCH block's EDITING line names it.

## Layout

A permanent sidebar on the left holds, top to bottom:

- **PATCH**: what the editor shows (EDITING / AUDITION), the folder saves go into, and SAVE AS…
  to write that patch as a `.syx`.
- **SET**: STORE, the 16 slots, and the set file line (NEW / SAVE / SAVE AS…).
- **MORPH**: target, amount and send rate.
- **LIBRARY**: fills the rest of the sidebar's height.
 (The first build had the library as an overlay that slid down from the PATCHES
header. After trying it, the library moved into the sidebar so it's always to hand.)

## Browser

- It shows a tree of the library: folders, patches, and sets (with their own icon).
- **Save folder**: clicking a folder makes it the folder saves go into. The library folder itself
  is the tree's top node, so it can be picked (and dropped onto) like any other folder.
- **Search box**: filters the tree by name as you type.
- **Invalid files**: every `.syx` is listed, but files that don't parse as a full TB-3 patch get
  an error badge and can't be loaded or previewed.
- **Double-click a patch** (or right-click → Load into editor): load it into the unslotted buffer
  and send it, without touching the set. STORE then puts it into a slot under its file name.
- **Preview button** on each patch row: while it's held, the TB-3 plays that file (changed blocks
  only) and the editor shows it, read only (the EDITING line reads AUDITION). On release both
  return to the active patch, including any unsaved edits.
- **Drag** a patch onto a slot to copy it in, taking the filename as the slot name. Dropping on a
  full slot asks first.
- **Double-click** a set to open it (see Sets).
- **File operations**: rename, move to Trash, new folder, and drag to move between folders.
  Anything else is done in Finder.

## Slots (the SET block)

- An 8 × 2 grid as now. Hovering shows the slot name. States: empty, filled, active, modified
  (unsaved edits), and "not sent since opening" (see Startup).
- **Click a filled slot**: recall it. The changed blocks go to the TB-3 and it becomes active.
- **Edits are per slot**: each slot keeps its own unsaved edits in memory. Switching between slots
  never loses work, and edits are only written when the set is saved.
- **Option + hold a slot**: grab, i.e. audition it. Releasing returns to the active patch. This
  matches the browser's preview button.
- **Double-click a slot**: rename it. The name is stored in the set; library files aren't touched.
- **STORE button** (SET header): it blinks, then clicking a slot stores the active patch there
  (asking before overwriting a full slot). Esc cancels. This is how the unslotted buffer gets into
  a slot, and it maps onto a Launchpad side button later.
- **Right-click a slot**: Clear; Save slot as .syx… (into the browser's current folder).

## Sets

- File format: one JSON file, `Name.tb3set`:
  `{ "format": "tb3set", "version": 1, "slots": [ { "name": "Acid 1", "blocks": "<hex of the 11 blocks>" } | null, … 16 ] }`.
  The hex is the same 11-block dump as a `.syx`, so a slot round-trips byte for byte.
- **New set / Save set / Save set as…** (the FILE line in SET): Save As writes into the browser's current folder, asking
  only for a name. The set's title shows in the PATCHES header, marked when it has unsaved changes.
- Opening a set while the current one has unsaved changes asks: Save / Discard / Cancel.
- **Unslotted buffer**: SAVE AS… in PATCH writes the patch in the editor as a `.syx`
  into the browser's current folder, or STORE puts it into a slot.

## Morph

- The target is one of the slots. The base is the active patch, including its unsaved edits, at
  the moment the target is chosen.
- The MORPH block has a target picker, an amount fader and a send RATE (Phase 1 morph rules:
  continuous params glide, while switches and EFX types snap at 0.5).
- **Send rate**: patches that differ a lot can flood the TB-3 until it stops playing. The editor
  follows the fader at once, but the TB-3 gets only the changed bytes (`diffRuns`), from a token
  bucket of RATE changes per second (10–500, default 100, remembered; up to 0.2 s of burst).
  Each tick works from the latest blend, so the TB-3 skips intermediate values and catches up to
  where the fader stopped. Sends rotate through the changed runs so no block starves.
- A block where a snapping byte changes (a switch, an enum, an EFX type) goes whole, in one
  message, ahead of the runs (`morphRuns`). Changing an EFX type makes the TB-3 reset that
  effect's slots, so slot bytes sent on their own could be left in the wrong state.
- **Status: experimental.** Even at 10/s a fast drag between very different patches has left some
  params wrong on the TB-3 (seen before the whole-block rule above). Morph stays as an advanced
  feature to experiment with; SYNC TO TB-3 resends the whole patch if the TB-3 drifts.
- The morph result is a temporary blend. Editing a control, or saving, turns it into the active
  slot's edits.

## Startup and persistence

- The app remembers the library root, the last set file, and the active slot.
- **At launch**: the last set reopens, but **nothing is sent** to the TB-3. Every slot shows a
  "not sent since opening" mark until it's recalled. The editor shows the last active slot.
- **Unsaved slot edits survive quitting**: the whole session is kept in the app's local storage
  (written shortly after each change and on quit) and restored on the next launch, still marked
  as modified.

## Implementation notes

- File access runs in Electron's main process behind a small IPC API exposed by a preload script
  (the old zoom-only preload was removed in 44424c8):
  `listTree(root)`, `readFile`, `writeFile`, `rename`, `trash`, `mkdir`, `watch(root)` (to pick up
  Finder changes), and a folder picker for the library root.
- Recall, preview, grab and morph all go through `diffBlocks` + `blocksToSysex` against what the
  TB-3 currently holds.
- `packages/bank-files` from PLAN.md is replaced by a TB-3-specific set format. A shared package
  can wait until the SP-404 needs one.


## Open questions

- Whether the browser overlay should also show a patch's details (e.g. its EFX types) on hover.
