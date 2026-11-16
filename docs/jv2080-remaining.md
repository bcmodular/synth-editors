# JV-2080 editor — remaining work

An inventory made 2026-11-16 from [jv2080-design.md](jv2080-design.md), [jv2080-not-in-editor.md](jv2080-not-in-editor.md),
PLAN.md and the code in `apps/jv2080`. Where these disagree, this list says which is current.

## Where it stands

Phase 3 (the editor) is nearly done:
- the mixer, EFX with a view for every type, chorus, reverb, patch settings, four tone columns with envelope
  graphs, the wave library;
- (i) help for every section;
- fit zoom, demo mode;
- every patch parameter except the controller matrix and the EFX control.

Nothing for Phases 4 (library) or 5 (controllers, packaging) has been started.

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

## 2. Finish Phase 3 (editor)

- [ ] **Undo / redo.** Still to do in the design. The TB-3's session and undo hooks are the model. The top strip
      has no UNDO / REDO yet.
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

1. **Patch files:** a library like the TB-3's, or Save / Open dialogs? One patch per file, or whole USER banks
   too?
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
   `packages/bank-files` first?
9. **Morph** (the TB-3's, byte-wise): v1 or later?

## 4. Phase 4 — library

Not started; shaped by decisions 1, 2 and 8.

- [ ] A sidebar like the TB-3's:
      - PATCH: name, slot, SAVE AS…;
      - SET: 16 slots, GRAB / DELETE, NEW / SAVE / SAVE AS…;
      - LIBRARY: a tree of `.syx` and `.jvset` files, search, ▶ audition.
- [ ] `core/patchSet.ts` (`.jvset`) and the Electron file IPC. `encodeSyx` / `decodeSyx` already exist in
      `core/patch.ts`.
- [ ] Room for the sidebar: the layout is fixed at 1920 px and fit-zoomed, so the sidebar means narrowing the
      tones or zooming down.

## 5. Phase 5 — controllers and packaging

- [ ] CC learn (`packages/cc-learn`), and a CC button in the top strip.
- [ ] Launchpad slots, if wanted.
- [ ] A packaged build. The TB-3 has an `electron-builder` config; the JV app has only `vite build`.

## 6. Tests

- [ ] **End-to-end tests:** the TB-3 and SP-404 have Playwright harnesses, the JV has none. A fake JV, like
      `apps/tb3/e2e/fakeTb3.ts`, that answers RQ1s and records DT1s would cover:
      - read and sync;
      - the bank browser;
      - edits;
      - the EFX start values;
      - a failed read.

      Demo mode already covers the UI on its own. Add a root `test:e2e:jv2080` script.
- [ ] Unit tests cover `core/`, `link/readPatch` and solo; the editor components have none.

## 7. Later, by decision

These were left out of v1 on purpose:
- importing JV-1080 / JV-2080 bank dumps;
- Performance mode;
- rhythm sets;
- system settings;
- expansion boards.

## 8. Docs housekeeping

Some of the docs are out of date:
- [ ] `jv2080-design.md` still opens with "Status: draft, nothing built". Its Phase 1 entry still describes the
      spike, which is now removed.
- [ ] `jv2080-not-in-editor.md` says editing the patch name is still to do; it was done in 5ceb25d.
- [ ] PLAN.md's JV-2080 section still says "Nothing built yet".
