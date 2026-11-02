# TB-3 Phase 2 — Editor UI design

Agreed with the user over three rounds of mockups (kept in [`docs/tb3-phase2-mockups/`](tb3-phase2-mockups/)):

1. Three layouts → **A · Signal flow**.
2. Style: hardware-inspired, and it shouldn't look like a generic dark dashboard. Faders should be
   **short and fat** so they're easy to hit and don't need long drags.
3. Section by section → the variants below.

## Target and style

- One window, everything always visible: no tabs, nothing hidden. The layout has a fixed design
  size (1608 × ~1000 CSS px) and Electron's page zoom scales it to fit the window
  (`editor/useFitZoom.ts`, zoom exposed by `electron/preload.cjs`). Page zoom scales pointer
  coordinates too, so drag distances and fine adjust behave the same at any size. Extra width or
  height becomes margin. In a plain browser (`dev:browser`) there is no zoom and the page scrolls.
- Panel look:
  - Near-black body, with sections marked by a thin "silkscreen" rule and an uppercase label
    rather than rounded cards.
  - Condensed face (`DIN Condensed`, falling back to `Avenir Next Condensed`).
  - Square rubber-style buttons with a small rectangular LED.
- Colour: the TB-3's green `#3ddc5a` for values and fills, a mid green `#2f6a3a` for "off but
  remembered" (light enough that the level still shows), and amber `#ffb020` for negative
  cross-mod amounts. Values read in a light green. No gradients, glows or drop shadows. (The first
  round of mockups used LED orange; switched to green after the first hardware test to match the
  device.)
- The LFO section uses red for all its accents (trace, faders, LEDs, values), matching the
  TB-3's red LFO LED.
- Each synthesis section has its own soft tint on its title and rule (VCO sand, cross mod
  lilac, VCF sky, VCA mint, LFO red, distortion peach, EFX periwinkle) so sections are easy to
  tell apart. The top strip stays neutral. Section titles are centred (header buttons stay on the
  right) and ruled above and below;
  sub-headings (TUNING) get thinner rules above and below in the same tint, and are
  centred too.
- Bipolar faders draw their zero line at the param's real centre (`center / max`), not the
  middle: tuning's zero sits at 127/151.
- Fader sizes:
  - Horizontal: 22 px tall × 140 px long (120 px in EFX slots).
  - Vertical: 26 px wide × 100 px tall.
  - The value is printed inside the bar's right end, or under a vertical fader.

## Layout (A · Signal flow)

```
┌ TB-3 ──────┬ PATCHES (Phase 3) ──────┬ MORPH (Phase 3) ┬ PERFORM ─[PORTA·BEND▾]┬ ASSIGN ────────┐
│ Sync from  │ 1  2  3  4  5  6  7  8  │ target  amount  │ ACCENT  ████          │ PAD X   PAD Y  │
│ Sync to    │ 9 10 11 12 13 14 15 16  │                 │ GLOBAL TUNE ─┼─       │ EFFECT  XY MOD │
├ VCO ───────┼ VCO MIX ───────────────┬┴ CROSS MOD ──────┴───────────────────────┴────────────────┤
│ ▮▮▮▮▮▮ LED │ summed waveform        │ →SAW cells │ patch view │ →SQR cells │ RING MOD ×6        │
│ TUNING ×3  │                        │            │            │                                 │
├ VCF ───────┴────────────┬ VCA ──────┴────────────┬ LFO ───────────────────────────────────────────┤
│ ADSR graph  cutoff res  │ ADSR graph   volume     │ sum waveform │ SAW SQR TRI SIN S&H           │
│ A D S R faders envdep kf│ A D S R faders          │ rate delay cv-offset  → VCO → VCF → VCA       │
├ DISTORTION ┬ EFX1 ───────┴───────────────────────┬┴ EFX2 ────────────────────────────────────────┤
│ ‹ CRUNCH ›  │ type buttons · mode · slots / EQ   │ type buttons · mode · slots                    │
└────────────┴────────────────────────────────────┴───────────────────────────────────────────────┘
```

Column widths (CSS px, 1580 inside the margins):

| Row | Columns |
|-----|---------|
| Oscillator row | VCO 300, VCO MIX 370, Cross mod 520, Ring mod rest (~350) |
| Shape row | VCF 530, VCA 530, LFO rest |
| FX row | Distortion 240, EFX1 and EFX2 split the rest |
| Top strip | ~140 px tall |

