// The SP-404 MK2 editor. The Phase 0 spike stays reachable at #spike for capturing device traffic.

import { Editor } from "./Editor";
import { Spike } from "./spike/Spike";

export function App() {
  return location.hash === "#spike" ? <Spike /> : <Editor />;
}
