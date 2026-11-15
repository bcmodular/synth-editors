# TB-3 help panels

Each section of the TB-3 editor has an (i) in its header that opens help over the editor, after the JV-2080's
(`apps/jv2080/src/editor/help/`): a working copy of the section on the left, and on the right a summary, a row per
parameter (or group, like an envelope) with its current value, range and a line on what it does, and tips. Pointing
at a row lights up its controls in the copy and the other way round.

Above the rows, every panel draws the whole voice's signal flow: the five sources (with cross modulation into the saw
and square, and every source into the ring modulator), their mix, FILTER, AMP, DIST, EFX1 and EFX2, with the LFO and
the two envelopes as dashed control paths. It's live: each path is as strong as its level or depth, switched-off
sources and an off distortion are dimmed, and the effects show their types. The panel's own section stands out in
its colour; pointing at a block or path lights its rows and controls, and the other way round.

## Code

- `src/core/help/`: the text, as data. `synth.ts` has the synth sections, `efx.ts` each EFX type (its slots by name,
  its mode buttons, tips). `help.test.ts` checks every row names real parameters and every EFX slot is described.
- `src/editor/help/`: `HelpPanel.tsx` (the panel and the (i) button), `content.ts` (help plus the patch's live
  values), `hot.ts` and `Lit.tsx` (lighting controls in the copy). `ParamKnob`, `ParamFader`, `ParamLed`, the
  envelopes, the distortion stepper and the EFX knobs, drawing and mode buttons are wrapped in `Lit`.
- `src/core/help/voice.ts`: the voice's flow, laid out by hand (blocks, paths, and the parameters behind each path's
  strength); `voice.test.ts` checks its parameters are real. `src/editor/help/VoiceDiagram.tsx` draws it.
- `Section` takes an `info` node for the (i); a section's copy inside its own help leaves the (i) out.

## Sources

The wording is ours; the facts come from:

- Roland, *TB-3 Owner's Manual*: the front panel (CUTOFF, RESONANCE, ACCENT, EFFECT, the ENV MOD pad's x = env mod
  and y = decay), and that sounds can't be edited from the panel.
- Dope Robot, [TB-3 resources](https://www.doperobot.com/tb3.html): the *Unofficial TB-3 Effects Parameter Guide*,
  the *Unofficial SysEx Implementation* and the *Front Panel Guide*: every parameter's range and units, the effects'
  behaviour (STEREO2 dry left / chorus right, phaser STEP RATE, reverb AMBIENT doubling, compressor overdriving) and
  accent from MIDI velocity over 100.
- Roland's [TB-3 features page](https://www.roland.com/global/products/tb-3/features/): the filter is the TB-303's
  18 dB per octave ladder (Polynominal says 24 dB; we follow Roland).
- Roland's "Ultimate guide" blog post on the TB-3 and Polynominal's TB-3 page, for general acid-programming tips.

## Not confirmed

These are general synth knowledge or the sources' guesses, worded with care in the help, and worth checking on the
hardware: LEGATO vs ALWAYS portamento, BEND in semitones, COLOR adding harmonics (Dope Robot: "seems"), ring mod
UP / DOWN, and which way BIT CRUSH's FILTER runs.

No source we found gives a block diagram of the voice, so the flow is put together from the SysEx parameters. Two
parts of it are our reading, not documented:

- The order of DISTORTION, EFX1 and EFX2 isn't stated anywhere; the flow draws them in series in the order the SysEx
  and the editor list them. The text of the help doesn't claim an order.
- The sine and the ring modulator's RING input share one tuning (RING+SIN), so they may be one oscillator (Dope Robot
  says the TB-3 has three, where Roland's page says four); the flow draws the RING input from the SIN source.
