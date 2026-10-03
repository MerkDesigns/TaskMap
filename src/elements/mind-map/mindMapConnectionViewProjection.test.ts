import { describe, expect, it } from "vitest";
import type { DocumentConnection } from "../../domain/document/documentTypes";
import { asEntityId } from "../../domain/ids/entityIds";
import { canvasMindMapConnections } from "./mindMapConnectionViewProjection";

const canvasA = asEntityId("canvas", "canvas-00000000-0000-4000-8000-00000000000a");
const canvasB = asEntityId("canvas", "canvas-00000000-0000-4000-8000-00000000000b");
const element = (n: number) =>
  asEntityId("element", `element-00000000-0000-4000-8000-00000000001${n}`);

const connection = (n: number, canvasId: typeof canvasA): DocumentConnection => ({
  id: asEntityId("connection", `connection-00000000-0000-4000-8000-00000000002${n}`),
  canvasId,
  type: "mind-map",
  source: { elementId: element(n), portId: "right" },
  target: { elementId: element(n + 1), portId: "left" },
  data: {},
});

describe("canvasMindMapConnections", () => {
  it("keeps the given canvas's mind-map connections in document order", () => {
    const first = connection(1, canvasA);
    const other = connection(2, canvasB);
    const second = connection(3, canvasA);
    const connections = { [first.id]: first, [other.id]: other, [second.id]: second };

    expect(canvasMindMapConnections(connections, canvasA)).toEqual([first, second]);
    expect(canvasMindMapConnections(connections, canvasB)).toEqual([other]);
  });
});
