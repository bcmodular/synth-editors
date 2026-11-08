# Synth Editors

Desktop editors for the Roland TB-3 and SP-404 MK2, with Launchpad Pro Mk1 preset triggering
and CC learn. Successor to the TouchOSC layouts in
[bcmodular/touchosc-controllers](https://github.com/bcmodular/touchosc-controllers).

Status: **TB-3 Phase 0 spike**. See [PLAN.md](PLAN.md).

## Requirements

- Node.js 22+ (`brew install node`)
- macOS for development (the packaged TB-3 Editor also builds for Windows, untested there)

## Development

```bash
npm install
npm run dev:tb3      # Vite dev server + Electron window
npm test             # Vitest
npm run typecheck
```

To install the TB-3 Editor without Node, or to package a release, see
[apps/tb3/README.md](apps/tb3/README.md).

`npm run dev:browser -w @synth-editors/tb3` serves the renderer on its own for use in Chrome,
which asks for MIDI + SysEx permission on first load.

## Layout

```
apps/tb3/            TB-3 editor (Electron main in electron/, React renderer in src/)
packages/midi/       Web MIDI access, port listing, SysEx helpers
packages/launchpad/  Launchpad Pro Mk1 Programmer layout, LEDs, input parsing
```
