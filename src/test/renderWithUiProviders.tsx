import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { TaskMapMantineProvider } from "../ui/providers/TaskMapMantineProvider";

export function renderWithUiProviders(
  ui: ReactNode,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return render(ui, { ...options, wrapper: TaskMapMantineProvider });
}
