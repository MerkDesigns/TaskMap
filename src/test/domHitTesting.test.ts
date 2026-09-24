import { expect, it } from "vitest";

it("rejects coordinate hit tests without an explicit geometry mock", () => {
  expect(() => document.elementFromPoint(120, 80)).toThrow("geometry-aware mock");
});
