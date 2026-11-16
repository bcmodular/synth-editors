// Keys, pads, encoders, the pedal and pitch bend → the FX and the SP-404's notes, for whatever the keyboard is
// attached to (keyboard.ts). The same router serves the Launchkey and the on-screen keyboard.

import { effectById, paramMode, stepIndex, stepRaw } from "../core/fx";
import type { Bus } from "../core/fxTypes";
import type { MidiMessage } from "../core/midi";
import type { Fx } from "../fx/useFx";
import {
  keyAction, keysFx, padAction, PARAM, pressScalePad, scaleOf, scaleStep, type KeysFx, type KeysTarget,
  type ParamAction, type Scale,
} from "./keyboard";
import { Voices, type LaunchkeyEvent } from "./launchkey";

export type RouterFx = Pick<Fx, "state" | "setValue">;

export interface RouterDeps {
  fx: () => RouterFx; // the latest
  target: () => KeysTarget | undefined;
  play: (messages: MidiMessage[]) => void; // to the SP-404
}

const busOf = (t: KeysTarget | undefined): Bus | undefined => (t?.kind === "bus" ? t.bus : undefined);

export function targetFx(fx: RouterFx, t: KeysTarget | undefined): KeysFx | undefined {
  const bus = busOf(t);
  return bus === undefined ? undefined : keysFx(fx.state.buses[bus].fxId, bus);
}

// The Hyper-Reso or Vocoder scale the bus has now.
export function busScale(fx: RouterFx, bus: Bus | undefined): Scale {
  const b = bus === undefined ? undefined : fx.state.buses[bus];
  const p = b && effectById(b.fxId)?.params[PARAM.scale];
  const starts = p && paramMode(p).starts;
  return starts && p.key === "scale" ? scaleOf(stepIndex(starts, b.values[PARAM.scale] ?? 0)) : { root: 0, minor: false };
}

// The channel notes and the pedal go to, if the keyboard plays the SP-404.
function playChannel(fx: RouterFx, t: KeysTarget | undefined): number | undefined {
  const a = keyAction(t, targetFx(fx, t), 60);
  return a?.kind === "play" ? a.channel : undefined;
}

export class KeyRouter {
  readonly voices = new Voices();

  constructor(private readonly d: RouterDeps) {}

  // A key, from the Launchkey or the screen.
  key(note: number, velocity: number): void {
    const fx = this.d.fx();
    const t = this.d.target();
    const a = keyAction(t, targetFx(fx, t), note);
    if (a?.kind === "play") {
      this.d.play(velocity > 0 ? this.voices.on(a, velocity) : this.voices.off(a));
    } else if (a && velocity > 0) this.set(a);
  }

  pad(pad: number): void {
    const fx = this.d.fx();
    const t = this.d.target();
    const a = padAction(targetFx(fx, t), pad, busScale(fx, busOf(t)));
    if (a) this.set(a);
  }

  // A scale pad on screen (Hyper-Reso, Vocoder): a root, or major / minor.
  scale(pad: number): void {
    const fx = this.d.fx();
    const t = this.d.target();
    const kind = targetFx(fx, t);
    const next = kind === "hyperReso" || kind === "vocoder" ? pressScalePad(busScale(fx, busOf(t)), pad) : undefined;
    if (next) this.set({ kind: "param", index: PARAM.scale, step: scaleStep(next) });
  }

  // An encoder sets the attached bus's parameter in that slot, whatever the effect.
  encoder(slot: number, value: number): void {
    const bus = busOf(this.d.target());
    const fx = this.d.fx();
    if (bus !== undefined && slot < fx.state.buses[bus].values.length) fx.setValue(bus, slot, value);
  }

  event(e: LaunchkeyEvent): void {
    if (e.type === "key") return this.key(e.note, e.velocity);
    if (e.type === "pad") return this.pad(e.pad);
    if (e.type === "encoder") return this.encoder(e.slot, e.value);
    const channel = playChannel(this.d.fx(), this.d.target());
    if (channel === undefined) return;
    if (e.type === "sustain") this.d.play(this.voices.pedal(e.down, channel));
    else this.d.play([[0xe0 | channel, e.lsb, e.msb]]);
  }

  // Attached elsewhere: nothing is left sounding.
  release(): void {
    this.d.play(this.voices.flush());
  }

  private set(a: ParamAction) {
    const bus = busOf(this.d.target());
    const fx = this.d.fx();
    const p = bus === undefined ? undefined : effectById(fx.state.buses[bus].fxId)?.params[a.index];
    if (bus === undefined || !p) return;
    const starts = paramMode(p).starts;
    const raw = a.step !== undefined && starts ? stepRaw(starts, a.step) : a.raw;
    if (raw !== undefined) fx.setValue(bus, a.index, Math.max(0, Math.min(127, raw)));
  }
}
