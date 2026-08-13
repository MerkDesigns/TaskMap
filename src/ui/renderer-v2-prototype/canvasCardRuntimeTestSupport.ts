import { vi } from "vitest";
import type { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";

export function pointerTarget() {
  const target = document.createElement("article");
  Object.assign(target, {
    setPointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
    releasePointerCapture: vi.fn(),
  });
  return target as HTMLElement & { releasePointerCapture: ReturnType<typeof vi.fn> };
}

export function pointerEvent(type: string, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    pointerId: { value: 7 },
    clientY: { value: clientY },
  });
  return event as PointerEvent;
}

export function settleWheel(runtime: LiquidSceneBenchmarkRuntime, startAt: number) {
  for (let frame = 1; frame <= 100; frame += 1) runtime.tick(startAt + frame * 16);
}
