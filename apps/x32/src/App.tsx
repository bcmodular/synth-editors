// X32 chat control (docs/x32-spec.md). Phase 1: the connection to the desk and the rig worked out from it. Sends
// (phase 2) and chat (phase 3) come next.

import { DeskPanel } from "./desk/DeskPanel";
import { useDesk } from "./desk/useDesk";
import { RigPanel } from "./rig/RigPanel";
import { useRig } from "./rig/useRig";

export function App() {
  const desk = useDesk();
  const rig = useRig(desk.cache);
  return (
    <main>
      <DeskPanel desk={desk} />
      <RigPanel rig={rig} />
    </main>
  );
}
