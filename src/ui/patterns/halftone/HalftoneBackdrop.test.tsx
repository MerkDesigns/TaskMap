import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HalftoneBackdrop } from "./HalftoneBackdrop";

afterEach(cleanup);

describe("HalftoneBackdrop", () => {
  it("renders a decorative canvas that stays empty when WebGL is unavailable", () => {
    const { container, unmount } = render(<HalftoneBackdrop />);
    const canvas = container.querySelector("canvas");

    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(() => unmount()).not.toThrow();
  });
});
