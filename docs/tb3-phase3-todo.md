# TB-3 Phase 3 — to do

What's left for the patch library, slots and sets. The design is in
[tb3-phase3-design.md](tb3-phase3-design.md); tick items off here as they land.

## Features

- [ ] **Undo history** (with redo): slot DELETE, Replace, CLEAR on a morph, parameter edits. This
      is why DELETE no longer asks first.

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
- [ ] The same with unsaved edits on the active slot (needs a control edit in the test).
- [x] Morph CLEAR: the TB-3 goes back to the pre-morph patch.
- [x] At launch the last set reopens and nothing is sent.

## Code

- [ ] Unit tests for the session logic (store, delete, grab, morph base and CLEAR). The end-to-end
      tests cover what reaches the TB-3; these would cover the state rules, and the pure parts
      need pulling out of `useSession` first, which the undo history needs anyway.
- [ ] Move `askName` / `confirmed` out of `ui/Dialog.tsx` so Fast Refresh works on it again.
