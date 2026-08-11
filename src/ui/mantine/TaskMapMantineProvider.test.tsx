import { render, screen } from "@testing-library/react";
import { useMantineColorScheme, useMantineTheme } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { TaskMapMantineProvider } from "./TaskMapMantineProvider";

function ThemeProbe() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

  return (
    <output>
      {theme.fontFamily}|{theme.fontSizes.sm}|{theme.defaultRadius}|{colorScheme}
    </output>
  );
}

describe("TaskMapMantineProvider", () => {
  it("provides the renderer-v2 font, sizing, radius, and dark scheme foundation", () => {
    render(
      <TaskMapMantineProvider>
        <ThemeProbe />
      </TaskMapMantineProvider>,
    );

    expect(screen.getByText(/Segoe UI.*\|0\.875rem\|md\|dark/)).toBeInTheDocument();
  });
});
