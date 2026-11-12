# TB-3 — Phase 4: controllers (design)

Status: **Launchpad implemented**; Launchkey and CC learn next.

## Launchpad Pro Mk1

The editor drives a Launchpad Pro (original model) on the LAUNCHPAD IN / OUT ports, as the TouchOSC panel did
(`touchosc-controllers/tb-3/README.md`). Later Launchpad models use different SysEx and aren't supported.

- **Setup**: on choosing the output, the editor sends Programmer layout and all LEDs off. Leaving the port, or
  closing the window, turns the LEDs off again.
- **Slots**: pads 81–88 are slots 1–8 and 71–78 are slots 9–16 (`packages/launchpad`'s `padToSlot`). A pad press
  is a click on the slot: recall a filled one, store the editor's patch in an empty one.
- **Colours**, matching the screen rather than the TouchOSC panel's blue: filled slots green at the idle level,
  the active slot green at full. While a mode is on, filled slots take its colour: DELETE red, GRAB white, morph
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
  (ports, setup, brightness). e2e: `e2e/fakeLaunchpad.ts` adds a fake Launchpad beside the fake TB-3.

## Launchkey and CC learn (next)

See PLAN.md: notes and pitch bend from the Launchkey pass through to the TB-3's channel; CC learn with seeded
Launchkey defaults and relative / pickup / jump modes, in a `packages/cc-learn` shared with the SP-404 editor.
