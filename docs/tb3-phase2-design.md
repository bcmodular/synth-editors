# TB-3 Phase 2 — Editor UI design

Agreed with the user over three rounds of mockups (kept in [`docs/tb3-phase2-mockups/`](tb3-phase2-mockups/)):

1. Three layouts → **A · Signal flow**.
2. Style: hardware-inspired, and it shouldn't look like a generic dark dashboard. Faders should be
   **short and fat** so they're easy to hit and don't need long drags.
3. Section by section → the variants below.

## Target and style

- One large window (external monitor). The design canvas is 1600×940 CSS px and the layout
  stretches to fill larger windows. There are no tabs and nothing hidden.
- Panel look:
  - Near-black body, with sections marked by a thin "silkscreen" rule and an uppercase label
    rather than rounded cards.
  - Condensed face (`DIN Condensed`, falling back to `Avenir Next Condensed`).
  - Square rubber-style buttons with a small rectangular LED.
- Colour: LED orange `#ff4a1c` for values and fills, a dark orange `#5a2416` for "off but
  remembered", and cyan `#2ccbe0` for the LFO (and negative cross-mod amounts). Values read in a
  light orange. No gradients, glows or drop shadows.
- Fader sizes:
  - Horizontal: 22 px tall × 140 px long (120 px in EFX slots).
  - Vertical: 26 px wide × 100 px tall.
  - The value is printed inside the bar's right end, or under a vertical fader.

## Layout (A · Signal flow)

```
┌ TB-3 ──────┬ PATCHES (Phase 3) ──────┬ MORPH (Phase 3) ┬ PERFORM ─────────┬ ASSIGN ────────────┐
│ Sync from  │ 1  2  3  4  5  6  7  8  │ target  amount  │ ACCENT  ████     │ XY MOD  PAD X      │
│ Sync to    │ 9 10 11 12 13 14 15 16  │                 │ GLOBAL TUNE ─┼─  │ PAD Y   EFFECT     │
│ ports ⚙    │ grab  del               │                 │                  │ (learn-by-click)   │
├ VCO ───────┼ CROSS MOD ──────────────┼ VCF ────────────┴──┬ VCA ──────────┴──┬ DISTORTION ────────┤
│ ▮▮▮▮▮▮ LED │ matrix 4×2  + patch view│ ADSR graph (drag)  │ ADSR graph (drag) │ ‹ CRUNCH ›  on col │
│ caps       │ RING MOD rows ×6        │ cutoff res envdep  │ volume            │ drive bottom tone  │
│ TUNING ×3  │                         │ keyfollow          │                   │ efx lvl  dry lvl   │
├ LFO ───────┴─────────────────────────┼ EFX1 ──────────────┴┬ EFX2 ────────────┴┬ PORTA · BEND ──────┤
│ sum waveform │ SAW SQR TRI SIN S&H   │ type buttons (11)   │ type buttons (10) │ porta on, legato/  │
│ rate delay cv-offset  bpm-sync retrig│ mode segmented      │ mode segmented    │ always, time       │
│ → VCO  → VCF  → VCA  (bipolar)       │ slots 2-col grid    │ slots 2-col grid  │ bend range         │
└──────────────────────────────────────┴─────────────────────┴───────────────────┴────────────────────┘
```

Rough column widths at 1600 px:

| Row | Columns |
|-----|---------|
| Voice row | VCO 260, Mod 300, VCF 330, VCA 260, Dist rest |
| Mod/FX row | LFO 560, EFX1 and EFX2 split the rest, Porta/Bend 200 |
| Top strip | ~110 px tall |

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
| VCO mixer | **1a**: six vertical faders. The LED cap above each is its on/off switch. When off, the fill turns dark orange but keeps its level. | `vco_*_level`, `vco_*_sw` |
| Tuning | **2a**: three bipolar horizontal bars filling from the centre line (centre 127, max 151, display `def.display`). | `saw_tuning`, `sqr_tuning`, `ring_sin_tuning` |
| Cross mod | **3b**: a matrix with rows SQR/SAW/WHITE/PINK and columns → SAW/→ SQR. Each cell is a bipolar bar: orange for positive, cyan for negative. Beside it, a patch view draws one curve per **non-zero** cell; thickness shows the amount and colour the sign. Zero cells draw nothing. The patch view is read-only. | `cm_*` (8) |
| Ring mod | Six horizontal rows (SAW, SQR, RING, WHITE, PINK, DEPTH). | `rm_*` |
| VCF | **4a** envelope editor (see below), then horizontal bars for CUTOFF, RESONANCE, ENV DEPTH and KEY FOLLOW. Cutoff and resonance are u16 (0–255). | `vcf_*` |
| VCA | **4a** envelope editor, then VOLUME. | `vca_*`, `master_volume` |
| Distortion | **6b**: type stepper, then ON and COLOR LED buttons, then DRIVE (0–120), BOTTOM and TONE (bipolar, centre 50), EFX LVL and DRY LVL. | `dist_*` |
| LFO | **5a** (see below), then RATE, DELAY and CV OFFSET bars, BPM SYNC and RETRIG LED buttons, and bipolar → VCO/→ VCF/→ VCA. | `lfo_*`, `*_lfo_depth` |
| EFX1 / EFX2 | **7a** (see below). | EFX blocks |
| Porta · Bend | PORTA LED button, a LEGATO/ALWAYS segmented control, TIME bar, and BEND RANGE bar (display `±n st`). | `porta_*`, `bender_range` |
| Assign | **8a** learn-by-click (see below). | `assign_*` |

