import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MindMapPorts } from "./MindMapPorts";

afterEach(cleanup);

describe("MindMapPorts", () => {
  it("visually activates the hovered valid endpoint", () => {
    render(
      <MindMapPorts
        ownerId="target"
        accent="#476FA8"
        connectionMode
        activeTargetPort="left"
        onStartConnection={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "left connection point" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("button", { name: "right connection point" })).not.toHaveAttribute(
      "data-active",
    );
    expect(screen.getByRole("button", { name: "left connection point" })).toHaveAttribute(
      "data-connection-port-owner",
      "target",
    );
  });
});
