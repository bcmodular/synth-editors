// Colours shared by the mixer and the sections they stand for. Section tints are also in styles.css (.efx, .chorus,
// .reverb); the tone colours are kept clear of them.

export const TONE_COLOURS = ["#e6c27a", "#f0a070", "#e6a3c4", "#c9a3e6"];

export const SECTION_COLOURS = { efx: "#a8b8ff", chorus: "#8fdcc4", reverb: "#7fc4ea" };

export const MASTER_COLOUR = "#7be890";

export const PAN_COLOUR = "#ff5a4a";

// CSS variables that recolour a section and the controls in it (headings, fader fills, selected buttons, LEDs).
export function tintVars(colour: string): Record<string, string> {
  return {
    "--tint": colour,
    "--led": colour,
    "--led-off": `color-mix(in srgb, ${colour} 35%, #111)`,
    "--sel-bg": `color-mix(in srgb, ${colour} 16%, #0b0b0c)`,
  };
}
