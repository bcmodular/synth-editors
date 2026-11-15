// Help for effects 36–46. Our words; facts from the SP-404MK2 Reference Manual (MFX List), tips from NearTao's guide.
import type { FxHelp } from "./types";

export const FX_HELP_36_46: Readonly<Record<number, FxHelp>> = {
  36: { // Equalizer
    summary: "A three-band EQ: low, mid and high bands, each with its own gain and a choice of centre frequency.",
    params: {
      low_gain: "Boosts or cuts the low band. Up for weight, down to thin out a muddy sample.",
      mid_gain: "Boosts or cuts the mid band, where most of a sound's body and presence sits.",
      high_gain: "Boosts or cuts the high band. Up for air and bite, down to darken or tame hiss.",
      low_freq: "Picks where the low band sits, from deep sub up into the low mids.",
      mid_freq: "Picks where the mid band sits, from the low mids up into the upper presence range.",
      high_freq: "Picks where the high band sits, from the upper mids to the very top.",
    },
    notes: [
      "Like Isolator, but you choose where each band sits, so you can aim at one problem area.",
      "To find a frequency, boost its gain a lot, sweep the FREQ until the problem jumps out, then cut it.",
      "Cuts are usually cleaner than boosts. Big boosts on several bands can push the bus into clipping.",
    ],
  },
  37: { // Compressor
    summary:
      "Evens out the volume: loud peaks are turned down and quiet parts brought up, so the sound sits at a steadier " +
      "level.",
    params: {
      sustain: "How much the effect holds up the decaying part of a sound. Higher keeps tails louder for longer.",
      attack: "How quickly it turns the sound down when a loud peak arrives. Slower lets the start of a hit through.",
      ratio: "How hard it squashes. Low is gentle levelling; high flattens the dynamics almost completely.",
      level: "The output volume, to make up for what the compression takes away (or adds).",
    },
    notes: [
      "A little goes a long way. Too much makes everything feel the same and loses the feel of the playing.",
      "On drums, a slower ATTACK keeps the transient and makes hits snap; a fast one softens them.",
      "It can get very loud with high settings. Bring LEVEL up slowly.",
    ],
  },
  38: { // SX Reverb
    summary: "The reverb from the older SP-404SX, with a simple dry/wet balance.",
    params: {
      time: "How long the reverb tail lasts, from a short room to a long wash.",
      tone: "The colour of the reverb. Positive is brighter, negative darker.",
      balance: "The mix of dry sound and reverb. Fully to the effect side gives reverb only.",
    },
    notes: [
      "Handy if you want the SX's sound, or a quick reverb with only three controls.",
      "A darker TONE keeps a long reverb from crowding the hi-hats and vocals.",
    ],
  },
  39: { // SX Delay
    summary: "The tempo-synced echo from the older SP-404SX, with a dry/wet balance.",
    params: {
      delay_time: "The time between echoes, as a note length at the current tempo, including dotted and triplet values.",
      feedback: "How much of each echo is fed back, so how many repeats you hear before it dies away.",
      balance: "The mix of dry sound and echoes.",
    },
    notes: [
      "1/8D and 1/4D are classic dub and pop delay times; triplets give a swung feel.",
      "Very high FEEDBACK keeps the repeats going for a long time. Ride it for build-ups, then pull it back.",
    ],
  },
  40: { // Cloud Delay
    summary:
      "A granular delay: it chops the sound into many small pieces and replays them, layered and smeared with reverb, " +
      "for a thick, shimmering cloud.",
    params: {
      window: "The spacing of the delayed pieces. Higher spreads them further apart and makes the space feel deeper.",
      pitch: "Shifts the pitch of the effect sound up or down, by up to an octave either way.",
      balance: "The mix of dry sound and cloud.",
      feedback: "How much of the cloud is fed back into itself. Further from the centre builds a longer, denser tail.",
      cloudy: "How thick the cloud is. Higher layers more pieces at once.",
      lofi: "When on, the effect sound is made grittier and lower quality.",
    },
    notes: [
      "Works best on pads, chords and held notes, where it turns them into slowly moving textures.",
      "Try PITCH at +12 with some FEEDBACK for an octave-up shimmer.",
      "Worth exploring by ear: small moves of WINDOW and CLOUDY change the character a lot.",
    ],
  },
  41: { // Back Spin
    summary: "Imitates a DJ spinning a record backwards, as a cut between sections.",
    params: {
      length: "How long the back spin lasts, as a note length from a whole bar down to a sixteenth.",
      speed: "How fast the record is spun back.",
      back_sw: "Turn it on while a sound is playing to fire the back spin; it runs for the LENGTH and then stops.",
    },
    notes: [
      "After you choose this effect it needs up to about three seconds of playing sound to fill its buffer first. " +
        "BACK SW blinks on the SP-404 while it does.",
      "Fire it on the last beat before a drop or a new section, as a DJ would between records.",
    ],
  },
  42: { // DJFX Delay
    summary:
      "DJFX Looper and a delay in one: it grabs a very short loop of what is playing and sends the stutter through an " +
      "echo.",
    params: {
      length: "How long the loop is. Shorter loops buzz and stutter faster.",
      time: "The time between echoes. With SYNC off it is set in milliseconds; with SYNC on it is a note length at the " +
        "tempo.",
      on_off: "Turn it on while a sound is playing to start the loop. The delay only works while this is on.",
      feedback: "How much of each echo is fed back, so how long the echoes carry on.",
      level: "The volume of the delay.",
      sync: "Locks the delay TIME to the tempo, as note lengths, instead of milliseconds.",
    },
    notes: [
      "Flick ON/OFF on and off in time for stuttered fills that trail away in echoes.",
      "With SYNC on and a high FEEDBACK, the echoes keep the stutter going after you let go.",
    ],
  },
  43: { // Auto Pitch
    summary:
      "Pitch correction and voice changing: it can retune a voice to a key, shift its pitch and formant, or turn it " +
      "into a flat robot voice. Input FX only.",
    params: {
      pitch: "Shifts the pitch up or down, by up to an octave.",
      formant: "Changes the vocal character without changing the pitch. Lower sounds deeper and more masculine, " +
        "higher lighter and more feminine.",
      balance: "The mix of your dry voice and the processed one.",
      at_pitch: "How strongly the pitch is pulled to the notes of the KEY. High gives the hard, stepped autotune sound.",
      key: "The key the pitch is corrected to. CHROMA corrects to the nearest semitone, in any key.",
      on_off: "The robot switch: when on, the voice loses its inflection and stays on one pitch.",
    },
    notes: [
      "Only on the INPUT FX: it processes what comes into the inputs, not the pads.",
      "Set KEY to your track's key so the correction lands on notes that fit.",
      "It works on instruments too, not just voices.",
    ],
  },
  44: { // Vocoder
    summary:
      "Turns the voice coming into the inputs into a vocoder voice: a synth that seems to speak the words, at the " +
      "notes you choose. Input FX only.",
    params: {
      note: "Which note the vocoder plays, counted from the root of the SCALE. The SCALE and CHORD shape what sounds.",
      formant: "Changes the vocal character. Lower sounds deeper and more masculine, higher lighter and more feminine.",
      tone: "How bright the vocoder sounds.",
      scale: "The scale the notes are taken from, and its root: any major or minor key.",
      chord: "What plays with the note: the root alone, a fifth, an octave, and up-and-down or third and seventh " +
        "shapes.",
      balance: "The mix of your dry voice and the vocoder.",
    },
    notes: [
      "Only on the INPUT FX: speak or sing into the mic input.",
      "Play it from a MIDI keyboard on channel 11: notes set the pitch, and pitch bend bends it. In this app the " +
        "keyboard overlay plays it on channel 11.",
      "Set SCALE to your track's key, then CHORD to fill it out; Root is the plainest, P5 and Oct the fullest.",
      "It isn't only for voices: drums or other sounds into the input can give odd, talking textures.",
    ],
  },
  45: { // Harmony
    summary: "Adds a harmony to the voice coming into the inputs, pitched to fit a key. Input FX only.",
    params: {
      pitch: "Shifts the pitch up or down, by up to an octave.",
      formant: "Changes the vocal character. Lower sounds deeper and more masculine, higher lighter and more feminine.",
      balance: "The mix of your dry voice and the effect.",
      at_pitch: "How strongly the pitch is corrected to the KEY.",
      key: "The key used to correct the pitch and to work out the harmony notes. CHROMA uses every semitone.",
      harmony: "Which harmony is added: a fifth, an octave, up-and-down shapes, a third, or a fifth or seventh above " +
        "or below.",
    },
    notes: [
      "Only on the INPUT FX: it works on what comes into the inputs.",
      "Set KEY to the track's key first, or the harmonies can land on notes that clash.",
      "3rd gives the classic backing-vocal harmony; Oct and P5 sound fuller and more neutral.",
    ],
  },
  46: { // Gt Amp Sim
    summary: "Models a guitar amplifier, from clean to heavily driven, with a three-band tone stack. Input FX only.",
    params: {
      amp_type:
        "The amp model. JC: a Roland JC-120 (clean). TWIN: a Fender Twin Reverb. BG: a MESA/Boogie combo's lead " +
        "sound. MATCH: a Matchless D/C-30. MS: a Marshall 1959. SLDN: a Soldano SLO-100.",
      drive: "How hard the amp is pushed: more volume and more distortion.",
      level: "The output volume.",
      bass: "Cuts or boosts the lows.",
      middle: "Cuts or boosts the midrange.",
      treble: "Cuts or boosts the highs.",
    },
    notes: [
      "Only on the INPUT FX: plug a guitar or bass into the input and you don't need an amp.",
      "JC and TWIN stay clean at low DRIVE; MS, BG and SLDN are for crunch and lead sounds.",
      "Raising DRIVE also raises the volume, so balance it with LEVEL.",
      "You can still stack the bus effects on top of it.",
    ],
  },
};
