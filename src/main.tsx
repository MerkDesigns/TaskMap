import React from "react";
import ReactDOM from "react-dom/client";
import AppShell from "./app/AppShell";
import "./index.css";
import { blockTabKeyNavigation } from "./ui/keyboard/blockTabKeyNavigation";
import { TaskMapMantineProvider } from "./ui/providers/TaskMapMantineProvider";

window.addEventListener("keydown", blockTabKeyNavigation, true);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TaskMapMantineProvider>
      <AppShell />
    </TaskMapMantineProvider>
  </React.StrictMode>,
);
