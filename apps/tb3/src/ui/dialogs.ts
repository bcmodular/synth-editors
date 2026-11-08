// Dialog and context-menu helpers, kept apart from the components in Dialog.tsx so that file
// exports only components and Vite Fast Refresh works on it.
import { createContext, useContext } from "react";
import { getZoom } from "./zoom";

export interface DialogSpec {
  title: string;
  message?: string;
  input?: string; // initial text: shows a text field
  choice?: { label: string; options: { value: string; label: string }[]; value: string }; // shows a menu
  buttons: string[]; // first is the default (Enter); Esc cancels
}

export type DialogResult = { button: string; value: string; choice: string } | null;
export type Ask = (d: DialogSpec) => Promise<DialogResult>;

export const DialogContext = createContext<Ask | null>(null);

export function useDialog(): Ask {
  const ask = useContext(DialogContext);
  if (!ask) throw new Error("useDialog outside DialogHost");
  return ask;
}

// Ask for a name; null when cancelled or left empty.
export async function askName(ask: Ask, title: string, initial = ""): Promise<string | null> {
  const r = await ask({ title, input: initial, buttons: ["OK"] });
  return r?.value ? r.value : null;
}

export async function confirmed(ask: Ask, title: string, message: string, button = "REPLACE"): Promise<boolean> {
  return (await ask({ title, message, buttons: [button] }))?.button === button;
}

export interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

// Opens at a contextmenu event's position. The menu renders inside the zoomed editor, so pointer
// coordinates are divided by the fit zoom.
export const menuAt = (e: { clientX: number; clientY: number }, items: MenuItem[]): MenuState => ({
  x: e.clientX / getZoom(),
  y: e.clientY / getZoom(),
  items,
});
