import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MindmapBounds } from "../mindmapMath";
import { MindmapConnections } from "./MindmapConnections";

afterEach(cleanup);

describe("MindmapConnections", () => {
  it("exposes a wide clickable stroke only while connection mode is active", () => {
    const onConnectionClick = vi.fn();
    const connectableBounds = new Map<string, MindmapBounds>([
      ["one", { x: 0, y: 0, width: 128, height: 44 }],
      ["two", { x: 300, y: 100, width: 128, height: 44 }],
    ]);
    const connection = {
      id: "connection-1",
      sourceId: "one",
      sourcePort: "right" as const,
      targetId: "two",
      targetPort: "left" as const,
    };
    const { container } = render(
      <MindmapConnections
        connections={[connection]}
        connectableBoundsById={connectableBounds}
        canvasWidth={3000}
        canvasHeight={3000}
        connectionMode
        onConnectionClick={onConnectionClick}
      />,
    );

    const hitPath = container.querySelector<SVGPathElement>(
      '[data-mindmap-connection-id="connection-1"]',
    );
    expect(hitPath).toHaveStyle({ pointerEvents: "stroke" });
    expect(
      container.querySelector('[data-mindmap-connection-delete-overlay="connection-1"]'),
    ).toHaveAttribute("stroke", "rgba(239, 68, 68, 0.95)");
    fireEvent.pointerDown(hitPath!);
    expect(onConnectionClick).toHaveBeenCalledWith(expect.anything(), connection);
  });
});
