# Synth Editors — Plan

Desktop editors for the Roland TB-3 and SP-404 MK2, replacing the TouchOSC layouts in
[`touchosc-controllers`](../touchosc-controllers). Mouse-first editing on the Mac, Launchpad Pro
Mk1 for preset triggering, generic CC learn for other controllers (e.g. Launchkey 49 Mk4).

## Decisions

| Topic | Decision |
|-------|----------|
| Stack | TypeScript + React + Vite, Web MIDI |
| Shell | Electron (Chromium ⇒ Web MIDI + SysEx unchanged). Also runs in Chrome for dev. Not Tauri: WKWebView has no Web MIDI. |
| Apps | Two separate apps (`apps/tb3`, `apps/sp404`). Never run at the same time, so each app owns the Launchpad port. |
| Sharing | Small libraries only where there is real reuse (see Packages). No generic device engine. |
| Existing presets | Start fresh — no importer for `.tosc` tags or TB-3 bank v2. |
| Preset storage | Bank files (JSON) via native open/save dialogs, recent files, autosave. No OSC, no PyQt preset managers. |
| BCR2000 | Dropped. No NRPN, no deep controller mapping. |
| CC learn | Simple, global per app, saved to a file. No controller feedback (see below). |
| TB-3 hardware sync | Read state from the TB-3 (RQ1) as well as send (DT1). |
| SP-404 hardware sync | Send only. |
| Morph | TB-3: preset morph (current patch → target slot by amount). No scenes. SP-404: scenes + morph as today. |

## Repo layout

```
apps/
  tb3/            TB-3 editor (Electron main + React renderer)
  sp404/          SP-404 MK2 editor (later)
packages/
  midi/           Web MIDI access, port selection, remembered ports, reconnect, SysEx helpers
  launchpad/      Launchpad Pro Mk1 driver: Programmer layout, LED colours, pad/side-button events, pressure
  cc-learn/       learn + dispatch of CC assignments, takeover modes, persisted assignments
  bank-files/     versioned JSON bank format, open/save/recent/autosave
  ui/             fader, value label, slot grid, double-click-to-reset
```

## CC learn and controller behaviour

The Launchkey has no LED rings, and sending values back to controllers doesn't work well, so
the app never sends feedback. A knob's physical position can therefore disagree with the
parameter value (after a preset recall, a sync from the TB-3, or a mouse edit). Each
assignment gets a mode:

- **Relative**: the encoder sends increments (two's complement, binary offset or sign-magnitude,
  auto-detected or chosen). No jumps and no takeover problem. Recommended for Launchkey encoders.
- **Absolute, pickup**: incoming values are ignored until the knob crosses the current parameter
  value, then it follows (soft takeover). For faders and pots.
- **Absolute, jump**: the value follows the knob immediately.

Assignments are global: `(port, channel, cc) → app parameter id + mode`. The TB-3 app seeds the
current Launchkey defaults (CC 74 cutoff, 71 resonance, 16 accent, 17 effect knob, 12/13 XY,
104 global tuning, CC 1 → XY MOD). Notes and pitch bend from the keyboard pass through to the
TB-3's channel.

## TB-3 — phases

The current patch is **11 raw SysEx blocks**. Every parameter value is read from and written to
those blocks through a typed parameter table. This replaces the TouchOSC split between
`rawSysexBlocks`, EFX section tags and `"prog"` guards.

### Phase 0 — Spike (de-risk hardware)
- Electron + Vite + React shell, MIDI port picker (TB-3, Launchpad).
- Request all 11 blocks from the TB-3 (RQ1), show the decoded bytes.
- Send one parameter change (DT1).
- Launchpad Pro Mk1: Programmer layout SysEx, light a pad, log pad presses.

### Phase 1 — Core (no UI, fully tested)
- Port `tb-3/lua/param_defs.lua` and `tb-3/lua/shared/efx_defs.lua` to TypeScript data.
- Value encodings: 7-bit, 16-bit nibble-packed, signed, bipolar, semitone range, global tuning.
- Roland checksum, DT1/RQ1 builders, block parser.
- Recall sends only changed blocks; morph interpolation between two patches.
- Test against real `.syx` dumps, using `tb-3/tools/decode_patch.py` as the reference.

### Phase 2 — Editor UI
- Sections: LFO, VCO, cross mod / ring mod, distortion, VCA / VCF / tuning, portamento, bend range.
- EFX1 / EFX2: type chooser, parameter slots, buttons.
- Sync from TB-3, sync to TB-3.
- Parameter assign mode (XY pad MOD / X / Y, effect knob).

### Phase 3 — Patch library, slots and sets
- See [docs/tb3-phase3-design.md](docs/tb3-phase3-design.md): a browsable folder of .syx patches,
  16 slots per self-contained set file, click-empty-to-store, DELETE / GRAB modes, preset morph to a slot,
  unsaved edits kept across launches.
- To do: [docs/tb3-phase3-todo.md](docs/tb3-phase3-todo.md).

### Phase 4 — Controllers
- Launchpad: top two rows → 16 slots with mode colours; side buttons for morph, delete (hold),
  grab (hold), sync, brightness; pad pressure → morph amount.
- Launchkey: note / pitch-bend pass-through, CC learn with seeded defaults.

### Phase 5 — Packaging
- Signed Electron build, remembered ports with reconnect, settings window.

## SP-404 MK2 — after TB-3

Reuses `midi`, `launchpad`, `cc-learn`, `bank-files`, `ui`. Scope: 5 buses, 46 effects
(port of `controls_info.lua` and the display formatters), 8 presets per effect, defaults,
recent values, scenes / morph, Launchkey keyboard effects (Hyper Reso, Resonator, Vocoder),
Launchpad triggering.

## Dropped from the TouchOSC versions

BCR2000 integration (NRPN, `bcr_map.lua`, reserved CCs), OSC interface and chunked UDP bank
transfer, PyQt preset managers, controller value feedback (Launchkey LED ring sync).
