# X32 chat control: desk test checklist

What's left to try on the real X32 Rack, as of 2026-11-24. Everything below is built and passes against the fake
desk and a scripted model; the real model passes the prompt check (14 phrases). None of it has written to the real
desk yet except the setup apply (22 Nov) and one FX library load into FX 8 (22 Nov). Tick items as you go and note
anything odd: a screenshot of the chat or the panel is enough.

Every plan the app applies is read back. If something doesn't read back, it stops and says what it found: that's
the most useful thing to send me.

## Setup

- [ ] Power on the desk. `npm run dev:x32`. The Desk panel says **Connected** and the first read finishes.
- [x] Every address the app reads answers (checked 25 Nov: 3,194, the new ones included).
- [x] The Sampler bus is named "SP-404 Mk2" on the desk (seen 25 Nov).
- [ ] Note: on 25 Nov the main fader and ch 7's (the TB-3) were at -∞. Raise them before the tests that listen.

## 1. Sends and the Sampler

- [ ] Chat: "send the TB-3 to the delay at -10". Applied at once; the TB-3's Delay send moves in X32-Edit.
- [ ] Chat: "route S-1 to the P-6". The plan waits for Apply and says it moves the Sampler from the SP-404 Mk2 to the
      P-6. Apply: aux out 1-2 carry the Sampler, XLR out 1-2 are off, and bus 11-12 are **named "P-6"** in X32-Edit.
- [ ] **Undo**: the outputs and the name go back to the SP-404 Mk2.
- [ ] Open question to check: does writing a send to one side of a linked pair also change the other? (The app writes
      both sides, so it works either way; X32-Edit shows whether the desk mirrors it.)

## 2. Effects

- [ ] Chat: "give the reverb a 3 second tail". FX 1 (Vintage Room) Decay changes in X32-Edit.
- [ ] Chat: "put a delay on the TD-3". Waits for Apply; FX 4 becomes a Stereo Delay, its bus feed goes off, and ch 3
      has FX 4L as a post-EQ insert. Then "take it off": the insert goes, FX 4 is fed from bus 7-8 again.
- [ ] Chat: "load Vocal Plate on the reverb" (or "a vocal plate on the reverb"). Waits for Apply; FX 1 becomes a
      Plate. Put your reverb back afterwards (a preset or a scene: preset loads aren't undoable).

## 3. Tempo

- [ ] Nome II running. The Tempo panel shows its BPM; FX 2 (Rhythm Delay) and FX 3 (Stereo Delay) are listed.
- [ ] Press **Set delays to … BPM**: FX 2's Time is a quarter and FX 3's an eighth, in X32-Edit. Listen for any
      artefact at the moment of the press.
- [ ] Untick FX 3, change the tempo, press again: only FX 2 changes.

## 4. Scenes and snippets (new)

The OSC side is checked (25 Nov): the filters are writable, and save, load and delete answer as expected.

- [ ] Chat: "save this as Test snippet". Applied at once. In X32-Edit, the snippet should exist and hold the sends and
      outputs.
- [ ] Change a send by chat, then "load Test snippet". Waits for Apply; the send comes back, and the Rig panel catches
      up (the app reads the whole desk again after a load).
- [ ] Chat: "load Studio base". Waits for Apply, then the whole desk goes back to the rig file setup.

## 5. Why can't I hear it (new)

- [ ] Mute ch 9 in X32-Edit. Chat: "I can't hear the S-1 on the sampler". It should name the mute (and any send at
      -∞). Unmute.
- [ ] Play the TB-3. Chat: "trace the TB-3 to the reverb, it's playing". It reports where the signal reaches.
      Channel, bus, XLR out and aux out meters are confirmed (25 Nov); **the main mix isn't**: if the trace says it's
      silent while you can hear it, tell me. (Raising the TB-3's faders and main fader first helps.)
- [ ] Chat: "is everything still set up the way the rig file says?" It lists what differs (the Sampler name, if you
      didn't apply it).

## Done already

- Setup from the rig file applied, all read back (22 Nov). Backup in scene 1, Studio base in scene 3.
- FX library load: library 027 into FX 8 read back as the right type (22 Nov).
- The Tempo panel finds "Nome II Clock" and reads 120.0 BPM (22 Nov).
