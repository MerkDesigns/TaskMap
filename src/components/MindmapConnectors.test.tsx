import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MindmapConnectors } from "./MindmapConnectors";

afterEach(cleanup);

describe("MindmapConnectors", () => {
  it("visually activates the hovered valid endpoint", () => {
    render(
      <MindmapConnectors
        ownerId="target"
        accent="#476FA8"
        connectionMode
        activeTargetPort="left"
        onStartConnection={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "left connection point" })).toHaveClass(
      "scale-125",
      "bg-white/20",
    );
    expect(screen.getByRole("button", { name: "right connection point" })).toHaveClass("scale-100");
    expect(screen.getByRole("button", { name: "left connection point" })).toHaveAttribute(
      "data-connection-port-owner",
      "target",
    );
  });
});
