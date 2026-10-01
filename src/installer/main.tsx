import React from "react";
import ReactDOM from "react-dom/client";
import { createTauriInstallerClient } from "../platform/installer/installerClient";
import { InstallerApp } from "./InstallerApp";
import { createPreviewInstallerClient } from "./previewInstallerClient";

// The Vite dev server alone (no Tauri) previews the UI with a simulated client; in development,
// `?preview` does the same inside the Tauri window (e.g. to see the welcome screen on a machine
// where TaskMap is installed).
const preview =
  import.meta.env.DEV &&
  (!("__TAURI_INTERNALS__" in window) ||
    new URLSearchParams(window.location.search).has("preview"));
const client = preview ? createPreviewInstallerClient() : createTauriInstallerClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <InstallerApp client={client} />
  </React.StrictMode>,
);
