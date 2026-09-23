// @vitest-environment node
import { produce } from "immer";
import { describe, expect, it, vi } from "vitest";
import { TEST_IDS, validated } from "../../elements/cardContainerTestFixtures";
import {
  createMindMapInput,
  MIND_MAP_TEST_IDS as ids,
} from "../../elements/mind-map/mindMapTestFixtures";
import { mindMapNodeElementSchema } from "../../elements/mind-map/mindMapModel";
import { mindMapConnectionSchema } from "../../elements/mind-map/mindMapConnectionModel";
import { textBlockElementSchema } from "../../elements/text-block/textBlockModel";
import { createRetainedCanvasProjection } from "./createRetainedCanvasProjection";
import type { RetainedCanvasProjectionResult } from "./retainedCanvasProjectionTypes";

function canvas(result: RetainedCanvasProjectionResult) {
  if (!result.ok) throw new Error("Expected projection");
  return result.canvases[0];
}

describe("extended projection cache", () => {
  it("reuses all views without parsing or serialization for repeated unchanged-document reads", () => {
    const document = validated(createMindMapInput());
    const projection = createRetainedCanvasProjection();
    const first = projection.project(document);
    const spies = [
      vi.spyOn(mindMapNodeElementSchema, "parse"),
      vi.spyOn(textBlockElementSchema, "parse"),
      vi.spyOn(mindMapConnectionSchema, "safeParse"),
      vi.spyOn(JSON, "stringify"),
    ];
    try {
      for (let frame = 0; frame < 100; frame++) expect(projection.project(document)).toBe(first);
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("preserves the edge and untouched block views when a connected node moves", () => {
    const document = validated(createMindMapInput());
    const projection = createRetainedCanvasProjection();
    const before = canvas(projection.project(document));
    const moved = produce(document, (draft) => {
      draft.elements[ids.node].geometry.x += 10;
    });
    const parse = vi.spyOn(mindMapConnectionSchema, "safeParse");
    try {
      const after = canvas(projection.project(moved));
      expect(after.mindmapConnections[0]).toBe(before.mindmapConnections[0]);
      expect(after.textBlocks[0]).toBe(before.textBlocks[0]);
      expect(after.textCards[1]).not.toBe(before.textCards[1]);
      expect(after.textCards[1].x).toBe(510);
      expect(parse).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("revalidates cached edges when endpoint capability changes", () => {
    const document = validated(createMindMapInput());
    const projection = createRetainedCanvasProjection();
    projection.project(document);
    const changed = {
      ...document,
      elements: {
        ...document.elements,
        [ids.node]: {
          ...document.elements[ids.node],
          type: "text-card",
          data: { text: "Ordinary", accent: "red", link: null, placement: null },
        },
      },
    };
    expect(changed.connections).toBe(document.connections);
    expect(projection.project(changed)).toEqual({
      ok: false,
      issues: [{ code: "invalid-connection-endpoint", connectionId: TEST_IDS.connection }],
    });
    expect(projection.project(document).ok).toBe(true);
  });

  it("updates an edited edge without retaining old ports or rebuilding unchanged elements", () => {
    const document = validated(createMindMapInput());
    const projection = createRetainedCanvasProjection();
    const before = canvas(projection.project(document));
    const changed = produce(document, (draft) => {
      draft.connections[TEST_IDS.connection].source.portId = "top";
    });
    const after = canvas(projection.project(changed));
    expect(after.mindmapConnections[0].sourcePort).toBe("top");
    expect(after.mindmapConnections[0]).not.toBe(before.mindmapConnections[0]);
    expect(after.textCards[1]).toBe(before.textCards[1]);
    expect(after.textBlocks[0]).toBe(before.textBlocks[0]);
  });

  it("clears node/block/edge caches together before a new session", () => {
    const document = validated(createMindMapInput());
    const projection = createRetainedCanvasProjection();
    const before = canvas(projection.project(document));
    projection.clear();
    const after = canvas(projection.project(document));
    expect(after).toEqual(before);
    expect(after.textCards[1]).not.toBe(before.textCards[1]);
    expect(after.textBlocks[0]).not.toBe(before.textBlocks[0]);
    expect(after.mindmapConnections[0]).not.toBe(before.mindmapConnections[0]);
  });
});
