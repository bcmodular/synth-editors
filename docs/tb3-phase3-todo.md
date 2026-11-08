# TB-3 Phase 3 — to do

What's left for the patch library, slots and sets. The design is in
[tb3-phase3-design.md](tb3-phase3-design.md); tick items off here as they land.

## Features

- [ ] **Undo history** (with redo): slot DELETE, Replace, CLEAR on a morph, parameter edits. This
      is why DELETE no longer asks first.
- [ ] **Patch details on hover** in the library, e.g. its EFX types (the design's open question).

## Morph

- [ ] Find why a fast drag between very different patches can leave params wrong on the TB-3, and
      decide whether morph stays marked experimental.

## Checks on the TB-3

None of these have been seen on the hardware yet; the debug runs had no MIDI port.

- [ ] Recall a slot: only the changed blocks go, and the TB-3 matches the editor.
- [ ] Click an empty slot to store: nothing is sent, and the slot recalls correctly afterwards.
- [ ] GRAB and library ▶: the TB-3 plays the auditioned patch, then returns to the active one on
      release, unsaved edits included.
- [ ] Morph CLEAR: the TB-3 goes back to the pre-morph patch.
- [ ] At launch the last set reopens and nothing is sent.

## Code

- [ ] Tests for the session logic (store, delete, grab, morph base and CLEAR, recovery after
      relaunch). It lives in `useSession` today, so the pure parts need pulling out first.
- [ ] Move `askName` / `confirmed` out of `ui/Dialog.tsx` so Fast Refresh works on it again.
