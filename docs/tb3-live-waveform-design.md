# TB-3 — Live waveform and level meter (design)

Status: **implemented**. The TB-3 is a USB audio interface as well as a MIDI device (2 channels in,
through Roland's TB-3 driver on the Mac). The editor listens to that input and shows what the TB-3 is
actually playing, next to the picture it draws from the settings.

## What it shows

- **VCO MIX** gets **DRAWN / LIVE** buttons in its header. DRAWN is today's picture of the mixed oscillators,
  drawn from the settings. LIVE shows the TB-3's output instead.
- **Waveform**: a scrolling readout of the last few seconds, newest on the right, in two lanes: L above R. Each
  pixel column is the lowest and highest sample in its slice of time, drawn as a filled band around the centre
  line, the way a DAW draws a recording as it comes in. Notes, accents, envelopes, filter sweeps and the LFO show
  as the shape of the band; silence is a flat line. (The first version mixed L and R into one lane; a lopsided
  band then looked like a pan. Logging the real TB-3 showed no DC offset and equal L/R levels: the lopsidedness
  is the wave's own shape, and the effects decorrelate the sides.)
- **Correlation**: a thin −1 … +1 bar under the lanes (shared with the SP-404's scopes), averaged over about
  300 ms. Right of centre is alike, +1 mono; amber left of centre is out of phase.
- **Span**: 4 s across the panel (about 11 ms per column at its width). Fixed at first; a TIME control can come
  later if 4 s turns out wrong.
- **Level meter**: two thin bars, L and R, down the right edge of the panel, scaled −48 to 0 dBFS:
  - The bar is the peak level, with an instant rise and a fall of 24 dB a second, so it's readable.
  - A peak-hold tick stays at the highest level for 1.5 s.
  - A clip light at the bottom lights when a sample reaches full scale (0 dBFS) and stays lit until clicked.
  - The highest peak since the last click shows as a number under the bars.
- **No sound goes anywhere**: the editor only listens. The TB-3's audio still reaches your speakers through your
  interface or DAW as before.

## Choosing the input

- MIDI settings get an **AUDIO IN** menu listing the computer's audio inputs. When nothing is chosen, the first
  input whose name contains "TB-3" is used.
- The choice is remembered by name, like the MIDI ports.
- Nothing is opened until LIVE is first pressed, so people without the TB-3's audio never see a microphone
  prompt. On the Mac the first LIVE asks for microphone permission once (the system calls any audio input a
  microphone).
- If there's no audio input, or permission is refused, LIVE shows why in the panel (e.g. "No TB-3 audio input:
  choose one in MIDI settings") and DRAWN still works.
- DRAWN or LIVE is remembered, and LIVE reopens the input at launch.

## How it works

- `getUserMedia` on the chosen device, stereo, with echo cancellation, noise suppression and automatic gain off
  (they would change the level and shape). An `AudioContext` splits the two channels into two `AnalyserNode`s,
  which feed a silent gain node so the graph runs without playing anything.
- Each animation frame reads the samples that arrived since the last frame (from the context's clock) and feeds
  them to pure, unit-tested pieces in `packages/audio` (shared with the SP-404 editor):
  - `waveColumns`: builds min/max columns from a stream of samples, in a ring of the panel's width (one per side).
  - `correlation`: L·R over √(L²·R²), fading with a 300 ms time constant.
  - `levelMeter`: peak, fall, hold and clip from each frame's samples, in dBFS.
- A canvas draws both, outside React's render loop. Nothing is stored or sent.
- The audio stops when LIVE is switched off or the window closes.

## Packaging and testing

- The Mac app's Info.plist gets a microphone usage description; without it macOS refuses the input.
- e2e tests launch Electron with Chromium's fake audio device (a tone with regular beeps) and check that LIVE
  shows a level and draws a waveform. With the real TB-3, check by playing a pattern.
- Windows: Roland's TB-3 driver is probably needed there too; untested.
