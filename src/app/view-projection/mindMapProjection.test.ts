// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRetainedCanvasProjection } from "./createRetainedCanvasProjection";
import { TEST_IDS, validated } from "../../elements/cardContainerTestFixtures";
import {
  createMindMapInput,
  MIND_MAP_TEST_IDS as ids,
} from "../../elements/mind-map/mindMapTestFixtures";
import { mindMapConnectionSchema } from "../../elements/mind-map/mindMapConnectionModel";

describe("retained text-block and mind-map projection", () => {
  it("preserves block geometry/header/Markdown and root content-sized node props", () => {
    const document = validated(createMindMapInput());
    const original = structuredClone(document);
    const result = createRetainedCanvasProjection().project(document);
    if (!result.ok) throw new Error("Expected projection");
    const canvas = result.canvases[0];
    expect(canvas.textBlocks).toEqual([
      {
        id: ids.block,
        layer: 2,
        x: 50,
        y: 90,
        width: 400,
        height: 300,
        name: "Notes 📃",
        text: "# Heading\n第二行",
        accent: "#abc",
        headerButtonsVisible: false,
      },
    ]);
    expect(canvas.textCards[1]).toEqual({
      id: ids.node,
      kind: "mindmap",
      layer: 3,
      x: 500,
      y: 500,
      text: "Idea\n💡",
      accent: "#def",
    });
    expect(canvas.mindmapConnections).toEqual([
      {
        id: TEST_IDS.connection,
        sourceId: ids.node,
        sourcePort: "right",
        targetId: ids.block,
        targetPort: "left",
      },
    ]);
    for (const value of [
      canvas.textBlocks,
      canvas.textBlocks[0],
      canvas.textCards[1],
      canvas.mindmapConnections,
      canvas.mindmapConnections[0],
    ])
      expect(Object.isFrozen(value)).toBe(true);
    expect(document).toEqual(original);
  });

  it.each([ids.node, ids.block, TEST_IDS.elementA])("accepts supported endpoint %s", (targetId) => {
    const input = createMindMapInput();
    const sourceId = targetId === ids.node ? ids.block : ids.node;
    input.connections[TEST_IDS.connection] = {
      id: TEST_IDS.connection,
      canvasId: TEST_IDS.canvasA,
      type: "mind-map",
      source: { elementId: sourceId, portId: "top" },
      target: { elementId: targetId, portId: "bottom" },
      data: {},
    };
    expect(createRetainedCanvasProjection().project(validated(input)).ok).toBe(true);
  });

  it("rejects normal text cards as connection endpoints without hiding the edge", () => {
    const input = createMindMapInput();
    const edge = mindMapConnectionSchema.parse(input.connections[TEST_IDS.connection]);
    input.connections[TEST_IDS.connection] = {
      ...edge,
      target: { elementId: TEST_IDS.elementB, portId: "left" },
    };
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "invalid-connection-endpoint", connectionId: TEST_IDS.connection }],
    });
  });

  it("rejects self edges", () => {
    const input = createMindMapInput();
    const edge = mindMapConnectionSchema.parse(input.connections[TEST_IDS.connection]);
    input.connections[TEST_IDS.connection] = {
      ...edge,
      target: { elementId: edge.source.elementId, portId: "bottom" },
    };
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "self-connection", connectionId: TEST_IDS.connection }],
    });
  });

  it.each([false, true])(
    "rejects duplicate pairs regardless of direction or ports (reversed=%s)",
    (reverse) => {
      const input = createMindMapInput();
      const edge = mindMapConnectionSchema.parse(input.connections[TEST_IDS.connection]);
      input.connections[ids.connectionB] = {
        ...edge,
        id: ids.connectionB,
        source: { elementId: reverse ? ids.block : ids.node, portId: "bottom" },
        target: { elementId: reverse ? ids.node : ids.block, portId: "top" },
      };
      expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
        ok: false,
        issues: [{ code: "duplicate-connection-pair", connectionId: ids.connectionB }],
      });
    },
  );

  it.each([
    ["unknown-type", { type: "secret-edge-type" }, "unsupported-connection"],
    ["unknown-data", { data: { secret: "secret payload" } }, "invalid-connection-data"],
    ["null-port", { source: { elementId: ids.node, portId: null } }, "invalid-connection-data"],
  ] as const)("returns only sanitized issues for %s", (_label, changes, code) => {
    const input = createMindMapInput();
    input.connections[TEST_IDS.connection] = {
      ...mindMapConnectionSchema.parse(input.connections[TEST_IDS.connection]),
      ...changes,
    };
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code, connectionId: TEST_IDS.connection }],
    });
  });

  it("assigns connections to their owning canvas and preserves declared canvas order", () => {
    const input = createMindMapInput();
    input.canvasOrder.unshift(TEST_IDS.canvasB);
    input.canvases[TEST_IDS.canvasB] = {
      id: TEST_IDS.canvasB,
      name: "Empty first",
      settings: { width: 1000, height: 1000 },
      elementOrder: [],
    };
    const result = createRetainedCanvasProjection().project(validated(input));
    if (!result.ok) throw new Error("Expected projection");
    expect(result.canvases.map(({ id }) => id)).toEqual([TEST_IDS.canvasB, TEST_IDS.canvasA]);
    expect(result.canvases[0].mindmapConnections).toEqual([]);
    expect(result.canvases[1].mindmapConnections).toHaveLength(1);
  });

  it.each(["mind-map-node", "text-block"])("rejects invalid %s on an inactive canvas", (type) => {
    const input = createMindMapInput();
    input.connections = {};
    const id = type === "text-block" ? ids.block : ids.node;
    input.elements[id].data = { secret: "not renderable" };
    input.elements[id].canvasId = TEST_IDS.canvasB;
    input.canvasOrder.push(TEST_IDS.canvasB);
    input.canvases[TEST_IDS.canvasB] = {
      id: TEST_IDS.canvasB,
      name: "Other",
      settings: { width: 1000, height: 1000 },
      elementOrder: [id],
    };
    input.canvases[TEST_IDS.canvasA].elementOrder = input.canvases[
      TEST_IDS.canvasA
    ].elementOrder.filter((entry) => entry !== id);
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "invalid-element-data", elementId: id }],
    });
  });
});
