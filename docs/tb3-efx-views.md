# TB-3 EFX drawings

Each EFX type except BYPASS has a drawing beside its slots, borrowed from the SP-404 MK2 editor's effect views
(`apps/sp404/src/fx/views/`) so the two editors look and behave alike. Slots set in a drawing show as readouts
(name and value) instead of faders, as the SP-404's in-view parameters do. Every handle sends through the editor's
`setEfxByte`, so a drag reaches the TB-3 (paced, undoable, morph- and CC-aware) exactly as a fader move does.

## Code

- `src/core/efxShapes.ts`: the pure maths: soft-knee compressor curve (real threshold, ratio and gain), tremolo
  waves by TYPE with SHAPE, BPM SYNC divisions as bars, delay repeats by mode, the reverb tail's decay. Settings go in
  as objects (CodeScene's primitive-argument rule). Tests beside it.
- `src/ui/draw.tsx`: drawing parts after the SP-404's `views/draw.tsx` and `parts.tsx` (log frequency axis,
  illustrative filter maths, response panel, filter band with draggable edges, handle, drag area, pads), drawn in the
  TB-3's graph style (the EQ's well, grid and handle rings).
- `src/ui/useHandleDrag.ts`: relative handle drags after the SP-404's `views/useHandleDrag.ts`, but each axis has
  its own range (EFX slots run 0–5 … 0–127), crossed in a set number of layout px; Shift is fine, as everywhere.
- `src/editor/efx/`: `viewContext.ts` (raw values, display text, drag axes and resets by byte offset), `parts.tsx`
  (filter band, tone panel, drawing over a band), `dynamics.tsx`, `modulation.tsx`, `timePitch.tsx`, `eq.tsx`, and
  `index.ts`, which maps each type name to its drawing and the slots set in it (a function, as DELAY's TAP TIME and
  PITCH SHIFT's voice 2 depend on the mode).
- `src/editor/EfxSection.tsx`: type buttons, mode buttons, then the drawing beside the slots.

## The drawings

| Type | Borrowed from (SP-404) | Set in the drawing |
| --- | --- | --- |
| COMP | CompressorView | THRESHOLD × GAIN, RATIO, ATTACK, RELEASE |
| RING MOD | RingModView | FREQ × SENS, EQ LOW, EQ HIGH |
| BIT CRUSH | CrusherView | SAMP RATE, FILTER, EQ LOW, EQ HIGH |
| TREMOLO | TremoloPanView | TYPE (pads), RATE × DEPTH, PHASE |
| CHORUS | ChorusView | RATE × DEPTH, HPF, LPF |
| FLANGER | FlangerView | MANUAL × RESONANCE, HPF |
| PHASER | PhaserView | MANUAL × RESONANCE |
| DELAY | Sync Delay / Ko-Da-Ma taps | TIME (BPM SYNC when on, never down to OFF), FEEDBACK, LPF, TAP TIME in PAN |
| PITCH SHIFT | ChromaticPsView | PITCH × PRE DLY for each voice |
| EQ | (TB-3's own EqView) | every band setting but LEVEL |
| REVERB | ReverbView | TIME, PRE DLY, HPF, LPF |

Drawings are 240 px wide, 167 px tall (136 under a row of mode buttons).

## Guesses to check on the hardware

- BIT CRUSH: SAMP RATE drawn as coarser steps as it rises, FILTER as a low-pass opening as it rises (200 Hz–18 kHz).
- RING MOD: UP / DOWN drawn as the direction SENS bends the carrier with the input's level.
- COMP: soft knee 2 dB wide per KNEE step; the attack and release curves are only proportional to their values.
- DELAY: TIME at its maximum drawn as half a bar; TAP TIME as where PAN's left repeat falls within the time.
- TREMOLO: SHAPE drawn as squaring the wave up; PHASE as the right channel lagging the left.

## Follow-ups

- `ui/draw.tsx` and `ui/useHandleDrag.ts` are close copies of the SP-404's; once both editors settle, move them
  into a shared package (`packages/fx-draw`, say) with the style classes as a stylesheet.
- EFX parameters still aren't CC-learnable (they aren't `ParamDef`s).
