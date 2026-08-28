import { describe, expect, it, vi } from "vitest";
import { blockTabKeyNavigation } from "./blockTabKeyNavigation";

describe("blockTabKeyNavigation", () => {
  it("blocks Tab and modified Tab events completely", () => {
    for (const init of [{}, { shiftKey: true }, { ctrlKey: true }]) {
      const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true, ...init });
      const stopImmediatePropagation = vi.spyOn(event, "stopImmediatePropagation");
      blockTabKeyNavigation(event);
      expect(event.defaultPrevented).toBe(true);
      expect(stopImmediatePropagation).toHaveBeenCalledOnce();
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
