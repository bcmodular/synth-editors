// Dev only (`?demo`): a made-up patch so the layout can be checked without a TB-3 attached.
import { setEfxRaw, setEfxType, setRaw } from "../core/patch";
import type { Patch } from "../core/patch";
import { paramById } from "../core/params";
import { PATCH_BLOCKS, addrKey } from "../core/sysex";

const VALUES: Record<string, number> = {
  lfo_rate: 40, lfo_tri: 38, lfo_sin: 127, lfo_delay: 20, lfo_bpm_sync: 1,
  vco_lfo_depth: 64, vcf_lfo_depth: 80, vca_lfo_depth: 64,
  saw_tuning: 127, sqr_tuning: 115, ring_sin_tuning: 127,
  cm_sqr_saw: 74, cm_saw_saw: 64, cm_white_saw: 64, cm_pink_saw: 64,
  cm_sqr_sqr: 64, cm_saw_sqr: 64, cm_white_sqr: 40, cm_pink_sqr: 64,
  rm_saw_depth: 127, rm_depth: 127,
  vco_saw_level: 127, vco_sqr_level: 95, vco_sin_level: 3, vco_white_level: 127, vco_pink_level: 127,
  vco_ring_level: 127, vco_saw_sw: 1, vco_sqr_sw: 1, vco_sin_sw: 1,
  vcf_cutoff: 118, vcf_resonance: 146, vcf_env_depth: 179, vcf_attack: 13, vcf_decay: 80, vcf_sustain: 25,
  vcf_release: 6, vcf_key_follow: 50,
  vca_sustain: 127, master_volume: 78,
  dist_sw: 1, dist_type: 4, dist_drive: 99, dist_bottom: 50, dist_tone: 50, dist_efx_level: 66, dist_dry_level: 50,
  porta_mode: 0, porta_time: 0, bender_range: 23, accent: 180,
  assign_xy_mod: 54, assign_pad_x: 69, assign_pad_y: 37, assign_effect_knob: 72,
};

export function demoPatch(): Patch {
  const blocks: Patch["blocks"] = {};
  for (const b of PATCH_BLOCKS) blocks[addrKey(b.addr)] = Array.from({ length: b.size }, () => 0);
  let p: Patch = { blocks };
  for (const [id, v] of Object.entries(VALUES)) p = setRaw(p, paramById(id), v);
  p = setEfxType(p, 1, 4); // TREMOLO
  for (const [o, v] of [[0x18, 1], [0x1c, 13], [0x1e, 42], [0x19, 4], [0x20, 100], [0x1f, 1], [0x1d, 100]]) {
    p = setEfxRaw(p, 1, o!, v!);
  }
  p = setEfxType(p, 2, 8); // DELAY
  for (const [o, v] of [[0x3e, 1], [0x42, 10], [0x41, 50], [0x43, 15], [0x44, 8], [0x45, 95], [0x46, 100], [0x3f, 1]]) {
    p = setEfxRaw(p, 2, o!, v!);
  }
  return p;
}
