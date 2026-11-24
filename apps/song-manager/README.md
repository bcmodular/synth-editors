# Song Manager

Song Manager will track each song from jam to mix across the H12, the X32 and Reaper. So far this folder holds
the first piece, the **Reaper bridge**: a Lua script that runs inside Reaper and a TypeScript client that talks to
it over HTTP. There is no app window yet.

## How the bridge works

Song Manager reaches the script through Reaper's web interface and ExtState, using the `GET/EXTSTATE` and
`SET/EXTSTATE` routes in the `SongManager` section.

- **State, Reaper to app.**
  - When `GetProjectStateChangeCount` moves, the script rebuilds the track list.
  - On every tick it reads arm, mute and solo on every track, because those don't always move the change count.
  - When anything has changed, it publishes `state` (one line of JSON) and a new `state_seq`.
  - The app polls `state_seq` and fetches `state` only when it moves.
- **Commands, app to Reaper.** The app writes one command as base64url JSON to `cmd`. The script runs it in one
  undo block and writes `result` with the same id, after the new state.
- **Tracks by GUID.** Every command names its track by GUID. The script also stores the part id in the track's
  `P_EXT:SongManager`.
- **Ports by name.** MIDI ports are always named, for example `H12MIDI-Pro Port 3`. The script converts names
  to Reaper's device indexes.

| File | What it is |
| --- | --- |
| `reaper/Song Manager bridge.lua` | The script to run in Reaper |
| `reaper/SongManager/*.lua` | The bridge itself: loop, commands, track fields, JSON, base64 |
| `reaper/Effects/SongManager/note_filter.jsfx` | Record-input note filter for split devices (one TR-8S instrument) |
| `reaper/test/` | Lua tests against a mock Reaper, and a driver for the end-to-end test |
| `src/reaper/` | TypeScript client, types, a fake web interface, and the try-out steps |
| `scripts/try-bridge.ts` | The try-out command below |

`npm test` runs the client tests, the Lua tests, and an end-to-end test of the client driving the Lua bridge on
the mock Reaper (needs `lua`; `brew install lua`).

## Trying it in Reaper

The script and the note filter are already linked into Reaper's resource folder:
`Scripts/SongManager` and `Effects/SongManager` point here.

1. **Turn on the web interface.** In Reaper, open Preferences › Control/OSC/web, click Add, and pick **Web browser
   interface**. Set the port to 8080 (or set `REAPER_URL` below). Setting a username and password is optional;
   pass them with `--auth user:password`.
2. **Start the bridge.** Open a new, empty project. In Actions › Show action list, choose New action › Load
   ReaScript, then pick `Scripts/SongManager/Song Manager bridge.lua` and run it. It keeps running in the
   background. Running it again replaces the running copy. To stop it, run the action again and choose Terminate
   instances.
3. **Run the checks** from the repo root:

```bash
node apps/song-manager/scripts/try-bridge.ts check
```

```bash
node apps/song-manager/scripts/try-bridge.ts ports
```

```bash
node apps/song-manager/scripts/try-bridge.ts demo --in "H12MIDI-Pro Port 3" --out "H12MIDI-Pro Port 2" --channel 6 --notes 36,38
```

```bash
node apps/song-manager/scripts/try-bridge.ts watch
```

```bash
node apps/song-manager/scripts/try-bridge.ts cleanup
```

- `check` confirms the web interface answers and the script is running, and times a round trip.
- `ports` lists the MIDI ports Reaper sees. The H12 port names may differ from the ones above.
- `demo` makes an "SM test" track and runs each command on it, checking each against the published state:
  input, monitoring, note filter, MIDI out, mute, solo, arm and FX chain. At the end it sends All Notes Off on the
  out port. The track is left armed.
- `watch` prints the state whenever it changes. Arm, mute and solo tracks by hand in Reaper, and start and stop
  the transport.
- `cleanup` deletes the demo's tracks.

`send '{"type":"add-marker","bar":5,"name":"Chorus"}'` sends any single command.

### What to look out for

- **Ports out of range.** `I_MIDIHWOUT` only reaches output devices 0–31, and record inputs only 0–61. A port
  outside those ranges fails with an error that names it.
- **MIDI out channel.** On the test track, check whether a MIDI out channel of 6 filters to channel 6 or moves
  every note onto it. Hand-over relies on the channel arriving unchanged.
- **Note filter.** Record a few TR-8S notes into the demo track (input from its capture port, `--notes 36,38`).
  Only BD and SD should land.
- **Watch delay.** In `watch`, arm, mute and solo changes made in Reaper should appear within about a fifth of
  a second.
- **Errors in the console.** If the script hits an error, Reaper's ReaScript console shows it once, and the loop
  keeps running.
