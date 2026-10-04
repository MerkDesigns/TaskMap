import { describe, expect, it } from "vitest";
import { hasContentState } from "./contentState";

describe("hasContentState", () => {
  it("hides content while Privacy is installed and engaged", () => {
    expect(hasContentState({ privacy: { enabled: true } }, "hidden")).toBe(true);
    expect(hasContentState({ privacy: { enabled: false } }, "hidden")).toBe(false);
  });

  it("leaves content visible without a contributing extension", () => {
    expect(hasContentState({ lock: { enabled: true } }, "hidden")).toBe(false);
    expect(hasContentState({}, "hidden")).toBe(false);
    expect(hasContentState(undefined, "hidden")).toBe(false);
  });
});
