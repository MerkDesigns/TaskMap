import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MindmapBounds } from "../../mindmapMath";
import { asEntityId } from "../../domain/ids/entityIds";
import type { MindMapDocumentConnection } from "./mindMapConnectionModel";
import { MindMapConnections } from "./MindMapConnections";

const ONE = asEntityId("element", "element-00000000-0000-4000-8000-000000000011");
const TWO = asEntityId("element", "element-00000000-0000-4000-8000-000000000012");

afterEach(cleanup);

describe("MindMapConnections", () => {
  it("exposes a wide clickable stroke only while connection mode is active", () => {
    const onConnectionClick = vi.fn();
    const connectableBounds = new Map<string, MindmapBounds>([
      [ONE, { x: 0, y: 0, width: 128, height: 44 }],
      [TWO, { x: 300, y: 100, width: 128, height: 44 }],
    ]);
    const connection: MindMapDocumentConnection = {
      id: asEntityId("connection", "connection-00000000-0000-4000-8000-000000000001"),
      canvasId: asEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000002"),
      type: "mind-map",
      source: { elementId: ONE, portId: "right" },
      target: { elementId: TWO, portId: "left" },
      data: {},
    };
    const { container } = render(
      <MindMapConnections
        connections={[connection]}
        connectableBoundsById={connectableBounds}
        canvasWidth={3000}
        canvasHeight={3000}
        connectionMode
        onConnectionClick={onConnectionClick}
      />,
    );

    const hitPath = container.querySelector<SVGPathElement>(
      `[data-mindmap-connection-id="${connection.id}"]`,
    );
    expect(hitPath).toHaveStyle({ pointerEvents: "stroke" });
    expect(
      container.querySelector(`[data-mindmap-connection-delete-overlay="${connection.id}"]`),
    ).toHaveAttribute("stroke", "rgba(239, 68, 68, 0.95)");
    fireEvent.pointerDown(hitPath!);
    expect(onConnectionClick).toHaveBeenCalledWith(expect.anything(), connection.id);
  });
});
