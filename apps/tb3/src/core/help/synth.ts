// Help for the synth sections: oscillators, cross and ring modulation, filter, amplifier, LFO, distortion, and the
// top strip's PERFORM and PORTA · BEND. Facts from Roland's TB-3 Owner's Manual and Dope Robot's unofficial
// SysEx and parameter guides; the wording is ours.
import type { SectionHelp } from "./types";

export const OSCILLATORS_HELP: SectionHelp = {
  voice: "osc",
  title: "Oscillators",
  summary:
    "The TB-3's sound sources, mixed: a saw and a square (the TB-303's two waves), a sine, white and pink noise, " +
    "and the ring modulator's output. The picture shows the mix they make; LIVE shows what the TB-3 is really playing.",
  rows: [
    { label: "SAW", ids: ["vco_saw_level", "vco_saw_sw"], text: "The saw wave: bright and buzzy, the classic acid bass." },
    { label: "SQR", ids: ["vco_sqr_level", "vco_sqr_sw"], text: "The square wave: hollower and woodier than the saw." },
    { label: "SIN", ids: ["vco_sin_level", "vco_sin_sw"], text: "A sine: pure low end with no harmonics, for weight under the other waves." },
    { label: "WHITE", ids: ["vco_white_level", "vco_wh_noise_sw"], text: "White noise: an even hiss across all frequencies, for breath and grit." },
    { label: "PINK", ids: ["vco_pink_level", "vco_pk_noise_sw"], text: "Pink noise: darker than white, with more low end." },
    { label: "RING", ids: ["vco_ring_level", "vco_ring_sw"], text: "The ring modulator's output (see RING MODULATION): clangy, metallic tones." },
    { label: "SAW tuning", ids: ["saw_tuning"], text: "Moves the saw's pitch against the others, for detuned and interval sounds." },
    { label: "SQR tuning", ids: ["sqr_tuning"], text: "The same for the square." },
    { label: "RING+SIN tuning", ids: ["ring_sin_tuning"], text: "The same for the sine and the ring oscillator." },
  ],
  notes: [
    "Each source's button switches it on or off without losing its level; a switched-off source's knob is dimmed.",
    "A little detune between the saw and square (a few steps either way) thickens a bass; a fifth or an octave makes an interval.",
    "The TB-3's front panel can't edit any of this: the editor reaches it over SysEx.",
  ],
};

export const CROSS_MOD_HELP: SectionHelp = {
  voice: "xmod",
  title: "Cross modulation",
  summary:
    "One source modulating another's frequency: the square, the saw and the two noises can each push the saw (left " +
    "group) and the square (right group), up or down. The cords show which paths are in use, in the section's colour " +
    "for positive amounts and amber for negative ones.",
  rows: [
    { label: "→ SAW", ids: ["cm_sqr_saw", "cm_saw_saw", "cm_white_saw", "cm_pink_saw"], text: "How much each source modulates the saw. SAW → SAW is the saw modulating itself." },
    { label: "→ SQR", ids: ["cm_sqr_sqr", "cm_saw_sqr", "cm_white_sqr", "cm_pink_sqr"], text: "How much each source modulates the square. SQR → SQR is the square modulating itself." },
  ],
  notes: [
    "Small amounts add bite and movement; large ones turn the waves into harsh, inharmonic FM tones.",
    "Noise as the source roughens a wave into a gritty, unstable tone: good for percussive and effect sounds.",
    "Detune the destination (OSCILLATORS › TUNING) to change the character of the modulation.",
  ],
};

