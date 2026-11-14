import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Spike } from "./spike/Spike";
import "@fontsource-variable/archivo/wdth.css";
import "./styles.css";

// Phase 1 is the hardware spike; the editor replaces it in Phase 3.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Spike />
  </StrictMode>,
);
