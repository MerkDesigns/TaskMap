import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialSurfaceRegistrationProvider } from "../materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../materials/materialSurfaceRegistry";
import { MotionProvider } from "../motion/MotionProvider";
import { createMotionFrameScheduler, type MotionFrameDriver } from "../motion/motionFrameScheduler";
import { ReducedMotionProvider } from "../motion/reducedMotionPreference";
import { AcrylicConfirmButton } from "./AcrylicConfirmButton";
import { AnimatedCheckbox } from "./AnimatedCheckbox";
import { LiquidToggleSwitch } from "./LiquidToggleSwitch";

afterEach(cleanup);

describe("button material controls", () => {
  it("uses a native switch with a real acrylic-small liquid knob", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <LiquidToggleSwitch label="Liquid switch" checked={checked} onCheckedChange={setChecked} />
      );
    }
    const { container } = render(<Harness />);
    const control = screen.getByRole("switch", { name: "Liquid switch" });
    expect(control).toHaveAttribute("aria-checked", "false");
    expect(container.querySelector(".taskmap-liquid-toggle__knob")).toHaveAttribute(
      "data-material",
      "acrylic-small",
    );
    expect(container.querySelector(".taskmap-liquid-toggle__knob")).toHaveAttribute(
      "data-switch-state",
      "off",
    );
    await user.click(control);
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(container.querySelector(".taskmap-liquid-toggle__knob")).toHaveAttribute(
      "data-switch-state",
      "on",
    );
  });

  it("shares one scheduler and uses cheap geometry invalidation while the knob travels", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();
    const { rerender } = render(
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <MotionProvider scheduler={scheduler}>
          <LiquidToggleSwitch label="Liquid switch" checked={false} onCheckedChange={() => {}} />
        </MotionProvider>
      </MaterialSurfaceRegistrationProvider>,
    );
    rerender(
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <MotionProvider scheduler={scheduler}>
          <LiquidToggleSwitch label="Liquid switch" checked onCheckedChange={() => {}} />
        </MotionProvider>
      </MaterialSurfaceRegistrationProvider>,
    );
    act(() => driver.fire());
    expect(scheduler.getSnapshot().subscriberCount).toBe(1);
    expect(notifySurfaceGeometryChanged).toHaveBeenCalled();
    act(() => driver.flush());
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    registry.dispose();
    scheduler.dispose();
  });

  it("settles the liquid switch immediately under reduced motion", () => {
    const { container, rerender } = render(
      <ReducedMotionProvider override>
        <LiquidToggleSwitch label="Reduced liquid" checked={false} onCheckedChange={() => {}} />
      </ReducedMotionProvider>,
    );
    rerender(
      <ReducedMotionProvider override>
        <LiquidToggleSwitch label="Reduced liquid" checked onCheckedChange={() => {}} />
      </ReducedMotionProvider>,
    );
    expect(container.querySelector(".taskmap-liquid-toggle__knob")).toHaveAttribute(
      "data-settled",
      "true",
    );
  });

  it("keeps confirm actions momentary and exposes the glowing treatment", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    const { container } = render(
      <>
        <AcrylicConfirmButton onClick={action}>Confirm</AcrylicConfirmButton>
        <AcrylicConfirmButton treatment="glowing">Glow</AcrylicConfirmButton>
      </>,
    );
    const normal = screen.getByRole("button", { name: "Confirm" });
    await user.click(normal);
    expect(action).toHaveBeenCalledOnce();
    expect(normal).not.toHaveAttribute("aria-pressed");
    expect(normal.closest("[data-material]")).toHaveAttribute("data-material", "acrylic-small");
    expect(container.querySelector('[data-treatment="glowing"]')).toHaveAttribute(
      "data-material",
      "acrylic-small",
    );
    expect(screen.getByRole("button", { name: "Glow" }).closest("[data-disabled]")).toHaveAttribute(
      "data-disabled",
      "false",
    );
  });

  it("uses native checkbox semantics with separately drawable tick strokes", async () => {
    const user = userEvent.setup();
    render(<AnimatedCheckbox label="Animated check" />);
    const checkbox = screen.getByRole("checkbox", { name: "Animated check" });
    expect(document.querySelectorAll(".taskmap-animated-checkbox__stroke")).toHaveLength(2);
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
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