PORTA · BEND opens as a popover from a button in the PERFORM header, so the three section rows
each hold three sections.

The LFO depths (→ VCO, → VCF, → VCA) live only in the LFO section, so the LFO is self-contained
and nothing is duplicated.

The top strip's PATCHES and MORPH blocks are **layout placeholders** in Phase 2: they're drawn
and sized but disabled, with a hover note saying they arrive in Phase 3.

PERFORM holds the two "play" controls that aren't elsewhere:

- **Accent** (patch param `accent`).
- **Global tuning.** CC 104 on the TB-3 channel; not part of the patch. It's local state that is
  only sent, and it isn't included in sync or morph.

Cutoff and resonance stay in the VCF section only; they're its biggest faders.

## Section designs

| Section | Control | Params |
|---------|---------|--------|
| VCO mixer | **1a**: six vertical faders. The LED cap above each is its on/off switch. When off, the fill turns mid green but keeps its level. | `vco_*_level`, `vco_*_sw` |
| Tuning | **2a**: three bipolar horizontal bars filling from the centre line (centre 127, max 151, display `def.display`). | `saw_tuning`, `sqr_tuning`, `ring_sin_tuning` |
| VCO mix | Display-only waveform: the summed oscillator mix over two cycles (sources that are switched off are left out; tuning offsets shift each wave's pitch, 24 steps drawn as an octave; cross/ring mod depths are not modelled). The window is two cycles of the lowest-pitched wave that's playing, so a single detuned wave never goes flat, and other waves are drawn at most three octaves above it. Maths in `core/vcoShape.ts`. | `vco_*`, `*_tuning` |
| Cross mod | **3b**, mirrored: the → SAW cells on the left, the → SQR cells on the right, and the patch view between them. The patch view labels the sources at its left and right edges, beside their cells, with SAW and SQR in the middle; each **non-zero** cell draws a cord inwards from its source to its destination, so cords from the two columns never cross. Thickness shows the amount and colour the sign (green positive, amber negative). Zero cells draw nothing. The patch view is read-only. | `cm_*` (8) |
| Ring mod | Its own section next to CROSS MOD: six horizontal rows in two columns. | `rm_*` |
| VCF | **4a** envelope editor (see below), with horizontal bars to its right for CUTOFF, RESONANCE, ENV DEPTH and KEY FOLLOW. Cutoff and resonance are u16 (0–255). | `vcf_*` |
| VCA | **4a** envelope editor, with VOLUME to its right. | `vca_*`, `master_volume` |
| Distortion | **6b**: type stepper, then ON and COLOR LED buttons, then DRIVE (0–120), BOTTOM and TONE (bipolar, centre 50), EFX LVL and DRY LVL. | `dist_*` |
| LFO | **5a** (see below), then RATE, DELAY and CV OFFSET bars, BPM SYNC and RETRIG LED buttons, and bipolar → VCO/→ VCF/→ VCA. | `lfo_*`, `*_lfo_depth` |
| EFX1 / EFX2 | **7a** (see below). | EFX blocks |
| Porta · Bend | Popover from PERFORM: PORTA LED button, a LEGATO/ALWAYS segmented control, TIME bar, and BEND RANGE bar (display `±n st`). | `porta_*`, `bender_range` |
| Assign | **8a** learn-by-click (see below). | `assign_*` |

### Envelope editor (4a)

- An SVG graph about 290 × 130 px, with a filled shape and square handles.
- Each stage gets a quarter of the width at its maximum value, and the sustain plateau is drawn
  at a fixed width.
- **Attack** handle: drags horizontally only, and sets A.
- **Decay/sustain** handle: horizontal drag sets D and vertical drag sets S, both in one gesture.
- **Release** handle: drags horizontally and sets R.
- A row of four small A / D / S / R faders sits under the graph and edits the same values, with
  the usual fader rules (drag, scroll, double-click resets to 0).

### LFO view (5a)

- A 270 × 130 px waveform, plus five vertical faders (SAW, SQR,
  TRI, SIN, S&H) beside it.
- The trace is the **sum** of the five waves weighted by level and normalised to fit the box.
- S&H draws as a fixed pseudo-random step sequence.
- DELAY draws as a fade-in ramp at the start.
- CV OFFSET shifts the trace vertically, scaled by the same normalisation.
- RATE changes how many cycles are visible (1 cycle at 0 up to 6 at 127). The axis is
  qualitative: the Hz/BPM mapping is unknown, so no time labels are shown.
- The shape maths lives in a pure, tested function: `core/lfoShape.ts`.

### EFX panel (7a)

The panel stacks, top to bottom:

1. A header: `EFX1 · <TYPE>` with an ON LED button (`swOffset`; hidden for BYPASS).
2. A wrapping row of type buttons: 11 for EFX1, 10 for EFX2.
3. Mode buttons (`efxTypes()[t].buttons`). Non-null `set` buttons sharing an offset form one
   segmented control, with the selected button = the current byte value. Null holes are ignored
   for buttons.
4. Slots as a two-column grid in `slots` order. A `null` hole is an empty cell, so the layouts
   match `efx.ts`.
   - Each slot is a 170 px horizontal fader using the slot's `display`. Slots whose default is
     the middle (gains in dB) are bipolar, with the zero line at the middle.
   - Double-click resets the slot to `round(default × max)`.
   - A slot dims (still editable) while any of its `disabledBy` offsets holds a non-zero value.
5. EQ (EFX1 only) puts a frequency-response curve (240 px wide, 20 Hz–20 kHz log axis, ±24 dB)
   beside the standard slot grid, whose faders are shorter (118 px) and a little more tightly
   spaced so the effects row keeps its height. The curve is display-only and approximate
   (`core/eqResponse.ts`): the mid bands use their real frequency, Q and gain, but the shelf
   turnover frequencies (assumed 100 Hz and 8 kHz) and the cut slopes (assumed 12 dB/octave) are
   unknown.

In segmented controls, neighbouring buttons share one border and the selected button draws on
top, so its outline is whole; hovering a selected button keeps its outline.

### Parameter assign (8a)

- Four target buttons in the ASSIGN block, each showing its current assignment, e.g.
  `XY MOD · VCF CUTOFF`. PAD X and PAD Y are on the first row, EFFECT and XY MOD on the second.
- Clicking a target arms it, so the button lights and the editor shows a hint line.
- While armed, every parameter label that has an `assignId` gets a dashed outline. Clicking one
  writes that `assignId` into the slot param (`assign_xy_mod`, etc.) and disarms the target.
- Esc or clicking the target again cancels.
- EFX parameters have no known assign IDs yet, so they aren't clickable. An existing EFX
  assignment shows as `#<id>`.

## Components

Shared controls go in `apps/tb3/src/ui/`. They're kept generic so they can move to
`packages/ui` once the SP-404 needs them.

| Component | Props (summary) |
|-----------|-----------------|
| `HFader` | `value, max, onChange(raw), format(raw), bipolar?, center?, defaultValue, width?, off?, disabled?` |
| `VFader` | Same as `HFader`, plus `height?`, `color?: "led" \| "alt"` and `led?: { on, onToggle }`, which renders the LED cap |
| `LedButton` | `label, on, onToggle` |
| `Segmented` | `options: {label, value}[], value, onChange` |
| `Stepper` | `items: string[], groups?: {name, items}[], index, onChange`. The ‹ › buttons and scroll step through the items; clicking the name opens a grouped popover. |
| `EnvelopeEditor` | `a, d, s, r, onChange(stage, raw)` |
| `WaveView` | `ys` (samples in −1..1, display only), used by the LFO and VCO mix |
| `EqView` | `ys` (dB across a log frequency axis, display only) |
| `XmodMatrix` | `sources, dests[2], amounts, renderCell(row, col)`, mirrored, with the patch view between the columns |
| `Popover` | anchor + panel that closes on an outside press |
| `Section` | Titled, silkscreen-ruled container |

Patch-bound wrappers live in `apps/tb3/src/editor/`:

- **`EditorContext`:** provides `patch`, `setParam(id, raw)`, `setEfxType`, `setEfxByte` and
  the assign-mode state.
- **`ParamH`, `ParamV`, `ParamLed`:** look up the `ParamDef` by id, read the value, format it
  with `def.display`, write through `setParam`, and handle the assign-mode click.
- **Section components:** `TopStrip` (`Tb3Block`, `PatchGridPlaceholder`,
  `MorphPlaceholder`, `PerformBlock`, `AssignBlock`), `VcoSection`, `ModSection`, `VcfSection`,
  `VcaSection`, `DistSection`, `LfoSection`, `EfxSection(efx)`, `VcoSumSection`, `RingModSection`, and
  `PortaBendPanel` (in the PERFORM popover).
- **`MidiSettings`:** a popover opened from the TB-3 block. It holds the existing four port
  pickers (TB-3 in/out, Launchpad in/out, remembered by name) plus the TB-3 MIDI channel
  (default 2). A collapsible MIDI log from the spike stays here for debugging.

## Interaction rules

These apply to every fader, matrix cell and envelope handle.

- **Drag**:
  - Dragging is relative to where you press. Clicking never jumps the value.
  - Horizontal faders follow horizontal movement; vertical faders follow vertical movement.
  - One fader length of travel is the full range.
  - Hold **Shift** for fine control: 0.15× speed, so u16 params can reach single steps.
- **Double-click** resets to the default:
  - The centre for bipolar/signed params.
  - `default × max` for EFX slots.
  - 0 for everything else.
- **Scroll** steps the value by ±1 raw per wheel notch. Trackpad deltas accumulate, about 1 step
  per 8 px. The page itself doesn't scroll, since the layout fits the window.
- **LEDs, buttons, segmented controls and type buttons** act on click.
- **Steppers** step with ‹ ›, with scroll, or with arrow keys when focused.
- **Keyboard**: Esc cancels assign mode. Nothing else in Phase 2.
- **Before the first sync**:
  - The editor shows the layout with all controls disabled.
  - The sync button pulses, with the prompt "Sync from TB-3 to start".
  - The app doesn't invent a default patch (there's no `defaultPatch()` yet).

