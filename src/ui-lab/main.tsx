import React from "react";
import ReactDOM from "react-dom/client";
import "../index.css";
import { UiLabApp } from "./UiLabApp";
import "./uiLab.css";

ReactDOM.createRoot(document.getElementById("ui-lab-root") as HTMLElement).render(
  <React.StrictMode>
    <UiLabApp />
  </React.StrictMode>,
);