### Envelope editor (4a)

- An SVG graph about 310 × 110 px, with a filled shape and square handles.
- Each stage gets a quarter of the width at its maximum value, and the sustain plateau is drawn
  at a fixed width.
- **Attack** handle: drags horizontally only, and sets A.
- **Decay/sustain** handle: horizontal drag sets D and vertical drag sets S, both in one gesture.
- **Release** handle: drags horizontally and sets R.
- An `A n  D n  S n  R n` value row sits under the graph. Scrolling over a value steps it by 1,
  and double-clicking a value resets that stage to 0.

### LFO view (5a)

- A 300 × 130 px waveform showing about two cycles, plus five cyan vertical faders (SAW, SQR,
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
   - Each slot is a 120 px horizontal fader using the slot's `display`.
   - Double-click resets the slot to `round(default × max)`.
   - A slot dims (still editable) while any of its `disabledBy` offsets holds a non-zero value.

### Parameter assign (8a)

- Four target buttons in the ASSIGN block, each showing its current assignment, e.g.
  `XY MOD · VCF CUTOFF`.
- Clicking a target arms it, so the button lights and the editor shows a hint line.
- While armed, every parameter label that has an `assignId` gets a dashed outline. Clicking one
  writes that `assignId` into the slot param (`assign_xy_mod`, etc.) and disarms the target.
- Esc or clicking the target again cancels.
- Parameters that are currently assigned carry a small tag after their label: **M**, **X**,
  **Y** or **E**.
- EFX parameters have no known assign IDs yet, so they aren't clickable. An existing EFX
  assignment shows as `#<id>`.

## Components

Shared controls go in `apps/tb3/src/ui/`. They're kept generic so they can move to
`packages/ui` once the SP-404 needs them.

| Component | Props (summary) |
|-----------|-----------------|
| `HFader` | `value, max, onChange(raw), format(raw), bipolar?, center?, defaultValue, width?, off?, disabled?` |
| `VFader` | Same as `HFader`, plus `height?`, `color?: "led" \| "cyan"` and `led?: { on, onToggle }`, which renders the LED cap |
| `LedButton` | `label, on, onToggle` |
| `Segmented` | `options: {label, value}[], value, onChange` |
| `Stepper` | `items: string[], groups?: {name, items}[], index, onChange`. The ‹ › buttons and scroll step through the items; clicking the name opens a grouped popover. |
| `EnvelopeEditor` | `a, d, s, r, onChange(stage, raw)` |
| `LfoView` | `levels, rate, delay, cvOffset` (display only) |
| `XmodMatrix` | `values[4][2], onChange(row, col, raw)`, with the patch view built in |
| `Section` | Titled, silkscreen-ruled container |

Patch-bound wrappers live in `apps/tb3/src/editor/`:

- **`EditorContext`:** provides `patch`, `setParam(id, raw)`, `setEfxType`, `setEfxByte` and
  the assign-mode state.
- **`ParamH`, `ParamV`, `ParamLed`:** look up the `ParamDef` by id, read the value, format it
  with `def.display`, write through `setParam`, and handle the assign-mode label click and tag.
- **Section components:** `TopStrip` (`Tb3Block`, `PatchGridPlaceholder`,
  `MorphPlaceholder`, `PerformBlock`, `AssignBlock`), `VcoSection`, `ModSection`, `VcfSection`,
  `VcaSection`, `DistSection`, `LfoSection`, `EfxSection(efx)`, `PortaBendSection`.
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