export const RING_MOD_HELP: SectionHelp = {
  voice: "ring",
  title: "Ring modulation",
  summary:
    "The ring modulator multiplies its inputs together, giving the sums and differences of their frequencies: bell, " +
    "metal and robot tones. Here you choose how much of each source goes in; turn up RING in OSCILLATORS to hear it.",
  rows: [
    { label: "SAW", ids: ["rm_saw_depth"], text: "How much of the saw goes into the ring modulator." },
    { label: "SQR", ids: ["rm_sqr_depth"], text: "How much of the square goes in." },
    { label: "RING", ids: ["rm_ring_depth"], text: "How much of the ring oscillator (tuned with RING+SIN) goes in." },
    { label: "WHITE", ids: ["rm_white_depth"], text: "How much white noise goes in: noisy, gated textures." },
    { label: "PINK", ids: ["rm_pink_depth"], text: "How much pink noise goes in." },
    { label: "DEPTH", ids: ["rm_depth"], text: "The ring modulator's overall amount." },
  ],
  notes: [
    "Retune RING+SIN against the saw or square for different metallic tones; simple intervals (an octave, a fifth) sound more musical.",
    "Nothing is heard from the ring modulator unless OSCILLATORS › RING is on and turned up.",
  ],
};

export const FILTER_HELP: SectionHelp = {
  voice: "vcf",
  title: "Filter",
  summary:
    "The VCF: a resonant low-pass filter, modelled on the TB-303's (Roland gives it 18 dB per octave), that gives the TB-3 its acid " +
    "squelch. Its envelope sweeps the cutoff on every note.",
  rows: [
    { label: "CUTOFF", ids: ["vcf_cutoff"], text: "Where the filter starts cutting the highs: lower is darker. The front panel's CUTOFF knob." },
    { label: "RESONANCE", ids: ["vcf_resonance"], text: "A peak at the cutoff: higher is more vocal and squelchy, whistling at the top. The front panel's RESONANCE knob." },
    { label: "ENV DEPTH", ids: ["vcf_env_depth"], text: "How far the envelope sweeps the cutoff on each note: the front panel's ENV MOD (the pad's x-axis in ENV MOD mode)." },
    { label: "KEY FOLLOW", ids: ["vcf_key_follow"], text: "How much the cutoff follows the note's pitch, so higher notes stay as bright as low ones." },
    { label: "ENVELOPE", ids: ["vcf_attack", "vcf_decay", "vcf_sustain", "vcf_release"], text: "The filter envelope: attack, decay, sustain and release. Decay is the front panel's ENV MOD pad y-axis. Drag the graph's handles or turn the knobs under it." },
  ],
  notes: [
    "The classic acid line: cutoff low, resonance high, plenty of ENV DEPTH and a short decay, with accents and slides in the pattern.",
    "High resonance with a low cutoff boosts the bass; turn RESONANCE down for a rounder, plainer bass.",
    "The front panel only reaches the filter envelope's decay; here you have all four stages.",
  ],
};

export const AMP_HELP: SectionHelp = {
  voice: "vca",
  title: "Amplifier",
  summary: "The VCA: how each note's level rises and falls, and the patch's overall volume.",
  rows: [
    { label: "ENVELOPE", ids: ["vca_attack", "vca_decay", "vca_sustain", "vca_release"], text: "The amp envelope: attack, decay, sustain and release. Drag the graph's handles or turn the knobs under it." },
    { label: "VOLUME", ids: ["master_volume"], text: "The patch's level, to balance it against others in a set." },
  ],
  notes: [
    "A 303-style bass wants an instant attack, full sustain and a short release; let the filter envelope shape each note.",
    "A slower attack and longer release turn a bass patch into a pad or drone.",
  ],
};

