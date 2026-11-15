// Help for effects 13–24. Our words; facts from the SP-404MK2 Reference Manual (MFX List), tips from NearTao's guide.
import type { FxHelp } from "./types";

export const FX_HELP_13_24: Readonly<Record<number, FxHelp>> = {
  13: { // Stopper
    summary:
      "Slows playback down like a turntable or tape machine winding to a halt, with optional darkening and fading " +
      "as it slows.",
    params: {
      depth: "How far the playback speed drops. Low values give a slight sag; high values bring the sound to a crawl.",
      rate: "How long the slowdown takes, as a note length: 4/1 is a slow wind-down, 1/64 a near-instant stop.",
      resonance: "Emphasises the filter's peak as the sound slows, for a stranger, more vocal stop.",
      flt_mod: "How much the highs roll off as the speed drops, so the sound gets duller as it stops.",
      amp_mod: "How much the volume falls with the speed, so the sound fades out as it stops.",
    },
    notes: [
      "Only buses 1 and 2 can load it.",
      "Put it on some parts and leave others running (drums, say), so you still have the beat to bring the track " +
        "back in on.",
      "FLT MOD and AMP MOD together make the stop sound more like a real record losing power.",
    ],
  },
  14: { // Tape Echo
    summary:
      "A model of the tape echo in Roland's RE-201 Space Echo: repeats from up to three playback heads, with the " +
      "pitch wobble of a worn tape transport.",
    params: {
      time: "The tape speed. Higher values run the tape slower, so the gap between repeats gets longer.",
      feedback: "How loud each repeat is fed back, so how long the echoes keep going.",
      level: "The volume of the echoes. The dry sound always passes at full level.",
      mode:
        "Which playback heads sound: S (short), M (middle) and L (long), alone or combined. Combinations give " +
        "several repeats at different spacings, for rhythmic patterns.",
      wf_rate: "How fast the wow and flutter (the tape's pitch wobble) moves.",
      wf_depth: "How much the pitch wobbles. A little sounds like old tape; a lot sounds seasick.",
    },
    notes: [
      "There's no dry/wet balance: use LEVEL to set how loud the echoes sit under the dry sound.",
      "Multi-head modes with moderate FEEDBACK give the classic dub-style rhythmic echo.",
      "If you want the wobble on the sound itself rather than on the echoes, try Cassette Sim instead.",
      "Not available on the input bus.",
    ],
  },
  15: { // TimeCtrlDly
    summary:
      "A delay whose time you can move smoothly while it plays: the repeats bend in pitch as you turn TIME, like a " +
      "tape delay. Filters on the feedback shape how the repeats change as they decay.",
    params: {
      time:
        "The delay time. With SYNC off it's a free time in milliseconds; with SYNC on it's a note value (straight, " +
        "dotted or triplet) locked to the tempo.",
      feedback: "How much of each repeat is fed back, so how many repeats you hear.",
      level: "The volume of the repeats. The dry sound always passes at full level.",
      l_damp_f: "Cuts the lows below this frequency on every repeat, so the echoes thin out. FLAT leaves the lows alone.",
      h_damp_f: "Cuts the highs above this frequency on every repeat, so the echoes darken. FLAT leaves the highs alone.",
      sync: "OFF sets TIME freely; ON locks it to note values at the current tempo.",
    },
    notes: [
      "Sweep TIME while it's running for pitch-bending echo throws.",
      "Damping both ends makes the repeats sit behind the dry sound instead of cluttering it.",
      "Good for ghost notes and off-beat rhythms: try a dotted or triplet value with SYNC on.",
    ],
  },
  16: { // Super Filter
    summary:
      "A filter with a very steep slope, whose cutoff can be swept up and down automatically for pumping or " +
      "gating effects.",
    params: {
      cutoff: "Where the filter works. Higher values move the cutoff up.",
      resonance: "Emphasises the frequencies around the cutoff. Higher values give a sharper, more whistling peak.",
      filter_type: "LPF keeps the lows, BPF keeps a band around the cutoff, HPF keeps the highs.",
      depth: "How far the automatic sweep moves the cutoff, from subtle movement to deep, choppy pumping.",
      rate:
        "How fast the cutoff sweeps. With SYNC off it's a free speed; with SYNC on it's a note value (straight, " +
        "dotted or triplet) locked to the tempo.",
      sync: "OFF sets RATE freely; ON locks the sweep to note values at the current tempo.",
    },
    notes: [
      "With DEPTH at maximum the steep slope makes it work almost like a rhythmic gate.",
      "Set DEPTH to 0 to use it as a plain, very sharp static filter.",
      "Dotted and triplet rates with SYNC on give more interesting patterns than straight ones.",
      "Not available on the input bus.",
    ],
  },
  17: { // Warm Saturator
    summary:
      "A saturator with a warm, tube-like character: drives the sound for added harmonics and thickness, with a " +
      "simple low and high EQ.",
    params: {
      drive: "How hard the sound is driven. Low settings add warmth; high settings tip into distortion.",
      eq_low: "Boosts or cuts the low end.",
      eq_high: "Boosts or cuts the high end.",
      level: "The output volume. Use it to bring the level back down as you add DRIVE.",
    },
    notes: [
      "It can get very loud: watch LEVEL as you raise DRIVE or boost the EQ.",
      "Push DRIVE until it clearly distorts, then back off to where it just adds character.",
      "Switch it on and off to check the change is helping: saturation is easy to overdo, especially on a full mix.",
    ],
  },
  18: { // 303 VinylSim
    summary:
      "A model of the SP-303's Vinyl Sim: makes the sound feel like it's playing from a record, with record-style " +
      "compression, surface noise and wobble.",
    params: {
      comp: "How much of the squashed, compressed feel of a record is applied.",
      noise: "The volume of the record's surface noise.",
      wow_flut: "How much the pitch wavers, as from a record turning unevenly.",
      level: "The volume of the processed sound.",
    },
    notes: [
      "The compression is its stand-out feature: it glues a loop or drum bus together.",
      "Compare it with 404 VinylSim: they sound different, and people prefer one or the other.",
      "Keep WOW FLUT low on melodic parts unless you want them to sound out of tune.",
    ],
  },
  19: { // 404 VinylSim
    summary:
      "A model of the SP-404SX's Vinyl Sim: makes the sound feel like it's playing from a record, with noise, wobble " +
      "and the frequency response of the playback system.",
    params: {
      freq: "The frequency response of the imagined record player: how narrow or full-range it sounds.",
      noise: "The volume of the record's surface noise.",
      wow_flut: "How much the pitch wavers, as from a record turning unevenly.",
    },
    notes: [
      "Unlike 303 VinylSim it lets you shape the playback tone with FREQ, but it has no compression.",
      "Try both vinyl sims on the same material: their noise and tone differ, and it's a matter of taste.",
      "There's no level control, so it sets the sound's level as it is.",
    ],
  },
  20: { // Cassette Sim
    summary:
      "Makes the sound feel like it's playing from a cassette: tone, hiss, age, tape saturation, wobble and the " +
      "dropouts of stretched tape.",
    params: {
      tone: "The overall tone of the tape playback.",
      hiss: "The volume of the tape hiss.",
      age: "How many years old the tape is: older tape sounds more worn and degraded.",
      drive: "How much the tape distorts.",
      wow_flut: "How much the pitch wavers as the tape plays.",
      catch: "How stretched the tape is, which adds catches and irregularities to the playback.",
    },
    notes: [
      "A good choice when you want a dirtier sound than the vinyl sims give, with more to adjust.",
      "Start with low HISS and WOW FLUT and add AGE and CATCH a little at a time: the effects build quickly.",
      "Other effects in the chain can make up for what it lacks, for example a filter for a narrower band.",
    ],
  },
  21: { // Lo-fi
    summary:
      "Degrades the sound for a lo-fi, crunchy character, with a filter before and after the degrading stage and a " +
      "dry/wet balance.",
    params: {
      pre_filt: "Picks one of six filters the sound passes through before it's degraded.",
      lofi_type: "How much the sound is degraded: higher numbers sound rougher.",
      tone: "Tilts the tone: positive values brighten the highs, negative values favour the lows.",
      cutoff: "The cutoff of the filter after the degrading stage. Lower values dull the result.",
      balance: "The mix of dry and degraded sound.",
      level: "The volume of the effect sound.",
    },
    notes: [
      "The manual doesn't say exactly what each LOFI TYPE does; it sounds like sample-rate and bit reduction, so go " +
        "by ear.",
      "It can get very loud: keep an eye on LEVEL.",
      "Use BALANCE to blend in just a little grit rather than replacing the sound entirely.",
    ],
  },
  22: { // Reverb
    summary:
      "A general-purpose reverb with ambience, room and two hall types, plus filters and pre-delay for the wet sound.",
    params: {
      type: "The kind of space: AMBI (ambience), ROOM, HALL1 or HALL2.",
      time: "How long the reverb tail lasts.",
      level: "The volume of the reverb. The dry sound always passes at full level.",
      low_cut: "Cuts the reverb's lows below this frequency, to keep it from muddying the bass. FLAT leaves them in.",
      high_cut: "Cuts the reverb's highs above this frequency, for a darker tail. FLAT leaves them in.",
      pre_delay: "A gap before the reverb starts, which keeps the attack of the dry sound clear.",
    },
    notes: [
      "There's no dry/wet balance, so it's less suited to fully washed-out pads than to placing a sound in a space.",
      "Raising LOW CUT keeps reverb on drums or bass from clouding the low end.",
      "A little pre-delay on vocals or snares keeps them upfront while the tail fills in behind.",
    ],
  },
  23: { // Chorus
    summary:
      "A chorus that thickens and widens the sound by mixing in slightly detuned, moving copies, with EQ on the " +
      "result.",
    params: {
      depth: "How strong the modulation is. Low values add gentle richness; high values sound wobbly and detuned.",
      rate: "The time of one modulation cycle: shorter times give a faster shimmer.",
      balance: "The mix of dry and chorused sound.",
      eq_low: "Boosts or cuts the low end.",
      eq_high: "Boosts or cuts the high end.",
      level: "The overall output volume.",
    },
    notes: [
      "A dependable way to fill out melodic parts and vocals, like a doubled performance.",
      "High DEPTH with a fast RATE goes from pleasant to alien: useful for sound design.",
      "Cutting a little low end keeps chorused bass parts from losing focus.",
    ],
  },
  24: { // JUNO Chorus
    summary:
      "A model of the chorus in Roland's JUNO-106 and JX synths: a lush, characterful stereo chorus with just a " +
      "few controls.",
    params: {
      mode:
        "Which chorus: modes 1, 2 and 12 model the JUNO's chorus settings, and the JX-1 modes model the JX's.",
      noise: "The volume of the hiss the original circuit made.",
      balance: "The mix of dry and chorused sound.",
    },
    notes: [
      "It sounds quite different from the stock Chorus; try both on the same part.",
      "BALANCE does a lot to its character: a partial mix often sounds richer than fully wet.",
      "A little NOISE adds vintage authenticity; turn it off for clean material.",
    ],
  },
};
