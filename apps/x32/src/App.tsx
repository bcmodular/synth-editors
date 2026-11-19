// X32 chat control (docs/x32-spec.md). Phase 0: the connection to the desk. The Rig panel (phase 1), sends (phase 2)
// and chat (phase 3) come next.

import { DeskPanel } from "./desk/DeskPanel";
import { useDesk } from "./desk/useDesk";

export function App() {
  const desk = useDesk();
  return (
    <main>
      <DeskPanel desk={desk} />
    </main>
  );
}