## Data flow

```
UI control ──onChange(raw)──▶ setParam(id, raw)
                               ├─ patch = setRaw(patch, def, raw)            (React state, immutable)
                               └─ queue[def.id] = encodeParam(def, raw)      (last value wins)
requestAnimationFrame ─▶ flush queue ─▶ tb3Out.send(dt1) for each entry     (≤ 1 DT1 per param per frame)

EFX byte:   setEfxRaw(patch, efx, offset, raw)  ─▶ encodeEfxByte(efx, offset, raw)  (new helper in patch.ts)
EFX type:   setEfxType(patch, efx, t)           ─▶ encodeEfxByte(efx, 0, t)
Global tuning (CC 104): local state ─▶ globalTuningCc(channel−1, v)  — not in Patch

Sync from TB-3:  send rq1(addr, size) × 11 ─▶ collect DT1s on tb3In by address
                 ─▶ when all 11 present: patch = patchFromSysex(msgs)  ─▶ UI re-renders
                 timeout 2 s ─▶ status "No reply from TB-3 (got n/11 blocks)"
Sync to TB-3:    patchToSysex(patch) ─▶ send all 11 DT1s
```

- The edit queue is keyed by param id (or `efx:<n>:<offset>`), so a fast drag sends at most
  about 60 messages per second per param, and the final value is always sent.
- Incoming DT1s outside a sync request are ignored in Phase 2.
- Hardware note: Sync from TB-3 works over DIN in both directions. A failed first test (RQ1s
  went out, no reply came back) was a TRS type A/B mismatch on the interface's input. Moving
  the TB-3's MIDI out to a full DIN input fixed it.
- Phase 3 recall/morph will reuse the same path: `diffBlocks` + `blocksToSysex`.

## Out of scope for Phase 2

- Patch grid logic, bank files, morph logic: Phase 3. The blocks are only placeholders.
- Launchpad mapping, CC learn: Phase 4.
- Typing values in by hand.
- Undo.
- Real time/frequency axes on the LFO and envelopes, since the hardware mapping is unknown.

## Tests

- `core/lfoShape.test.ts`:
  - The sum of levels is correct.
  - Delay ramps from 0.
  - The S&H sequence is deterministic.
  - All levels at 0 gives a flat line.
- `patch.test.ts`: `encodeEfxByte` builds the right DT1 address and checksum.
- Edit-queue coalescing as a pure function: several sets of the same id flush to one message.
- UI components get no DOM tests in Phase 2. Instead they're verified by running the app against
  the TB-3: edits are audible, and Sync from TB-3 updates every section.
