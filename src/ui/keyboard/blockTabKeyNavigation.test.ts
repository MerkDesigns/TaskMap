import { describe, expect, it, vi } from "vitest";
import { blockTabKeyNavigation } from "./blockTabKeyNavigation";

describe("blockTabKeyNavigation", () => {
  it("cancels native Tab traversal but lets app shortcuts and focus traps receive the event", () => {
    for (const init of [{}, { shiftKey: true }, { ctrlKey: true }]) {
      const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true, ...init });
      const stopImmediatePropagation = vi.spyOn(event, "stopImmediatePropagation");
      blockTabKeyNavigation(event);
      expect(event.defaultPrevented).toBe(true);
      expect(stopImmediatePropagation).not.toHaveBeenCalled();
    }
  });

  it("does not interfere with other keys", () => {
    const event = new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true });
    const stopImmediatePropagation = vi.spyOn(event, "stopImmediatePropagation");
    blockTabKeyNavigation(event);
    expect(event.defaultPrevented).toBe(false);
    expect(stopImmediatePropagation).not.toHaveBeenCalled();
  });
});
