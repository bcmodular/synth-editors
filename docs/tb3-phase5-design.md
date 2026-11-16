# TB-3 — Phase 5: packaging and settings (design)

Status: **settings window implemented**; signing, and checking reconnects, still to do (see PLAN.md).

## Settings window

Every setting in one place, replacing the MIDI and CC popovers on the TB-3 block.

- **A panel over the editor, not a second OS window.** It shares the page's live state (MIDI access, CC learn, the
  Launchpad's brightness) without passing it between windows, and works the same in a browser during development.
  It is rendered in `<body>`, like the dialogs, so it isn't scaled with the editor's fit zoom.
- **Opening it**: SETTINGS in the TB-3 block (the tab used last, remembered as `settings.tab`), CC (the CC tab), ⌘,
  (Ctrl+, on Windows), or Settings… in the app menu (`electron/main.cjs` `buildMenu`: the Mac's app menu, File on
  Windows; `preload.cjs` exposes it as `window.tb3App.onSettings`). Esc, CLOSE or a click outside closes it.
- **Tabs** (`editor/SettingsWindow.tsx`):
  - MIDI: TB-3 IN / OUT, TB-3 CHANNEL, QUIET SWITCH, SHOW LOG.
  - CONTROLLERS: LAUNCHPAD IN / OUT, LAUNCHPAD BRIGHTNESS (the profiles the User button cycles; `useLaunchpad` now
    returns `profile` / `setProfile`), KEYS IN.
  - CC: the CC assignments (`editor/CcSettings.tsx` `CcPane`), as the popover had them.
  - AUDIO: AUDIO IN (LIVE).
  - LIBRARY: the library folder, with CHOOSE… / CHANGE… (the same as the LIBRARY block's button).
  Each field has a one-line hint under it.
- **CC learn**: LEARN on the CC tab closes the window so a parameter can be clicked; a bar at the top of the editor
  (`LearnBar`) says what learning waits for, with CANCEL. When learning ends (a CC learned, or cancelled) the window
  comes back on the CC tab (`editor/useSettingsWindow.ts`). A row's own LEARN needs no click, so the window stays.
- **Not in it**: the morph send rate stays on the MORPH block's RATE fader, where it's used while morphing.
