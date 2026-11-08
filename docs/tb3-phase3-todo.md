# TB-3 Phase 3 — to do

What's left for the patch library, slots and sets. The design is in
[tb3-phase3-design.md](tb3-phase3-design.md); tick items off here as they land.

## Features

- [x] **Undo history** (with redo): slot DELETE, Replace, CLEAR on a morph, parameter edits (and
      STORE and rename). This is why DELETE no longer asks first. ⌘Z / ⇧⌘Z or UNDO / REDO in the
      TB-3 block; see the design's Undo history section.

## Parked

- Morph: a fast drag between very different patches can leave params wrong on the TB-3. It stays
  marked experimental.

## Checks on the TB-3

Automated in `apps/tb3/e2e/` (Playwright driving the built Electron app). Each test reads back
what the TB-3 holds (RQ1) and compares it with what it should hold.

```bash
npm run test:e2e                                  # fake TB-3: also checks which blocks were sent
TB3_PORT="H12MIDI-Pro Port 4" npm run test:tb3    # the real TB-3; puts its sound back afterwards
```

- [x] Recall a slot: only the changed blocks go, and the TB-3 matches the editor.
- [x] Click an empty slot to store: nothing is sent, and the slot recalls correctly afterwards.
- [x] GRAB and library ▶: the TB-3 plays the auditioned patch, then returns to the active one.
- [x] The same with unsaved edits on the active slot: the TB-3 returns to the edited patch.
- [x] Morph CLEAR: the TB-3 goes back to the pre-morph patch.
- [x] At launch the last set reopens and nothing is sent.

## Code

- [x] Code health check with CodeScene (MCP) over `apps/tb3`, fixing the worst hotspots first, and
      again on each change from here on (`AGENTS.md`). `useSession.ts` 7.85, `LibraryBrowser.tsx`
      8.08 and `PatchesBlock.tsx` 8.47 are now all 10; everything else was 9.07 or better.
- [x] Unit tests for the session logic (store, delete, grab, morph base and CLEAR). The pure rules
      are in `editor/sessionState.ts`; the morph pump's token bucket in `editor/morphPump.ts`.
- [x] Move `askName` / `confirmed` out of `ui/Dialog.tsx` so Fast Refresh works on it again
      (now `ui/dialogs.ts`; `PATCH_DRAG_TYPE` likewise moved out of `PatchesBlock.tsx`).
