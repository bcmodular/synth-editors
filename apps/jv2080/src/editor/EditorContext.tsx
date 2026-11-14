// The patch being edited and how to change it, for every control in the editor.
import { createContext, useContext } from "react";
import type { Patch } from "../core/patch";
import type { ParamDef } from "../core/params";

export interface EditorApi {
  patch: Patch;
  setValue: (p: ParamDef, value: number, tone?: number) => void;
}

export const EditorContext = createContext<EditorApi | null>(null);

export function useEditor(): EditorApi {
  const api = useContext(EditorContext);
  if (!api) throw new Error("useEditor outside EditorContext");
  return api;
}
