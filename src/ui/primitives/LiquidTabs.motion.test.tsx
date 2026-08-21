import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MaterialSurfaceRegistrationProvider } from "../materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../materials/materialSurfaceRegistry";
import { MotionProvider } from "../motion/MotionProvider";
import { createMotionFrameScheduler, type MotionFrameDriver } from "../motion/motionFrameScheduler";
import { LiquidTabs } from "./LiquidTabs";

class ControlledFrameDriver implements MotionFrameDriver {
  private callbacks = new Map<number, (timestampMs: number) => void>();
  private nextHandle = 1;
  private timestampMs = 0;

  request(callback: (timestampMs: number) => void): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  fire(): boolean {
    const entry = this.callbacks.entries().next().value as
      [number, (timestampMs: number) => void] | undefined;
    if (!entry) return false;
    this.callbacks.delete(entry[0]);
    this.timestampMs += 1000 / 60;
    entry[1](this.timestampMs);
    return true;
  }

  flush(limit = 360): void {
    for (let frame = 0; frame < limit && this.fire(); frame += 1) {
      // A shared scheduler may enqueue the next frame while processing this one.
    }
  }
}

let resizeCallbacks: ResizeObserverCallback[] = [];
let shortcutWidth = 160;

class TestResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  shortcutWidth = 160;
  resizeCallbacks = [];
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.getAttribute("role") === "tablist") return rectangle(100, 0, 500, 40);
    if (this.textContent === "General") return rectangle(110, 0, 72, 32);
    if (this.textContent === "Appearance") return rectangle(190, 0, 110, 32);
    if (this.textContent === "Keyboard Shortcuts") {
      return rectangle(320, 0, shortcutWidth, 32);
    }
    const width = Number.parseFloat(this.style.width) || 1;
    return rectangle(0, 0, width, 32);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LiquidTabs material motion", () => {
  it("measures variable tabs and invalidates only surface geometry while moving", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();

    function Harness() {
      const [value, setValue] = useState("general");
      return (
        <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
          <MotionProvider scheduler={scheduler}>
            <LiquidTabs
              label="Liquid categories"
              value={value}
              onValueChange={setValue}
              items={[
                { value: "general", label: "General" },
                { value: "appearance", label: "Appearance" },
                { value: "shortcuts", label: "Keyboard Shortcuts" },
              ]}
            />
          </MotionProvider>
        </MaterialSurfaceRegistrationProvider>
      );
    }

    const { container } = render(<Harness />);
    const indicator = container.querySelector<HTMLElement>(".taskmap-liquid-indicator");
    expect(indicator).not.toBeNull();
    act(() => driver.flush());
    expect(indicator?.style.width).toBe("72px");
    expect(indicator).toHaveStyle("--taskmap-material-radius: 7px");
    const invalidationsAtRest = notifySurfaceGeometryChanged.mock.calls.length;

    fireEvent.click(screen.getByRole("tab", { name: "Keyboard Shortcuts" }));
    act(() => {
      expect(driver.fire()).toBe(true);
    });
    expect(notifySurfaceGeometryChanged.mock.calls.length).toBeGreaterThan(invalidationsAtRest);
    expect(Number.parseFloat(indicator?.style.width ?? "0")).toBeGreaterThan(0);
    expect(
      Number.parseFloat(indicator?.style.getPropertyValue("--taskmap-material-radius") ?? "0"),
    ).toBeGreaterThan(7);
    expect(registry.getSnapshot().surfaces).toEqual([]);
    act(() => driver.flush());
    expect(indicator?.style.transform).toBe("translate3d(220px, 0, 0)");
    expect(indicator?.style.width).toBe("160px");
    expect(indicator).toHaveStyle("--taskmap-material-radius: 7px");

    shortcutWidth = 220;
    act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)));
    act(() => driver.flush());
    expect(indicator?.style.width).toBe("220px");
    expect(indicator).toHaveAttribute("data-material", "acrylic-small");
    expect(indicator).toHaveClass("taskmap-material-surface--bright-selection");
    expect(indicator).toHaveAttribute("data-material-elevation", "none");

    scheduler.dispose();
    registry.dispose();
  });

  it("does not retain duplicate motion subscribers through StrictMode effects", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    render(
      <StrictMode>
        <MotionProvider scheduler={scheduler}>
          <LiquidTabs
            label="Strict categories"
            items={[
              { value: "general", label: "General" },
              { value: "appearance", label: "Appearance" },
            ]}
            value="general"
            onValueChange={() => undefined}
          />
        </MotionProvider>
      </StrictMode>,
    );
    expect(scheduler.getSnapshot().subscriberCount).toBe(1);
    cleanup();
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    scheduler.dispose();
  });
});

function rectangle(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}
