import { MantineProvider, type MantineColorSchemeManager } from "@mantine/core";
import type { ReactNode } from "react";
import "@mantine/core/styles/Input.css";
import "@mantine/core/styles/Combobox.css";
import "@mantine/core/styles/Popover.css";
import "@mantine/core/styles/ScrollArea.css";
import "@mantine/core/styles/Slider.css";
import "@mantine/core/styles/Tooltip.css";

export interface TaskMapMantineProviderProps {
  readonly children: ReactNode;
}

const taskMapColorSchemeManager: MantineColorSchemeManager = {
  get: () => "dark",
  set: () => {},
  subscribe: () => {},
  unsubscribe: () => {},
  clear: () => {},
};

export function TaskMapMantineProvider({ children }: TaskMapMantineProviderProps) {
  return (
    <MantineProvider
      colorSchemeManager={taskMapColorSchemeManager}
      forceColorScheme="dark"
      getRootElement={() => undefined}
      deduplicateCssVariables={false}
      withGlobalClasses={false}
      env={import.meta.env.MODE === "test" ? "test" : "default"}
    >
      {children}
    </MantineProvider>
  );
}
