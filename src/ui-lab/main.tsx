import React from "react";
import ReactDOM from "react-dom/client";
import "../index.css";
import { blockTabKeyNavigation } from "../ui/keyboard/blockTabKeyNavigation";
import { UiLabApp } from "./UiLabApp";
import "./uiLab.css";

window.addEventListener("keydown", blockTabKeyNavigation, true);

ReactDOM.createRoot(document.getElementById("ui-lab-root") as HTMLElement).render(
  <React.StrictMode>
    <UiLabApp />
  </React.StrictMode>,
);
