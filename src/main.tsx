import React from "react";
import ReactDOM from "react-dom/client";
import "@mantine/core/styles.css";
import AppShell from "./app/AppShell";
import { TaskMapMantineProvider } from "./ui/mantine/TaskMapMantineProvider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TaskMapMantineProvider>
      <AppShell />
    </TaskMapMantineProvider>
  </React.StrictMode>,
);
