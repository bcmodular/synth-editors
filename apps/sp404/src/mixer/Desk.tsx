// The desk: the banks picked in SHOW BANKS, each its loaded pads' strips and a bank master. Scrolls sideways
// when more than two banks are shown.

import { useState } from "react";
import type { PadMidiSettings } from "../core/padNotes";
import { selectedPadNumber, soundingPad } from "../core/serialMessages";
import { ChannelFader } from "../ui/controls";
import { AhrEditor } from "./AhrEditor";
import { BANK_LETTERS, bankColourOf, bankOf } from "./banks";
import type { BankView, DeskPad } from "./mixerState";
import { MuteSolo } from "./MuteSolo";
import type { PadActivity } from "./padHits";
import { Strip } from "./Strip";
import type { Mixer } from "./useMixer";

interface BankMasterProps {
  bank: number;
  view: BankView;
  onChange: (volume: number) => void;
  onMute: () => void;
  onSolo: () => void;
}

// Laid out on the pad strips' rows (styles.css, .ws), so MUTE and the fader line up with theirs.
function BankMaster({ bank, view, onChange, onMute, onSolo }: BankMasterProps) {
  const name = `BANK ${BANK_LETTERS[bank]}`;
  return (
    <div className="ws master" data-bank-master={BANK_LETTERS[bank]}>
      <div className="wtop"><span className="wpad master">{name}</span></div>
      <div className="nm1 master">BANK VOL</div>
      <MuteSolo name={name} mute={view.mute} solo={view.solo} onMute={onMute} onSolo={onSolo} />
      <ChannelFader value={view.volume} color="#fff" dim={view.silent} label={`${name} volume`} onChange={onChange} />
      <div className="lv master">{view.silent ? `(${view.volume})` : view.volume}</div>
    </div>
  );
}

const NO_BANK: BankView = { volume: 127, silent: false, mute: false, solo: false };

export interface DeskProps {
  mixer: Mixer;
  banks: readonly number[];
  midi: PadMidiSettings;
  activity: PadActivity; // hit counts (a change flashes the pad's number) and the pads held
}

export function Desk({ mixer, banks, midi, activity }: DeskProps) {
  const [editing, setEditing] = useState<number>();
  const editingPad = mixer.pads.find((p) => p.pad === editing);
  const selected = mixer.status ? selectedPadNumber(mixer.status) : undefined;
  const sounding = mixer.status ? soundingPad(mixer.status) : undefined;
  const padsOf = (bank: number): DeskPad[] => mixer.pads.filter((p) => bankOf(p.pad) === bank);
  return (
    <div className="wdesk">
      {banks.map((bank) => (
        <div className="wbank" key={bank} data-bank={BANK_LETTERS[bank]}>
          <div className="btitle" style={{ background: bankColourOf(bank) }}>BANK {BANK_LETTERS[bank]}</div>
          <div className="row">
            {padsOf(bank).map((p) => (
              <Strip key={p.pad} pad={p} midi={midi} selected={p.pad === selected} playing={p.pad === sounding}
                hitSeq={activity.hits[p.pad]} held={activity.held.includes(p.pad)} onValue={mixer.setValue} onMute={mixer.mute} onSolo={mixer.solo} onEditAhr={setEditing} />
            ))}
            <BankMaster bank={bank} view={mixer.banks[bank] ?? NO_BANK}
              onChange={(v) => mixer.setBankVolume(bank, v)} onMute={() => mixer.muteBank(bank)}
              onSolo={() => mixer.soloBank(bank)} />
          </div>
        </div>
      ))}
      {editingPad && <AhrEditor pad={editingPad} onValue={mixer.setValue} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
