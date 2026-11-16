# JV-2080 editor — remaining work

An inventory made 2026-11-16 from [jv2080-design.md](jv2080-design.md), [jv2080-not-in-editor.md](jv2080-not-in-editor.md),
PLAN.md and the code in `apps/jv2080`; updated the same day after undo, the library, CC learn and the end-to-end
tests went in. Where these disagree, this list says which is current.

## Where it stands

Phases 3 and 4 are done, and Phase 5 apart from packaging. The editor has:
- the mixer, EFX with a view for every type, chorus, reverb, patch settings, four tone columns with envelope
  graphs, the wave library;
- (i) help for every section;
- fit zoom, demo mode;
- every patch parameter except the controller matrix and the EFX control;
- undo / redo, the library sidebar (slots, sets, patch files, auditions), and CC learn from a controller;
- end-to-end tests against a fake JV.

## 1. Check on the JV

Much of the recent work has only been tested in demo mode or against the manual. A pass with the JV connected:

- [ ] Reads after the spike's removal: SYNC FROM JV, the bank browser, and **NO REPLY FROM THE JV** when the
      interface is off.
- [ ] MIDI ▾: Device ID and patch channel carried over, and changing them works.
- [ ] A new EFX type sends neutral start values, and the read-back agrees.
- [ ] The parameters added on 2026-11-15 (`core/paramsMore.ts`), none of them tried on the JV yet. For example:
      - a key split and a velocity layer (RANGES);
      - level and filter velocity sensitivity;
      - LFO delay and fade-in;
      - structure type 3 with the booster;
      - tone delay;
      - FXM.
- [ ] Renaming the patch from the top strip.
- [ ] The knob-based PATCH panel; Tempo dims when the clock is SYSTEM.
- [ ] Undo after a drag, a new EFX type and a bank load: the JV follows each step back.
- [ ] Recall a slot, hold ▶ on a file, GRAB a slot: each audition plays on the JV and the release goes back.
- [ ] Quit and reopen: the editor's patch goes to the JV.
- [ ] CC learn with a real controller: a knob in pickup and relative modes, and an EFX knob that stops when the
      type changes.

## 2. Finish Phase 3 (editor)

- [x] **Undo / redo** (2026-11-16).
- [ ] **Controller matrix:**
      - Patch Control Source 2–3 and Control 1–3 Hold/Peak;
      - each tone's Controller 1–3 × Destination 1–4 with their depths.

      It's the last group of patch parameters. A panel with a 3 × 4 matrix per tone.
- [ ] **EFX control:** EFX Control Source 1–2, Depth 1–2 and Hold/Peak, which move the type's realtime (#)
      parameter.
- [ ] **Rates and times in real units.** 75 EFX parameters have kind `unknown` and show the raw value, as "(63)".
      The chorus rate and pre-delay, reverb time, LFO rates and envelope times are raw 0–127 too. The EFX drawings
      for delays, pre-delays and rates are drawn in proportion only. This needs a table of raw → Hz / ms: measured
      on the JV, or from another source.

## 3. Decisions waiting on you

From the open questions in [jv2080-not-in-editor.md](jv2080-not-in-editor.md#open-questions-2026-11-15):

1. ~~**Patch files:** a library like the TB-3's, or Save / Open dialogs?~~ Built as a library like the TB-3's, with
   one patch per `.syx`, while you were out (2026-11-16). Whole USER bank files are still open.
2. **Writing to USER memory** (out of scope in v1 so far). If it comes in:
   - the slot chooser;
   - the confirmation;
   - an automatic backup first, and where backups go;
   - whether to select the slot afterwards.
3. **Preset scan** for a patch browser. It takes 2–3 minutes and changes the JV's sound while it runs. Should it
   restore the patch afterwards, and should the browser list USER patches and files too?
4. **Structure diagrams:** words only, or flow diagrams? Drawing them needs the JV's Structure page checked.
5. **FILTER's VEL knob** sits in the LFO row's free slot. Keep it there?
6. **The "⋯" popovers**, or an expanded single-tone view (the JV's Palette idea)?
7. **TAP-SYNC in Tone Delay:** probably not on the JV-2080. Hide it, or leave it?
8. From the design: copy the TB-3's library and controls again, or extract `packages/ui` and
   `packages/bank-files` first? *Copied again for now* (each copied file says so in its first line); extracting is
   still worth doing now that three apps share them.
9. **Morph** (the TB-3's, byte-wise): v1 or later?

## 4. Phase 4 — library ✅

Built 2026-11-16 (see jv2080-design.md, Phases). Left over:
- [ ] Whole-bank `.syx` files (128 USER patches), if wanted (decision 1).
- [ ] The library has no keyboard shortcuts of its own beyond ⌘Z / ⇧⌘Z.

## 5. Phase 5 — controllers and packaging

- [x] CC learn (2026-11-16): CC ▾ in the top strip.
- [ ] CC learn for the envelope graphs and the EFX drawings' handles: they have no single control to click. Their
      parameters can still be learned where a knob shows them.
- [x] Launchpad: not wanted.
- [ ] A packaged build. The TB-3 has an `electron-builder` config; the JV app has only `vite build`.

## 6. Tests

- [x] **End-to-end tests** (`npm run test:e2e:jv2080`, 17 tests) against a fake JV with a stand-in controller.
- [ ] A hardware mode for them, like the TB-3's `TB3_HW=1`, that restores the JV's patch afterwards.
- [x] Edits from the JV's own panel coming back into the editor.
- [ ] Unit tests cover `core/`, the session rules, undo history, set files, CC targets and solo; the React
      components are covered only by the end-to-end tests.

## 7. Later, by decision

These were left out of v1 on purpose:
- importing JV-1080 / JV-2080 bank dumps;
- Performance mode;
- rhythm sets;
- system settings;
- expansion boards.

## 8. Docs housekeeping ✅

Done 2026-11-16: the design's status and phases, jv2080-not-in-editor.md's note on the patch name, and PLAN.md.
