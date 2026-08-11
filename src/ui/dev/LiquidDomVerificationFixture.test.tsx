import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TaskMapMantineProvider } from "../mantine/TaskMapMantineProvider";
import { LiquidDomVerificationFixture } from "./LiquidDomVerificationFixture";

afterEach(cleanup);

describe("LiquidDomVerificationFixture", () => {
  it("keeps the proof usable through the non-WebGPU fallback", () => {
    const { container } = render(
      <TaskMapMantineProvider>
        <LiquidDomVerificationFixture />
      </TaskMapMantineProvider>,
    );

    expect(screen.getByTestId("liquid-dom-backdrop")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mantine content inside glass" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save proof" })).toBeEnabled();
    expect(container.querySelector('[data-liquid-material-role="large-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-liquid-material-role="small-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-liquid-dom-state="fallback"]')).not.toBeNull();
  });

  it("provides visible feedback for controls inside the material surfaces", () => {
    render(
      <TaskMapMantineProvider>
        <LiquidDomVerificationFixture />
      </TaskMapMantineProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save proof" }));
    expect(screen.getByRole("button", { name: "Save proof (1)" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Open canvas" }));
    expect(screen.getByText("Opened: Renderer V2")).toBeVisible();
  });

  it("pans and zooms the ordinary DOM backdrop without React state updates", () => {
    render(
      <TaskMapMantineProvider>
        <LiquidDomVerificationFixture />
      </TaskMapMantineProvider>,
    );

    const backdrop = screen.getByTestId("liquid-dom-backdrop");
    const world = screen.getByTestId("liquid-dom-world");
    const pointerDown = new MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 20,
      clientY: 30,
    });
    const pointerMove = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 70,
      clientY: 90,
    });
    Object.defineProperty(pointerDown, "pointerId", { value: 7 });
    Object.defineProperty(pointerMove, "pointerId", { value: 7 });
    fireEvent(backdrop, pointerDown);
    fireEvent(window, pointerMove);
    expect(world).toHaveStyle({ transform: "translate3d(50px, 60px, 0) scale(1)" });

    fireEvent.wheel(backdrop, { clientX: 100, clientY: 100, deltaY: -120 });
    expect(world.style.transform).not.toContain("scale(1)");
  });
});
