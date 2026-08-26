import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "../../ui/motion/MotionProvider";
import type {
  MotionFrame,
  MotionFrameScheduler,
  MotionFrameSubscriber,
} from "../../ui/motion/motionFrameScheduler";
import { ReducedMotionProvider } from "../../ui/motion/reducedMotionPreference";
import { MaterialAwarePresencePrototype } from "../MaterialAwarePresencePrototype";
import {
  createPresenceController,
  Fade,
  FadeLift,
  FadeSlide,
  Lift,
  SlideLeft,
} from "./presenceController";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("UI Lab Surface presence behaviors", () => {
  it("keeps Fade, Lift, and Slide output channels independent", () => {
    const cases = [
      { effects: Fade, fade: true, x: false, y: false },
      { effects: Lift, fade: false, x: false, y: true },
      { effects: SlideLeft, fade: false, x: true, y: false },
      { effects: FadeLift, fade: true, x: false, y: true },
      { effects: FadeSlide, fade: true, x: true, y: false },
    ] as const;

    for (const testCase of cases) {
      const surface = document.createElement("section");
      const content = document.createElement("div");
      const controller = createPresenceController(surface, {
        scheduler: new ManualScheduler(),
        reducedMotion: false,
        effects: testCase.effects,
        contentTargets: () => [content],
      });
      controller.setProgress(0.5);

      expect(surface.style.getPropertyValue("--taskmap-material-presence-progress") !== "").toBe(
        testCase.fade,
      );
      expect(surface.style.transform.includes("translate3d(")).toBe(testCase.x || testCase.y);
      expect(readTranslation(surface.style.transform, 0) !== 0).toBe(testCase.x);
      expect(readTranslation(surface.style.transform, 1) !== 0).toBe(testCase.y);
      expect(content.style.opacity).toBe(testCase.fade ? "0.5" : "");
      expect(surface.style.opacity).toBe("");
      expect(surface.style.filter).toBe("");
      expect(surface.style.mask).toBe("");
      controller.setProgress(1);
      expect(content.style.opacity).toBe("");
      expect(surface.style.getPropertyValue("--taskmap-material-presence-progress")).toBe("");
      controller.destroy();
    }
  });

  it("uses one scheduler subscription and one composed transform write per frame", () => {
    const scheduler = new ManualScheduler();
    const writes = vi.fn();
    const surface = document.createElement("section");
    const controller = createPresenceController(surface, {
      scheduler,
      reducedMotion: false,
      durationMs: 400,
      effects: {
        fade: true,
        lift: { distancePx: 10 },
        slide: { direction: "right", distancePx: 18 },
      },
      onTransformWrite: writes,
    });
    writes.mockClear();

    controller.hide();
    expect(scheduler.getSnapshot().subscriberCount).toBe(1);
    scheduler.step(100);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(surface.style.transform).toMatch(/^translate3d\([^,]+px, [^,]+px, 0\)$/);
    expect(Number(surface.dataset.presenceProgress)).toBeCloseTo(
      Number(surface.style.getPropertyValue("--taskmap-material-presence-progress")),
      3,
    );
    controller.destroy();
    expect(scheduler.getSnapshot().subscriberCount).toBe(0);
  });

  it.each([0.02, 0.5, 0.98])(
    "reverses from progress %s and scales remaining duration to distance",
    (initialProgress) => {
      const scheduler = new ManualScheduler();
      const surface = document.createElement("section");
      const controller = createPresenceController(surface, {
        scheduler,
        reducedMotion: false,
        durationMs: 400,
        initialProgress,
        effects: Fade,
      });

      controller.reverse();
      const target = initialProgress >= 0.5 ? 0 : 1;
      scheduler.step(Math.abs(target - initialProgress) * 400);
      expect(controller.getSnapshot()).toMatchObject({
        progress: target,
        target,
        phase: target === 0 ? "hidden" : "visible",
      });
      expect(scheduler.getSnapshot().subscriberCount).toBe(0);
    },
  );

  it("honors reduced motion, endpoint interaction, and cleanup", () => {
    const scheduler = new ManualScheduler();
    const surface = document.createElement("section");
    const controller = createPresenceController(surface, {
      scheduler,
      reducedMotion: true,
      effects: FadeSlide,
    });

    controller.hide();
    expect(controller.getSnapshot()).toMatchObject({ progress: 0, phase: "hidden" });
    expect(surface.inert).toBe(true);
    expect(surface).toHaveAttribute("aria-hidden", "true");
    expect(surface.style.pointerEvents).toBe("none");
    expect(scheduler.getSnapshot().subscriberCount).toBe(0);

    controller.show();
    expect(surface.inert).toBe(false);
    expect(surface).not.toHaveAttribute("aria-hidden");
    controller.destroy();
    expect(surface.style.getPropertyValue("--taskmap-material-presence-progress")).toBe("");
    expect(surface.style.transform).toBe("");
  });

  it("keeps nodes stable, nested glass outside content fades, and React idle per frame", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const scheduler = new ManualScheduler();
    const { container } = render(
      <ReducedMotionProvider override={false}>
        <MotionProvider scheduler={scheduler}>
          <MaterialAwarePresencePrototype />
        </MotionProvider>
      </ReducedMotionProvider>,
    );
    const comparison = container.querySelector<HTMLElement>("[data-fade-comparison]")!;
    const major = container.querySelector<HTMLElement>("[data-presence-surface='animated-major']")!;
    const minor = container.querySelector<HTMLElement>(
      "[data-presence-surface='animated-minor-a']",
    )!;
    const renderCount = comparison.dataset.renderCount;

    expect(
      container.querySelectorAll(".taskmap-ui-lab-fade-content .taskmap-material-surface"),
    ).toHaveLength(0);
    fireEvent.click(container.querySelector("[data-presence-hide='comparison']")!);
    scheduler.step(100);
    scheduler.step(100);
    expect(comparison.dataset.renderCount).toBe(renderCount);
    expect(container.querySelector("[data-presence-surface='animated-major']")).toBe(major);
    expect(container.querySelector("[data-presence-surface='animated-minor-a']")).toBe(minor);

    fireEvent.click(container.querySelector("[data-fade-progress='0.5']")!);
    fireEvent.click(container.querySelector("[data-fade-comparison] button")!);
    expect(container.querySelector("[data-presence-surface='animated-major']")).toBe(major);
    expect(container.querySelector("[data-presence-surface='animated-minor-a']")).toBe(minor);
  });
});

class ManualScheduler implements MotionFrameScheduler {
  private readonly subscribers = new Set<MotionFrameSubscriber>();
  private timestampMs = 0;

  subscribe(subscriber: MotionFrameSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  step(deltaMs: number): void {
    this.timestampMs += deltaMs;
    const frame: MotionFrame = { timestampMs: this.timestampMs, deltaMs };
    for (const subscriber of [...this.subscribers]) {
      if (!subscriber(frame)) this.subscribers.delete(subscriber);
    }
  }

  getSnapshot() {
    return { subscriberCount: this.subscribers.size, framePending: this.subscribers.size > 0 };
  }

  dispose(): void {
    this.subscribers.clear();
  }
}

function readTranslation(transform: string, index: 0 | 1): number {
  if (!transform) return 0;
  return Number.parseFloat(transform.slice(12, -1).split(",")[index] ?? "0");
}
