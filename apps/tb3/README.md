# TB-3 Editor

Editor and patch librarian for the Roland TB-3: every tone parameter, 16-slot patch sets, a patch
library, audition, morph and undo. Talks to the TB-3 over USB MIDI (SysEx).

## Installing

Download the installer for your computer from the
[releases page](https://github.com/bcmodular/synth-editors/releases):

| Computer | File |
| --- | --- |
| Mac with Apple Silicon (M1 and later) | `TB-3-Editor-<version>-mac-arm64.dmg` |
| Mac with an Intel processor | `TB-3-Editor-<version>-mac-x64.dmg` |
| Windows 10 or 11 (64-bit) | `TB-3-Editor-<version>-win-x64.exe` |

The apps aren't signed, so the first launch needs one extra step:

- **Mac**: open the `.dmg` and drag TB-3 Editor to Applications. The first time you open it, macOS
  says it can't check the app for malicious software. Click **Done**, then go to **System
  Settings → Privacy & Security**, scroll down and click **Open Anyway** next to TB-3 Editor.
  From then on it opens normally.
- **Windows**: run the `.exe`. If SmartScreen says "Windows protected your PC", click **More
  info**, then **Run anyway**.

On Windows a MIDI port can only be used by one app at a time: close anything else using the TB-3's
port (a DAW, MIDI-OX) first.

## Releasing

```bash
npm run package:tb3                                   # this computer's installers, in apps/tb3/release/
TB3_RELEASE_DIR=/tmp/tb3-release npm run package:tb3  # if Documents syncs with iCloud (see below)
npm run package:tb3 -- --win                          # on a Mac, the Windows installer too
```

From a Mac this builds both `.dmg`s. The Mac apps are ad-hoc signed, which Apple Silicon needs
before it will run them at all; codesign fails inside a Documents folder that syncs with iCloud,
so build somewhere else with `TB3_RELEASE_DIR`.

For a release, bump `version` in `apps/tb3/package.json`, then push a tag:

```bash
git tag tb3-v0.1.0
git push origin tb3-v0.1.0
```

GitHub Actions (`.github/workflows/tb3-release.yml`) builds the Mac and Windows installers and
attaches them to a draft release; check it on the releases page and publish it.
