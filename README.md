# Synth Editors

Desktop editors for the Roland TB-3 and SP-404 MK2, with Launchpad Pro Mk1 preset triggering
and CC learn. Successor to the TouchOSC layouts in
[bcmodular/touchosc-controllers](https://github.com/bcmodular/touchosc-controllers).

Also here: **X32 chat control**, for setting up and re-routing a Behringer X32 Rack in plain language over OSC
("route the S-1 to the sampler", "an 80s gated reverb on the drum machine"), and keeping the desk matched to a rig
file. See [apps/x32/README.md](apps/x32/README.md), including how to set it up for your own desk.

Status: **TB-3 Phase 0 spike**. See [PLAN.md](PLAN.md).

## Requirements

- Node.js 22+ (`brew install node`)
- macOS for development (the packaged editors also build for Windows, untested there)

## Development

```bash
npm install
npm run dev:tb3      # Vite dev server + Electron window
npm run dev:sp404    # SP-404 MK2 editor (the Phase 0 spike is at #spike)
npm run dev:x32      # X32 chat control (finds the desk on the network)
npm test             # Vitest
npm run typecheck
```

To install the TB-3 Editor without Node, or to package a release, see
[apps/tb3/README.md](apps/tb3/README.md). The [user guide](apps/tb3/docs/user-guide.md) explains
every feature. The SP-404 MK2 editor has its own [README](apps/sp404/README.md) (installing, releasing) and
[user guide](apps/sp404/docs/user-guide.md).

`npm run dev:browser -w @synth-editors/tb3` serves the renderer on its own for use in Chrome,
which asks for MIDI + SysEx permission on first load.

## Layout

```
apps/tb3/            TB-3 editor (Electron main in electron/, React renderer in src/)
apps/sp404/          SP-404 MK2 editor (FX, pad mixer, scopes, controllers)
apps/x32/            X32 chat control (Electron; plain-language routing over OSC, rig file setup)
packages/midi/       Web MIDI access, port listing, SysEx helpers
packages/launchpad/  Launchpad Pro Mk1 Programmer layout, LEDs, input parsing
```

## Credits

The SP-404 MK2 pad mixer talks to the SP-404's USB serial port using the reverse-engineered protocol notes
of the [SparkyMK2](https://github.com/TuscanPL/SparkyMK2) project (GPL-3). The code here was written from
their notes only; none of theirs is copied.

The JV-2080 editor's EFX tables use the parameter order and raw value ranges that tgoelles measured on a JV-2080
for [jv2080-max-for-live](https://github.com/tgoelles/jv2080-max-for-live) (CC BY-NC 4.0). The manual gives
neither. The measured facts are recorded in [docs/jv2080-sysex-map.md](docs/jv2080-sysex-map.md) §7; no code is
copied.
