// Help for effects 25–35. Our words; facts from the SP-404MK2 Reference Manual (MFX List), tips from NearTao's guide.
import type { FxHelp } from "./types";

export const FX_HELP_25_35: Readonly<Record<number, FxHelp>> = {
  25: { // Flanger
    summary:
      "Mixes in a very slightly delayed copy of the sound and sweeps the delay, giving the swooping, jet-plane " +
      "whoosh of a classic flanger. It has a hollower, comb-filter edge than the phaser.",
    params: {
      depth: "How far the sweep travels. Low values give a gentle shimmer; high values a deep swoosh.",
      rate:
        "How fast the sweep cycles. With SYNC off it is a free speed; with SYNC on it is a length in bars, so the " +
        "sweep locks to the tempo (longer bars give a slower sweep).",
      manual:
        "Where in the frequency range the sweep sits. Lower values take some of the flanging out of the low end.",
      resonance:
        "Resonance of the sweeping filter. Turn it up to emphasise the sweep, for a stronger, more unusual " +
        "metallic tone.",
      balance: "The mix between the dry sound and the flanged sound.",
      sync: "Off: RATE is a free speed. On: RATE is set in bars and follows the tempo.",
    },
    notes: [
      "A staple guitar effect; it also works well on pads, hats and whole loops for movement.",
      "Turn on SYNC and set the sweep to one or two bars so the whoosh lands with the phrase.",
      "Low RATE with high RESONANCE gives the slow jet-plane sweep; ease RESONANCE back if it starts to ring.",
      "Keep MANUAL low on bass-heavy material so the low end stays solid.",
    ],
  },
  26: { // Phaser
    summary:
      "Mixes in a phase-shifted copy of the sound and sweeps it, giving a smooth, swirling, very 1970s motion. " +
      "Gentler and simpler than the flanger.",
    params: {
      depth: "How far the sweep travels. Higher values give a more obvious swirl.",
      rate:
        "How fast the sweep cycles. With SYNC off it is a free speed; with SYNC on it is a length in bars, locked " +
        "to the tempo.",
      manual:
        "Where in the frequency range the sweep sits. Higher values take some of the phasing out of the low end.",
      resonance: "Emphasises the sweep for a sharper, more pronounced and unusual tone.",
      balance: "The mix between the dry sound and the phased sound.",
      sync: "Off: RATE is a free speed. On: RATE is set in bars and follows the tempo.",
    },
    notes: [
      "Try it on guitars, keys and other melodic parts for a classic 70s swirl.",
      "Note that MANUAL works the opposite way to the flanger's: here raising it thins the effect in the lows.",
      "A slow synced sweep over several bars adds movement to a static pad without drawing attention.",
    ],
  },
  27: { // Wah
    summary: "A filter whose frequency sweeps up and down on its own, giving the familiar wah-wah sound.",
    params: {
      peak: "How narrow the filter's peak is. Higher values focus the effect on a tighter band, for a more vocal wah.",
      rate:
        "How fast the wah cycles. With SYNC off it is a free speed; with SYNC on it is a length in bars, locked " +
        "to the tempo.",
      manual: "The centre of the frequency range the wah moves around.",
      depth: "How far the filter moves from that centre. At low values the wah barely moves.",
      filter_type:
        "LOW-PASS works over a wide range and sounds fuller; BAND-PASS works over a narrow range and sounds " +
        "thinner and more pronounced.",
      sync: "Off: RATE is a free speed. On: RATE is set in bars and follows the tempo.",
    },
    notes: [
      "Another guitar staple; it suits funk guitar, clavs and basslines.",
      "Turn DEPTH right down and play MANUAL by hand for a fixed or manually swept wah.",
      "Sync it at a short note value for a rhythmic, auto-wah pulse on chords.",
    ],
  },
  28: { // Slicer
    summary:
      "Chops the sound into a 16-step rhythm, cutting the volume in and out according to a pattern, so a held " +
      "sound becomes a gated, played-sounding phrase.",
    params: {
      pattern: "Which of the 32 step patterns does the chopping. Each one is a different rhythm; try them in turn.",
      speed:
        "How long the pattern takes to repeat. With SYNC off it is a free speed; with SYNC on it is a note value " +
        "locked to the tempo.",
      depth: "How hard the slicing cuts. Low values just dip the volume; high values chop it right out.",
      shuffle: "Pushes the even-numbered steps later, adding swing to the pattern.",
      mode:
        "LEGATO keeps the volume steady from one sounding step to the next; SLASH drops it to silence between " +
        "steps, so every step is cut separately.",
      sync: "Off: SPEED is a free rate. On: SPEED is a note value that follows the tempo.",
    },
    notes: [
      "It is most striking on sustained sounds: pads, long bass notes, drones and held chords.",
      "On drums it works as a rhythmic gate; turn SYNC on so the slices stay locked to the beat.",
      "Use SLASH for tight, choppy trance-gate rhythms and LEGATO for a smoother pulse.",
      "A little SHUFFLE helps the pattern sit with swung beats.",
    ],
  },
  29: { // Tremolo / Pan
    summary: "Moves the volume (tremolo) or the stereo position (auto-pan) up and down in a steady cycle.",
    params: {
      depth:
        "How strong the movement is. Low values give a subtle wobble; high values a full on-off or left-right swing.",
      rate:
        "How fast it cycles. With SYNC off it is a free speed; with SYNC on it is a length in bars, locked to the " +
        "tempo.",
      type: "TREMOLO moves the volume; PAN moves the sound between left and right.",
      wave:
        "The shape of the movement: TRI and SIN are smooth, SQR jumps between two states, SAW1 and SAW2 are two " +
        "sawtooth shapes that ramp and then jump, and TRP (trapezoid) is a square with sloped edges.",
      sync: "Off: RATE is a free speed. On: RATE is set in bars and follows the tempo.",
    },
    notes: [
      "Good for adding space and gentle motion to pads, keys and melodic loops.",
      "TREMOLO with the SQR wave and high DEPTH gives a hard, gated chop.",
      "PAN with a slow sine wave widens a mono sound without changing its tone.",
    ],
  },
  30: { // Chromatic PS
    summary:
      "A two-voice pitch shifter that adds two copies of the sound, each moved by a set number of semitones, so " +
      "one note can become a chord or an octave stack.",
    params: {
      pitch1: "How many semitones the first voice is shifted, up or down.",
      pitch2: "How many semitones the second voice is shifted, up or down.",
      balance: "The mix between the dry sound and the two shifted voices.",
      pan1: "Where the first voice sits in the stereo field.",
      pan2: "Where the second voice sits in the stereo field.",
    },
    notes: [
      "Try +4 and +7 for a major chord, +3 and +7 for minor, or -12 and +12 for octaves either side.",
      "Pan the two voices apart for a wide, layered sound.",
      "Shifted voices can sound sour on complex material; it works best on simple, single-note sounds.",
      "Unlike the other effects here, it can also be loaded as an input effect.",
    ],
  },
  31: { // Hyper-Reso
    summary:
      "A tuned resonator that makes the sound ring at notes of a chosen scale, so noises and drums take on a " +
      "melodic or bass-line pitch.",
    params: {
      note: "Which note of the scale rings, counted in steps from the scale's root, below or above it.",
      spread: "The octave range the resonance covers, from UNISON (all at one pitch) out to HUGE.",
      character: "The brightness and detune of the ringing tone.",
      scale: "The key and scale (major or minor) the resonance is tuned to.",
      feedback: "How long and strongly the resonance rings. High values sustain into a pitched drone.",
      env_mod: "Raises the feedback as the input gets louder, so louder hits ring harder.",
    },
    notes: [
      "Set SCALE to your track's key first, then play NOTE to pick out a melody or bass line.",
      "It can give a dark edge or a bright sheen to selected samples.",
      "It tends to make everything through it sound alike, so use it on a few sounds rather than the whole mix.",
      "Watch the level with high FEEDBACK; the resonance can build up quickly.",
    ],
  },
  32: { // Ring Mod
    summary:
      "Multiplies the sound by a tone, adding clangorous, inharmonic overtones that make it metallic, bell-like " +
      "or robotic.",
    params: {
      frequency: "The range the effect works on. Changing it shifts the metallic overtones up or down.",
      sensitivity: "The volume of the effect sound.",
      balance: "The mix between the dry sound and the ring-modulated sound.",
      polarity:
        "Which direction the frequency modulation moves in. Switch it to hear a different flavour of the effect.",
      eq_low: "Boosts or cuts the low end of the result.",
      eq_high: "Boosts or cuts the high end of the result.",
    },
    notes: [
      "Use it to make a sound more like a bell, brass or struck metal.",
      "Keep BALANCE towards dry for a subtle metallic edge; fully wet sounds harsh and atonal.",
      "Use the EQ to cut low mud or tame harsh top that the effect adds.",
    ],
  },
  33: { // Crusher
    summary:
      "A lo-fi effect that lowers the sample rate, adding gritty, aliased crunch with a slightly ringing edge.",
    params: {
      filter: "A low-pass filter before the crushing. Lower settings dull the sound going in, so the result is darker.",
      rate: "How far the sample rate is lowered. Higher values give a rougher, more lo-fi result.",
      balance: "The mix between the dry sound and the crushed sound.",
    },
    notes: [
      "Good for crunchy drums and old-sampler grit.",
      "It can ring a lot on some material; pull BALANCE back towards dry or lower FILTER to tame it.",
      "Blend some dry sound back in to keep the punch while adding grit.",
    ],
  },
  34: { // Overdrive
    summary: "Mild, warm distortion that thickens a sound and helps it cut through, much like an overdrive pedal.",
    params: {
      drive: "How hard the sound is driven. More drive gives more grit.",
      tone: "Tilts the tone: higher values bring out the highs, lower values bring out the lows.",
      balance: "The mix between the dry sound and the overdriven sound.",
      level: "The output volume of the effect sound. Use it to match the level of the dry sound.",
    },
    notes: [
      "Best in moderation; a little drive adds character and helps a sound punch through.",
      "It takes up space in a mix, so it works better on sparse tracks than on busy ones.",
      "Raising DRIVE also raises the volume; bring LEVEL down to compensate.",
    ],
  },
  35: { // Distortion
    summary: "Heavy distortion, the most aggressive of the drive effects.",
    params: {
      drive: "How hard the sound is driven. More drive gives a fuzzier, more saturated sound.",
      tone: "Tilts the tone: higher values bring out the highs, lower values bring out the lows.",
      balance: "The mix between the dry sound and the distorted sound.",
      level: "The output volume of the effect sound. Use it to match the level of the dry sound.",
    },
    notes: [
      "Reach for it when the overdrive isn't enough; it has a more forceful tone.",
      "Mix in some dry sound with BALANCE to keep the attack of drums clear under the distortion.",
      "Pull TONE down if the high end turns fizzy, and watch LEVEL as you raise DRIVE.",
    ],
  },
};
