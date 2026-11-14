# TB-3 — Phase 4: controllers (design)

Status: **implemented**.

## Launchpad Pro Mk1

The editor drives a Launchpad Pro (original model) on the LAUNCHPAD IN / OUT ports, as the TouchOSC panel did
(`touchosc-controllers/tb-3/README.md`). Later Launchpad models use different SysEx and aren't supported.

- **Setup**: on choosing the output, the editor sends Programmer layout and all LEDs off. Leaving the port, or
  closing the window, turns the LEDs off again.
- **Slots**: the 8 × 8 grid is the 64 slots, read like a page: 81–88 are slots 1–8, 71–78 are 9–16, down to 11–18
  for 57–64 (`packages/launchpad`'s `padToSlot`). A pad press is a click on the slot: recall a filled one, store
  the editor's patch in an empty one.
- **Colours**, matching the screen: filled slots in their row's colour at the idle level (`editor/slotColours.ts`:
  cyan, blue, violet, pink, repeating; the Launchpad RGB values are set apart from the screen's, to be tuned by eye
  on its LEDs), the active slot green at full. While a mode is on, filled slots take its colour: DELETE red, GRAB white, morph
  target picking orange. The morph target is orange at full. A held pad goes to the press level; an empty held
  pad is dim grey.
- **Side buttons** (Programmer layout CCs, named as printed):

  | Button | CC | Action |
  |--------|----|--------|
  | Quantise | 40 | MORPH: toggles target picking. Unlike on screen, picking a target keeps the mode on. |
  | Delete | 50 | DELETE while held. |
  | Click | 70 | SYNC FROM TB-3; lit green while waiting for the reply. |
  | Shift | 80 | GRAB while held; holding a pad auditions its slot, releasing ends it. |
  | User | 98 | Cycles the brightness profile. |

  Each button is lit at the idle level in its colour, and at full while its mode is on.
- **Pressure → morph amount**: while picking targets, pressure on the target's pad sets AMOUNT (0–127). Polyphonic
  aftertouch is matched by pad; channel aftertouch goes to the last pad pressed, if still held. Pressing the
  current target again doesn't choose it again, which would make the blend the new base.
- **Brightness profiles** (from the SP-404 TouchOSC panel, shared in `packages/launchpad`): very dim, night
  (default), normal and day set the idle level (0.08 / 0.18 / 0.30 / 0.45); lit is full and held is 0.88.
  Remembered.
- **Sending**: the LEDs are worked out from the session each render (`launchpadView.ts`, pure) and only changed
  LEDs are sent, in one multi-LED SysEx (`ledsRgb`). The Launchpad isn't behind the TB-3's pacer.
- **Code**: `launchpadView.ts` (state → LEDs), `launchpadControl.ts` (input → session actions), `useLaunchpad.ts`
  (ports, setup, brightness). e2e: `e2e/fakeController.ts` adds a fake Launchpad beside the fake TB-3.

## Keyboard controller and CC learn

A keyboard (the Launchkey MK4 on the TouchOSC panel) on **KEYS IN**, as in `touchosc-controllers/tb-3/lua/root.lua`.

- **Pass-through**: note on/off and pitch bend go to the TB-3, rechannelled to TB-3 CHANNEL, through the pacer like
  every send. Unassigned CCs pass through the same way. Other messages (clock, aftertouch, SysEx) are dropped.
- **Targets** (`ccTargets.ts`): a patch parameter (`param:<id>`, edited as from its fader, so on screen, sent as DT1
  and in the undo history), GLOBAL TUNE (`tuning`), the morph AMOUNT (`morph`, only with a target), or one of the
  TB-3's performance CCs (`tb3cc:<n>`: EFFECT knob 17, PAD X 12, PAD Y 13, XY MOD 1), sent on as that CC.
- **Seeded defaults** from the TouchOSC panel: 74 cutoff, 71 resonance, 16 accent, 17 / 12 / 13 / 1 the TB-3 CCs, 104
  tuning, 105 morph. Seeds match any channel; learned CCs keep the channel they came on.
- **Modes** (`packages/cc-learn`): relative (binary offset around 64, Novation's relative encoders; one step is
  max/127 raw, at least 1), pickup (soft takeover: ignored until the knob is within a step of the value or crosses
  it; it lets go when anything else changes the value) and jump. Parameters, tuning and morph default to pickup;
  the TB-3 CCs have no known value, so they're jump only.
- **Learning**: the CC popover's LEARN arms picking, reusing ASSIGN's click capture (every parameter is clickable);
  the next CC from KEYS IN is assigned to the picked target, replacing that CC's and that target's old assignment.
  A row's LEARN skips the picking. Esc cancels. EFX parameters aren't learnable yet (they aren't `ParamDef`s).
- **Storage**: `cc.assignments` in the app's local storage (global, not per set). Feedback to the controller: none,
  as decided in PLAN.md.
- **Code**: `packages/cc-learn` (assignments, `ccValue`), `ccTargets.ts`, `launchkeyControl.ts` (input → sends and
  targets, pure), `useCcLearn.ts` (state), `useLaunchkey.ts` (port, target read/write), `CcSettings.tsx`. e2e:
  `e2e/keys.e2e.ts` with `e2e/fakeController.ts`.
