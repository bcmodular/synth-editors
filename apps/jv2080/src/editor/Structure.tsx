// How each pair of tones combines (Structure 1&2, 3&4) and the booster's gain, from a chip in the header of the pair's
// first tone (tone 1 or 3). Each type is described in our words from the manual (p. 74–76).

import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { PopoverButton } from "../ui/Popover";
import { useEditor } from "./EditorContext";
import { ParamChoice } from "./ParamControls";

// [first, second] tone of the pair, numbered from 1.
type Pair = 0 | 1;

const pairOf = (pair: Pair) => (pair === 0 ? { ids: ["structure12", "booster12"], a: 1, b: 2 } : { ids: ["structure34", "booster34"], a: 3, b: 4 });

function structureText(type: number, a: number, b: number): string {
  const lead = `Tone ${a}'s amp sets the balance`;
  return [
    `Tones ${a} and ${b} play side by side, each through its own filter and amp.`,
    `The two filters in series, for a steeper, more pronounced filter. ${lead} between the two tones.`,
    `Tones ${a} and ${b} mixed, through one filter, then the booster to distort them.`,
    `The booster distorts, then the two filters in series. ${lead}, and so how much booster you hear.`,
    `A ring modulator multiplies the two waves into new, metallic overtones, then the filters in series. ${lead}, and so how much ring modulation you hear.`,
    `Ring modulation with tone ${b} mixed back in, then the filters in series. ${lead}, and so how much of the ring-modulated sound you hear.`,
    `Each tone through its own filter, then both into the ring modulator.`,
    `Each tone filtered, ring-modulated, then tone ${b} mixed back in and filtered again.`,
    `Each tone filtered, then ring-modulated. ${lead}, and so the depth of the ring modulation.`,
    `Each tone filtered, ring-modulated, with tone ${b} mixed back in. ${lead}, and so how much of the ring-modulated sound you hear.`,
  ][type] ?? "";
}

const USES_BOOSTER = [2, 3]; // raw types 3 and 4

function StructurePanel({ pair }: { pair: Pair }) {
  const { patch } = useEditor();
  const { ids, a, b } = pairOf(pair);
  const type = getParam(patch, param(ids[0]!));
  return (
    <>
      <ParamChoice def={ids[0]!} label="Type" />
      <p className="pop-note struct-note">{structureText(type, a, b)}</p>
      <div className={USES_BOOSTER.includes(type) ? "" : "off"}>
        <ParamChoice def={ids[1]!} label="Booster" />
      </div>
      <p className="pop-note">
        The booster (types 3 and 4) distorts the signal; turning up the wave gain drives it harder. With either tone
        of the pair switched off, the other plays as type 1, whatever the setting.
      </p>
    </>
  );
}

// The chip in tone 1's and tone 3's header: the pair's structure type, opening its settings.
export function StructureButton({ tone }: { tone: number }) {
  const { patch } = useEditor();
  if (tone !== 0 && tone !== 2) return null;
  const pair: Pair = tone === 0 ? 0 : 1;
  const { ids, a, b } = pairOf(pair);
  const type = getParam(patch, param(ids[0]!)) + 1;
  return (
    <PopoverButton label={`${a}&${b}: TYPE ${type}`} title={`Structure of tones ${a} and ${b}`} className="struct-btn">
      <StructurePanel pair={pair} />
    </PopoverButton>
  );
}
