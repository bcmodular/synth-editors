// Set and patch file actions shared by the PATCH and SET blocks, the browser and slot menus. "Save as"
// asks for a name and a folder, starting at the folder selected in the library.
import { useCallback } from "react";
import { PATCH_EXT, SET_EXT, emptySlots, nameFromPath, patchToBytes, setFromJson, setToJson } from "../core/patchSet";
import type { Patch } from "../core/patch";
import { confirmed, useDialog } from "../ui/dialogs";
import { joinPath } from "./useLibrary";
import type { Session } from "./useSession";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isExists = (e: unknown) => message(e).includes("EXISTS:");

// folders: every folder in the library, "" for the library folder itself.
export function useSetActions(session: Session, folder: string, folders: string[], onError: (msg: string) => void) {
  const ask = useDialog();
  const files = window.tb3Files;

  // Write a new file, asking for its name and folder, and before replacing one with the same name.
  const writeNew = useCallback(
    async (title: string, initial: string, ext: string, data: Uint8Array | string): Promise<string | null> => {
      if (!files) return null;
      const r = await ask({
        title,
        input: initial,
        choice: {
          label: "FOLDER",
          options: folders.map((f) => ({ value: f, label: `/${f}` })),
          value: folders.includes(folder) ? folder : "",
        },
        buttons: ["SAVE"],
      });
      const name = r?.value;
      if (!name) return null;
      const path = joinPath(r.choice, name.endsWith(ext) ? name : name + ext);
      try {
        await files.write(path, data);
      } catch (e) {
        if (!isExists(e)) throw e;
        if (!(await confirmed(ask, "File exists", `Replace ${path}?`))) return null;
        await files.write(path, data, true);
      }
      return path;
    },
    [ask, files, folder, folders],
  );

  const guard = useCallback(
    <A extends unknown[]>(fn: (...a: A) => Promise<unknown>) =>
      (...a: A) => {
        fn(...a).catch((e: unknown) => onError(message(e)));
      },
    [onError],
  );

  const saveSetAs = useCallback(async () => {
    const s = session.state;
    const path = await writeNew(
      "Save set as",
      s.setPath ? nameFromPath(s.setPath) : "New set",
      SET_EXT,
      setToJson(s.slots),
    );
    if (path) session.markSaved(path);
    return Boolean(path);
  }, [session, writeNew]);

  const saveSet = useCallback(async () => {
    const s = session.state;
    if (!files || !s.setPath) return saveSetAs();
    await files.write(s.setPath, setToJson(s.slots), true);
    session.markSaved(s.setPath);
    return true;
  }, [files, saveSetAs, session]);

  // Before replacing the open set: Save / Discard / Cancel when it has unsaved changes.
  const okToLeave = useCallback(async () => {
    if (!session.dirty) return true;
    const r = await ask({
      title: "Unsaved set",
      message: "The open set has unsaved changes.",
      buttons: ["SAVE", "DISCARD"],
    });
    if (r?.button === "SAVE") return saveSet();
    return r?.button === "DISCARD";
  }, [ask, saveSet, session.dirty]);

  const openSet = useCallback(
    async (path: string) => {
      if (!files || !(await okToLeave())) return;
      const slots = setFromJson(new TextDecoder().decode(await files.read(path)));
      session.openSet(path, slots);
    },
    [files, okToLeave, session],
  );

  const newSet = useCallback(async () => {
    if (await okToLeave()) session.openSet(null, emptySlots());
  }, [okToLeave, session]);

  const savePatchAs = useCallback(
    (patch: Patch, name: string) => writeNew("Save patch as", name, PATCH_EXT, patchToBytes(patch)),
    [writeNew],
  );

  return {
    saveSet: guard(saveSet),
    saveSetAs: guard(saveSetAs),
    openSet: guard(openSet),
    newSet: guard(newSet),
    savePatchAs: guard(savePatchAs),
  };
}

export type SetActions = ReturnType<typeof useSetActions>;