export const LFO_HELP: SectionHelp = {
  voice: "lfo",
  title: "LFO",
  summary:
    "A low-frequency oscillator for vibrato, wah and tremolo: a mix of five waves that moves the oscillators' pitch, " +
    "the filter's cutoff and the level. The picture shows the shape the mix makes.",
  rows: [
    { label: "SAW · SQR · TRI · SIN · S&H", ids: ["lfo_saw", "lfo_sqr", "lfo_tri", "lfo_sin", "lfo_sh"], text: "How much of each wave is in the mix. S&H (sample and hold) gives random steps." },
    { label: "RATE", ids: ["lfo_rate"], text: "How fast the LFO runs; with BPM SYNC on it follows the tempo instead." },
    { label: "DELAY", ids: ["lfo_delay"], text: "How long after each note the LFO takes to fade in, for delayed vibrato." },
    { label: "CV OFFSET", ids: ["lfo_cv_offset"], text: "Shifts the whole LFO up or down, so it pushes more one way than the other." },
    { label: "→ VCO", ids: ["vco_lfo_depth"], text: "How much the LFO moves the pitch: vibrato, or sirens at high amounts. Either way." },
    { label: "→ VCF", ids: ["vcf_lfo_depth"], text: "How much it moves the filter cutoff: a wah or wobble." },
    { label: "→ VCA", ids: ["vca_lfo_depth"], text: "How much it moves the level: tremolo." },
    { label: "BPM SYNC", ids: ["lfo_bpm_sync"], text: "Locks the LFO's rate to the tempo." },
    { label: "RETRIG", ids: ["lfo_retrigger"], text: "Restarts the LFO on each note, so every note moves the same way." },
  ],
  notes: [
    "The effects' own tempo sync (tremolo, chorus, flanger, phaser) runs freely and can drift against the pattern; the LFO with RETRIG on keeps time more tightly.",
    "Some factory sounds carry modulation that can't be changed from the front panel; this section shows and edits it.",
  ],
};

export const DIST_HELP: SectionHelp = {
  voice: "dist",
  title: "Distortion",
  summary:
    "Drive and distortion before the effects: 25 types, from clean boosts through overdrives and distortions to amp " +
    "stacks and fuzzes, many after well-known pedals and amps.",
  rows: [
    { label: "ON", ids: ["dist_sw"], text: "Switches the distortion in." },
    { label: "TYPE", ids: ["dist_type"], text: "Which distortion: step through with ‹ ›, scroll, or click the name to see them grouped by family." },
    { label: "COLOR", ids: ["dist_color"], text: "Brightens the distortion, seemingly by adding harmonics at two and three times the note." },
    { label: "DRIVE", ids: ["dist_drive"], text: "How hard the signal is pushed: more is dirtier and more compressed." },
    { label: "BOTTOM", ids: ["dist_bottom"], text: "Low end: left cuts it (tighter), right boosts it." },
    { label: "TONE", ids: ["dist_tone"], text: "High end: left darker, right brighter." },
    { label: "EFX LVL", ids: ["dist_efx_level"], text: "The distorted signal's level." },
    { label: "DRY LVL", ids: ["dist_dry_level"], text: "The clean signal's level, mixed with the distorted one to keep the bass's body." },
  ],
  notes: [
    "Boosts and overdrives keep the notes clear; distortions and fuzzes flatten dynamics and add sustain.",
    "Some DRY LVL under a heavy type keeps the low end solid; BOTTOM left stops it getting muddy.",
  ],
};

export const PERFORM_HELP: SectionHelp = {
  title: "Perform",
  summary: "How accented steps play, and the TB-3's overall tuning.",
  rows: [
    { label: "ACCENT", ids: ["accent"], text: "How much louder and brighter accented steps are: the front panel's ACCENT knob. Notes from a MIDI keyboard accent at velocities over 100." },
  ],
  notes: [
    "GLOBAL TUNE moves the whole TB-3 up to seven semitones either way, in tenths. It isn't part of the patch: the editor sends it on its own (as the front panel's ENV MOD + pad does).",
  ],
};

export const PORTA_HELP: SectionHelp = {
  title: "Portamento and bend",
  summary: "Gliding between notes as you play, and how far pitch bend reaches. (A pattern's slides are separate, set per step.)",
  rows: [
    { label: "PORTA", ids: ["porta_sw"], text: "Switches portamento on." },
    { label: "LEGATO · ALWAYS", ids: ["porta_mode"], text: "LEGATO glides only between overlapping (legato) notes; ALWAYS glides into every note." },
    { label: "TIME", ids: ["porta_time"], text: "How long the glide takes." },
    { label: "BEND", ids: ["bender_range"], text: "How far a MIDI pitch bend moves the pitch, in semitones either way." },
  ],
  notes: [],
};
