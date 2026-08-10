import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MaterialSurfaceRegistrationProvider } from "../materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../materials/materialSurfaceRegistry";
import { MotionProvider } from "../motion/MotionProvider";
import { createMotionFrameScheduler, type MotionFrameDriver } from "../motion/motionFrameScheduler";
import { ReducedMotionProvider } from "../motion/reducedMotionPreference";
import { AcrylicToggleButton } from "./AcrylicToggleButton";

beforeEach(() => {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AcrylicToggleButton", () => {
  it("keeps native toggle semantics on the same real acrylic-small surface", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [pressed, setPressed] = useState(false);
      return (
        <AcrylicToggleButton pressed={pressed} onClick={() => setPressed((value) => !value)}>
          Glass toggle
        </AcrylicToggleButton>
      );
    }
    const { container } = render(<Harness />);
    const button = screen.getByRole("button", { name: "Glass toggle" });
    const surface = container.querySelector<HTMLElement>(".taskmap-acrylic-toggle");
    expect(surface).toHaveAttribute("data-material", "acrylic-small");
    expect(surface).toHaveAttribute("data-pressed", "false");
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(surface).toHaveAttribute("data-material", "acrylic-small");
    expect(surface).toHaveAttribute("data-pressed", "true");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("compresses and springs back through the shared scheduler with cheap invalidation", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();
    const { container } = render(
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <MotionProvider scheduler={scheduler}>
          <AcrylicToggleButton pressed={false}>Press glass</AcrylicToggleButton>
        </MotionProvider>
      </MaterialSurfaceRegistrationProvider>,
    );
    const button = screen.getByRole("button", { name: "Press glass" });
    const surface = container.querySelector<HTMLElement>(".taskmap-acrylic-toggle");
    fireEvent.pointerDown(button, { button: 0, pointerId: 1 });
    act(() => driver.fire());
    expect(Number.parseFloat(surface?.style.transform.match(/[\d.]+/)?.[0] ?? "1")).toBeLessThan(1);
    expect(notifySurfaceGeometryChanged).toHaveBeenCalled();
    fireEvent.pointerUp(button, { button: 0, pointerId: 1 });
    act(() => driver.flush());
    expect(surface).toHaveStyle("transform: scale(1)");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    registry.dispose();
    scheduler.dispose();
  });

  it("settles press and release immediately under reduced motion", () => {
    const { container } = render(
      <ReducedMotionProvider override>
        <AcrylicToggleButton pressed={false}>Reduced glass</AcrylicToggleButton>
      </ReducedMotionProvider>,
    );
    const button = screen.getByRole("button", { name: "Reduced glass" });
    const surface = container.querySelector<HTMLElement>(".taskmap-acrylic-toggle");
    fireEvent.pointerDown(button, { button: 0, pointerId: 1 });
    expect(surface).toHaveStyle("transform: scale(0.965)");
    fireEvent.pointerUp(button, { button: 0, pointerId: 1 });
    expect(surface).toHaveStyle("transform: scale(1)");
  });
});

class ControlledFrameDriver implements MotionFrameDriver {
  private callback: ((timestampMs: number) => void) | null = null;
  private timestamp = 0;
  request(callback: (timestampMs: number) => void): number {
    this.callback = callback;
    return 1;
  }
  cancel(): void {
    this.callback = null;
  }
  fire(): boolean {
    const callback = this.callback;
    if (!callback) return false;
    this.callback = null;
    this.timestamp += 1000 / 60;
    callback(this.timestamp);
    return true;
  }
  flush(): void {
    for (let index = 0; index < 240 && this.fire(); index += 1) continue;
  }
}
