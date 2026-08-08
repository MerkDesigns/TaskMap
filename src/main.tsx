import React from "react";
import ReactDOM from "react-dom/client";
import AppShell from "./app/AppShell";
import "./index.css";

/* B2 bundle proof only: this creates no runtime or Worker; B3 owns production activation. */
void import("./ui/materials/compositor/browserAcrylicRuntime");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
