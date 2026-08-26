import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialAwarePresencePrototype } from "../MaterialAwarePresencePrototype";
import { ContentLayer } from "./ContentLayer";
import { createPresenceMaterialStyle } from "./materialPresence";
import { createPresenceMotionController, type PresenceProgressTarget } from "./presenceMotion";
import { VisualGroup, type VisualGroupHandle } from "./VisualGroup";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("UI Lab material-aware presence", () => {
  it("keeps VisualGroup stable and writes only progress plus optional transform", () => {
    const ref = createRef<VisualGroupHandle>();
    const { rerender } = render(
      <VisualGroup ref={ref} data-testid="group">
        Stable child
      </VisualGroup>,
    );
    const group = screen.getByTestId("group");

    expect(group).toHaveStyle({ "--taskmap-ui-lab-presence-progress": "1" });
    expect(group.style.opacity).toBe("");
    expect(group.style.filter).toBe("");
    expect(group.style.mask).toBe("");
    expect(group.style.getPropertyValue("backdrop-filter")).toBe("");

    ref.current?.writePresenceProgress(0.5, 6);
    expect(group).toHaveStyle({
      "--taskmap-ui-lab-presence-progress": "0.5",
      transform: "translate3d(0, 6px, 0)",
    });

    rerender(
      <VisualGroup ref={ref} data-testid="group">
        Updated child
      </VisualGroup>,
    );
    expect(screen.getByTestId("group")).toBe(group);
  });

  it("renders ContentLayer as the smallest ordinary content wrapper", () => {
    const { container } = render(
      <ContentLayer className="feature-content" onClick={() => undefined}>
        <span>Ordinary content</span>
      </ContentLayer>,
    );
    const content = screen.getByText("Ordinary content").parentElement!;

    expect(container.childElementCount).toBe(1);
    expect(content).toHaveClass("taskmap-ui-lab-content-layer", "feature-content");
    expect(content.querySelector("[data-material-strategy='native-glass']")).toBeNull();
  });

  it("derives presence shadow values from the authoritative production recipes", () => {
    expect(createPresenceMaterialStyle("major-glass")).toMatchObject({
      "--taskmap-ui-lab-shadow-y": "3.5px",
      "--taskmap-ui-lab-shadow-first-blur": "12.5px",
      "--taskmap-ui-lab-shadow-second-blur": "16.5px",
      "--taskmap-ui-lab-shadow-opacity": 0.5,
    });
    expect(createPresenceMaterialStyle("minor-glass")).toMatchObject({
      "--taskmap-ui-lab-shadow-y": "3.5px",
      "--taskmap-ui-lab-shadow-first-blur": "7.5px",
      "--taskmap-ui-lab-shadow-second-blur": "11.5px",
      "--taskmap-ui-lab-shadow-opacity": 0.48,
    });
  });

  it("supports eased interruption and reversal without changing React state per frame", () => {
    const scheduler = new TestFrameScheduler();
    const writes: number[] = [];
    const target: PresenceProgressTarget = {
      readPresenceProgress: () => writes[writes.length - 1] ?? 1,
      writePresenceProgress(progress) {
        writes.push(progress);
      },
    };
    const controller = createPresenceMotionController(target, { durationMs: 400 }, scheduler);

    controller.hide();
    scheduler.step(100);
    const interrupted = writes[writes.length - 1]!;
    expect(interrupted).toBeGreaterThan(0);
    expect(interrupted).toBeLessThan(1);

    controller.reverse();
    scheduler.step(50);
    expect(writes.some((progress) => progress > interrupted && progress < 1)).toBe(true);
    scheduler.step(350);
    expect(writes[writes.length - 1]).toBe(1);
  });

  it("keeps nested glass Surfaces outside ContentLayer and preserves node identity while scrubbing", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { container } = render(<MaterialAwarePresencePrototype />);
    const group = container.querySelector<HTMLElement>("[data-presence-group]")!;
    const major = container.querySelector<HTMLElement>("[data-presence-surface='animated-major']")!;

    expect(screen.getByRole("button", { name: "Show" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Hide" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reverse" })).toBeVisible();
    expect(
      container.querySelectorAll(
        ".taskmap-ui-lab-content-layer [data-material-strategy='native-glass']",
      ),
    ).toHaveLength(0);
    expect(group.style.opacity).toBe("");
    expect(group.style.filter).toBe("");
    expect(group.style.mask).toBe("");
    expect(group.style.getPropertyValue("backdrop-filter")).toBe("");

    fireEvent.click(container.querySelector("[data-presence-set='0.5']")!);
    expect(group.dataset.presenceProgress).toBe("0.500");
    expect(container.querySelector<HTMLElement>("[data-presence-surface='animated-major']")).toBe(
      major,
    );
  });
});

class TestFrameScheduler {
  private time = 0;
  private nextHandle = 1;
  private readonly callbacks = new Map<number, FrameRequestCallback>();

  now(): number {
    return this.time;
  }

  request(callback: FrameRequestCallback): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  step(milliseconds: number): void {
    this.time += milliseconds;
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach((callback) => callback(this.time));
  }
}
