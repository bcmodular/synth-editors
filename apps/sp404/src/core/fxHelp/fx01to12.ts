// Help for effects 1–12. Our words; facts from the SP-404MK2 Reference Manual (MFX List), tips from NearTao's guide.
import type { FxHelp } from "./types";

export const FX_HELP_01_12: Readonly<Record<number, FxHelp>> = {
  1: { // Filter + Drive
    summary: "A low-pass or high-pass filter with overdrive in front of it, plus a low shelf. Grit the sound up, then " +
      "trim its top or bottom end.",
    params: {
      cutoff: "Where the filter starts cutting. With LPF, lower values darken the sound; with HPF, higher values thin it.",
      resonance: "Boosts a narrow band around the cutoff. Higher values give a sharper, more whistling peak.",
      drive: "How much distortion is added. Low values warm the sound up; high values crunch it.",
      filter_type: "LPF cuts the highs and keeps the lows; HPF cuts the lows and keeps the highs.",
      low_freq: "The frequency the LOW GAIN shelf works around.",
      low_gain: "Boosts or cuts the lows around LOW FREQ. Cut to stop drive making the bass muddy, or boost for weight.",
    },
    notes: [
      "One of the five front-panel effect buttons by default, so it's always to hand.",
      "Good on guitars and other melodic samples; on drums, use a little drive for character rather than a lot.",
      "There's no band-pass here. For one, open this filter fully and follow it with Super Filter in band-pass mode.",
    ],
  },
  2: { // Resonator
    summary: "Karplus-Strong string modelling: the input excites up to six tuned resonators, so whatever you feed it " +
      "rings out as plucked or bowed notes on a root and chord you choose.",
    params: {
      root: "The note the resonators are tuned to.",
      bright: "The tone of the ringing. Higher values are brighter and more metallic, lower values duller and softer.",
      feedback: "How long the resonators ring. Higher values sustain longer, towards a drone.",
      chord: "Which notes ring above the root: just the root, octaves, a fifth, or minor and major chords and sevenths.",
      panning: "Where the resonator sound sits in the stereo field.",
      env_mod: "Makes feedback follow the input level, so louder hits ring longer than quiet ones.",
    },
    notes: [
      "Drums and noisy, percussive material work best: each hit plucks the strings.",
      "Set ROOT and CHORD to the key of the track so the ringing fits the harmony.",
      "Keep FEEDBACK moderate on busy material, or the ringing builds into a wash.",
    ],
  },
  3: { // Sync Delay
    summary: "An echo locked to the tempo, with damping that thins out each repeat. It's the effect behind the DELAY " +
      "button.",
    params: {
      delay_time: "The echo time as a note value, from 1/32 to a whole bar, including triplets (T) and dotted (D) values.",
      feedback: "How many repeats you hear. Low values give one or two echoes; high values keep them going.",
      level: "The volume of the echoes. The dry sound stays as it is.",
      l_damp_f: "Thins the low end of each repeat below this frequency. FLAT leaves the lows alone.",
      h_damp_f: "Darkens each repeat by cutting above this frequency. FLAT leaves the highs alone.",
    },
    notes: [
      "The time follows the tempo, so the echoes stay in time as the BPM changes.",
      "Raise L DAMP and lower H DAMP so the repeats get thinner and darker, which keeps them out of the way of the mix.",
      "Dotted eighths (1/8D) and triplets give echoes that push against the beat rather than sit on it.",
    ],
  },
  4: { // Isolator
    summary: "A DJ-style three-band EQ that can boost each band a little or cut it out completely.",
    params: {
      low: "Boosts or cuts the low band. All the way down removes the bass entirely.",
      mid: "Boosts or cuts the middle band. All the way down removes the mids entirely.",
      high: "Boosts or cuts the high band. All the way down removes the highs entirely.",
    },
    notes: [
      "The band frequencies are fixed. For control over where the bands sit, use Equalizer instead.",
      "Quick for live moves: kill the bass before a drop and bring it back on the one.",
      "Cuts go much deeper than boosts, so think of it mainly as a tool for taking things away.",
    ],
  },
  5: { // DJFX Looper
    summary: "Catches a very short slice of the incoming sound and loops it, with control over playback speed and " +
      "direction, for turntable-style stutters and glitches.",
    params: {
      length: "How long the looped slice is. Shorter loops buzz and turn into a pitched tone; longer ones stutter.",
      speed: "Playback speed and direction. Positive plays forward, negative plays backward, and centre stops the loop.",
      on_off: "Turn on while a sound plays to catch and loop it; turn off to let the sound carry on as normal.",
    },
    notes: [
      "Use it for fills and transitions: catch a hit, sweep LENGTH or SPEED, then let go.",
      "Sweeping SPEED through zero gives a record-scratch slow-down and reverse.",
      "Easy to overdo. It works best in short bursts where the track needs a lift.",
    ],
  },
  6: { // Scatter
    summary: "Chops the sound into steps and plays them back rearranged, with changes of direction and gate length, " +
      "for a glitchy, digital groove.",
    params: {
      scatter_type: "One of ten patterns for how the steps are rearranged. Try each; they differ a lot.",
      scatter_depth: "How strongly the pattern alters the sound. Low values are subtle; high values break it up more.",
      on_off: "Switches the scatter on and off. Leave the effect loaded and use this to drop it in and out.",
      scatter_speed: "SINGLE or DOUBLE: DOUBLE runs the pattern twice as fast.",
    },
    notes: [
      "Like Slicer, but more gated and able to reverse slices, so it tends to sound glitchier.",
      "Set TYPE and DEPTH first, then flick ON/OFF in time with the music for fills.",
    ],
  },
  7: { // Downer
    summary: "Slows the playback down and back up again in a repeating cycle, with a resonant filter, for a dragging, " +
      "sinking feel.",
    params: {
      depth: "How far the playback slows down on each cycle.",
      rate: "How often the slow-down happens, as a note value from two bars down to 1/32.",
      filter: "Cuts high frequencies. Higher values darken the sound more.",
      pitch_on_off: "When on, the pitch is corrected back to normal, so you hear the timing drag without the pitch drop.",
      resonance: "Emphasises the filter. Higher values give a stronger, stranger ringing tone.",
    },
    notes: [
      "Good for a darker section of a track, or a breakdown that feels like it's running out of power.",
      "Faster RATE values add rhythmic wobble, and with RESONANCE up, ringing tones.",
      "Unlike most of effects 1–12, Downer can also be loaded on the input.",
    ],
  },
  8: { // Ha-Dou
    summary: "Builds a wave-like, reverberant sound from the input and adds it to the dry signal. Somewhere between " +
      "a modulated reverb and a resonator.",
    params: {
      mod_depth: "How much the effect sound wavers. Higher values give a deeper, more seasick movement.",
      time: "How long the effect sound lasts.",
      level: "The volume of the effect sound. The dry sound always stays at full level.",
      low_cut: "Cuts the effect sound below this frequency, to keep it from clouding the bass. FLAT cuts nothing.",
      high_cut: "Cuts the effect sound above this frequency, for a darker tail. FLAT cuts nothing.",
      pre_delay: "A short gap before the effect sound starts, which keeps the attack of the dry sound clear.",
    },
    notes: [
      "There's no fully wet setting: the original sound always plays alongside the effect.",
      "Best treated as a sound-design tool. Resample it and use the result rather than relying on it as a reverb.",
      "Use LOW CUT on bass-heavy material so the tail doesn't turn to mud.",
    ],
  },
  9: { // Ko-Da-Ma
    summary: "A tempo-synced echo with damping, somewhere between a delay and a reverb, for background texture.",
    params: {
      time: "The echo time as a note value, from 1/32 to a whole bar, including triplets (T) and dotted (D) values.",
      feedback: "How many times the echo repeats.",
      level: "How much of the sound is sent into the echo, which sets how loud the effect is.",
      l_damp_f: "Thins the low end of each repeat below this frequency. FLAT leaves the lows alone.",
      h_damp_f: "Darkens each repeat by cutting above this frequency. FLAT leaves the highs alone.",
      mode: "SINGLE keeps the echoes in the centre; PAN spreads them to the left and right.",
    },
    notes: [
      "Responds well to bass lines and drums; with higher feedback the repeats can start to form melodic lines of " +
        "their own.",
      "PAN mode gives a wider effect that leaves the centre free for the dry sound.",
    ],
  },
  10: { // Zan-Zou
    summary: "Delays the opposite-phase part of the left and right channels to leave a sonic afterimage: a ghostly, " +
      "wide echo. It only works on stereo material.",
    params: {
      time: "The delay time. With SYNC off it sets a free time; with SYNC on it's a note value locked to the tempo.",
      feedback: "How many times the afterimage repeats.",
      hf_damp: "Cuts the effect above this frequency. Lower values blur the afterimage; OFF keeps it sharp.",
      level: "The volume of the effect sound.",
      mode: "2TAP, 3TAP or 4TAP: how many taps make up the afterimage, and so how it lingers.",
      sync: "Off: TIME is set freely. On: TIME follows the tempo in note values.",
    },
    notes: [
      "A mono sample gives nothing, because the effect works on the difference between left and right.",
      "Adjust HF DAMP first; it makes the biggest difference to how the afterimage sits in the mix.",
      "Try it on pads for extra width and space, and resample the result.",
    ],
  },
  11: { // To-Gu-Ro
    summary: "Repeatedly slows the playback down, with the filter and volume following the speed, for an undulating, " +
      "coiling movement. Related to Downer.",
    params: {
      depth: "How far the playback slows down on each cycle.",
      rate: "How often the slow-down repeats. With SYNC off it's a free rate; with SYNC on it's a note value from two " +
        "bars down to 1/128.",
      resonance: "Emphasises the filter. Higher values give a stronger, stranger ringing tone.",
      flt_mod: "Cuts high frequencies as the playback slows, so the sound darkens as it drags.",
      amp_mod: "Lowers the volume as the playback slows, so the sound dips as it drags.",
      sync: "Off: RATE is set freely. On: RATE follows the tempo in note values.",
    },
    notes: [
      "The original sound keeps playing under the effect, so it adds movement rather than replacing the sound.",
      "With SYNC on, slow RATE values give a rhythmic sway; fast ones turn into a wobble.",
    ],
  },
  12: { // SBF
    summary: "A sideband filter: a comb of narrow bands that lets only certain frequencies through, giving a hollow, " +
      "ringing tone.",
    params: {
      interval: "The spacing between the bands. Higher values space them wider and move them up in frequency.",
      width: "How narrow each band is. Higher values make the bands narrower, so the sound rings and thins out more.",
      balance: "The mix of dry and effect sound, from fully dry to fully wet.",
      sbf_type: "SBF1 to SBF6: six variants that set the range the filter works over.",
      gain: "The volume of the effect sound.",
    },
    notes: [
      "BALANCE goes all the way to fully wet, which makes SBF more useful for sound design than most effects here.",
      "High WIDTH values bring out a resonant ring, from subtle to in-your-face. Lower GAIN if it gets harsh.",
      "Mix it in and out over a section to change the colour of a track.",
    ],
  },
};
