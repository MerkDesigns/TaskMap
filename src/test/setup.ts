import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom has no layout/hit testing. For ordinary dispatched clicks, the event target is the
// available hit-test evidence. Coordinate/drag tests must supply their own geometry-aware mock.
if (typeof document !== "undefined" && !document.elementFromPoint) {
  let target: Element | null = null;
  for (const type of [
    "pointerdown",
    "pointermove",
    "pointerup",
    "mousedown",
    "mousemove",
    "mouseup",
  ]) {
    document.addEventListener(
      type,
      (event) => {
        target = event.target instanceof Element ? event.target : null;
      },
      true,
    );
  }
  document.elementFromPoint = () => (target?.isConnected ? target : null);
  afterEach(() => {
    target = null;
  });
}
