# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Code Health guidance for the CodeScene MCP tools: @AGENTS.md

## Project Overview

Desktop editors for the Roland TB-3 and SP-404 MK2, with Launchpad Pro Mk1 preset triggering. Successor to
the TouchOSC layouts in [bcmodular/touchosc-controllers](https://github.com/bcmodular/touchosc-controllers).
This repo is public. The roadmap is in [PLAN.md](PLAN.md); design notes and to-do lists are in `docs/`.

```
apps/tb3/            TB-3 editor: Electron main in electron/, React + TS renderer in src/, Playwright e2e in e2e/
apps/jv2080/         JV-2080 editor (Phase 3 in progress; docs/jv2080-design.md)
packages/midi/       Web MIDI access, port listing, SysEx helpers
packages/launchpad/  Launchpad Pro Mk1 Programmer layout, LEDs, input parsing
```

## Commands

Node is at `/opt/homebrew/bin`; add it to `PATH` in non-interactive shells. Run scripts from the repo root.

```bash
npm run dev:tb3                                   # Vite dev server + Electron window
npm test                                          # Vitest unit tests
npm run typecheck
npm run test:e2e                                  # Playwright against a fake TB-3
TB3_PORT="H12MIDI-Pro Port 4" npm run test:tb3    # Playwright against the real TB-3 (restores its sound afterwards)
```

The e2e tests run with the window hidden and out of the Dock; `E2E_SHOW=1` shows it, to watch a test.
A change is done when all four pass (the last only if the TB-3 is connected). The user often has `npm run dev:tb3`
open and tests on the hardware as work goes along, so keep the app runnable between commits.

## TB-3 editor

- `src/core/` is pure logic (params, SysEx, patch encode/decode, patch sets) with vitest tests beside it.
- `src/editor/` holds the React editor; `useSession` owns the session state (slots, active patch, morph).
- `src/ui/` holds generic controls (faders, dialogs, tooltips).
- The TB-3 talks Roland SysEx (DT1 to write, RQ1 to read back). In the studio it is on MIDI channel 2, behind the
  H12MIDI-Pro interface on Port 4, or on its own USB port (`TB3_PORT="TB-3"`, with Roland's driver). Over USB it drops
  messages that arrive too close together, so every send goes through `editor/pacer.ts`.
- End-to-end tests (`apps/tb3/e2e/`): `tb3.ts` is the harness. It gives each test a throwaway profile and library,
  reads the TB-3 back with RQ1, and restores the TB-3's sound at the end. `fakeTb3.ts` stands in for the hardware.
  With real hardware, a debug app instance must stub `MIDIOutput.prototype.send` before selecting any port.

## Conventions

- The code is **not** Prettier-formatted (lines run to about 120 columns). Don't run Prettier.
- CodeScene can't score `.cjs` files (`apps/tb3/electron/`).
- `fixtures/local/` holds gitignored third-party patches. Never commit them or anything decoded from them.
  Never open `.tosc` files.
- Commit on `main` in small, sensible steps and push.
