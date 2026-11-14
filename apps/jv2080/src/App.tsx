// One MIDI link shared by the editor and the hardware spike, which stays available for checking the JV.
import { useState } from "react";
import { Editor } from "./editor/Editor";
import { useJvLink } from "./link/useJvLink";
import { Spike } from "./spike/Spike";

export function App() {
  const link = useJvLink();
  const [spike, setSpike] = useState(false);
  if (!spike) return <Editor link={link} onSpike={() => setSpike(true)} />;
  return (
    <>
      <button className="btn back" onClick={() => setSpike(false)}>‹ EDITOR</button>
      <Spike link={link} />
    </>
  );
}
