import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TaskMapMantineProvider } from "../../mantine/TaskMapMantineProvider";
import {
  createTestElement,
  DevelopmentRefractionTestLayer,
} from "./DevelopmentRefractionTestLayer";

afterEach(cleanup);

describe("DevelopmentRefractionTestLayer", () => {
  it("adds deterministic ordinary DOM elements to the active canvas", async () => {
    const user = userEvent.setup();
    render(
      <TaskMapMantineProvider>
        <DevelopmentRefractionTestLayer activeCanvasId="canvas-a" />
      </TaskMapMantineProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Add test element" }));
    await user.click(screen.getByRole("button", { name: "Add test element" }));

    expect(screen.getAllByTestId("refraction-test-element")).toHaveLength(2);
    expect(screen.getByText("Refraction sample 1")).toBeInTheDocument();
  });

  it("keeps each canvas test set separate", async () => {
    const user = userEvent.setup();
    const view = render(
      <TaskMapMantineProvider>
        <DevelopmentRefractionTestLayer activeCanvasId="canvas-a" />
      </TaskMapMantineProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Add test element" }));

    view.rerender(
      <TaskMapMantineProvider>
        <DevelopmentRefractionTestLayer activeCanvasId="canvas-b" />
      </TaskMapMantineProvider>,
    );
    expect(screen.queryByTestId("refraction-test-element")).not.toBeInTheDocument();

    view.rerender(
      <TaskMapMantineProvider>
        <DevelopmentRefractionTestLayer activeCanvasId="canvas-a" />
      </TaskMapMantineProvider>,
    );
    expect(screen.getByTestId("refraction-test-element")).toBeInTheDocument();
  });

  it("uses predictable placement", () => {
    expect(createTestElement(1)).toMatchObject({ x: 120, y: 30 });
    expect(createTestElement(5)).toMatchObject({ x: 120, y: 220 });
  });
});
