import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { taskMapMantineTheme } from "./taskMapMantineTheme";

export interface TaskMapMantineProviderProps {
  readonly children: ReactNode;
}

export function TaskMapMantineProvider({ children }: TaskMapMantineProviderProps) {
  return (
    <MantineProvider defaultColorScheme="dark" theme={taskMapMantineTheme}>
      {children}
    </MantineProvider>
  );
}
