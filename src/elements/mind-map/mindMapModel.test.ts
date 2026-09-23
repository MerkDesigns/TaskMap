// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { TEST_IDS } from "../cardContainerTestFixtures";
import { mindMapNodeElementSchema } from "./mindMapModel";
import { mindMapConnectionSchema, inspectMindMapConnection } from "./mindMapConnectionModel";
import { createMindMapInput, MIND_MAP_TEST_IDS as ids } from "./mindMapTestFixtures";

describe("typed mind-map payloads", () => {
  it("accepts explicit node type and empty text without adding card placement/link fields", () => {
    const node = createMindMapInput().elements[ids.node];
    expect(mindMapNodeElementSchema.parse(node)).toEqual(node);
    expect(
      mindMapNodeElementSchema.safeParse({ ...node, data: { text: "", accent: "red" } }).success,
    ).toBe(true);
    expect(mindMapNodeElementSchema.safeParse({ ...node, type: "text-card" }).success).toBe(false);
  });
  it.each(["link", "placement", "kind", "extensions"])("rejects %s in node data", (field) => {
    const node = createMindMapInput().elements[ids.node];
    expect(
      mindMapNodeElementSchema.safeParse({ ...node, data: { ...node.data, [field]: null } })
        .success,
    ).toBe(false);
  });
  it("enforces text/accent bounds and canonical geometry", () => {
    const node = createMindMapInput().elements[ids.node];
    for (const field of ["text", "accent"]) {
      expect(
        mindMapNodeElementSchema.safeParse({
          ...node,
          data: { ...node.data, [field]: "a".repeat(DOCUMENT_LIMITS.jsonStringLength + 1) },
        }).success,
      ).toBe(false);
    }
    expect(
      mindMapNodeElementSchema.safeParse({ ...node, geometry: { ...node.geometry, width: 0 } })
        .success,
    ).toBe(false);
    expect(
      mindMapNodeElementSchema.safeParse({ ...node, data: { text: "", accent: "" } }).success,
    ).toBe(false);
  });
  it.each(["left", "right", "top", "bottom"])("accepts %s on either endpoint", (portId) => {
    const connection = mindMapConnectionSchema.parse(
      createMindMapInput().connections[TEST_IDS.connection],
    );
    expect(
      mindMapConnectionSchema.safeParse({
        ...connection,
        source: { ...connection.source, portId },
        target: { ...connection.target, portId },
      }).success,
    ).toBe(true);
  });
  it.each([null, "center", "LEFT", "", 1])("rejects invalid port %s without coercion", (portId) => {
    const connection = mindMapConnectionSchema.parse(
      createMindMapInput().connections[TEST_IDS.connection],
    );
    for (const end of ["source", "target"] as const) {
      expect(
        mindMapConnectionSchema.safeParse({ ...connection, [end]: { ...connection[end], portId } })
          .success,
      ).toBe(false);
    }
  });
  it("rejects unknown edge data/type/endpoint fields rather than stripping them", () => {
    const connection = mindMapConnectionSchema.parse(
      createMindMapInput().connections[TEST_IDS.connection],
    );
    expect(
      mindMapConnectionSchema.safeParse({ ...connection, data: { color: "secret" } }).success,
    ).toBe(false);
    expect(mindMapConnectionSchema.safeParse({ ...connection, type: "unknown" }).success).toBe(
      false,
    );
    expect(
      mindMapConnectionSchema.safeParse({
        ...connection,
        source: { ...connection.source, secret: true },
      }).success,
    ).toBe(false);
  });
  it("checks missing and cross-canvas endpoint capabilities independently of shape validation", () => {
    const connection = mindMapConnectionSchema.parse(
      createMindMapInput().connections[TEST_IDS.connection],
    );
    const endpoints = new Map([
      [ids.node, TEST_IDS.canvasA],
      [ids.block, TEST_IDS.canvasA],
    ]);
    expect(inspectMindMapConnection(connection, endpoints, new Set())).toBeNull();
    endpoints.delete(ids.block);
    expect(inspectMindMapConnection(connection, endpoints, new Set())).toBe(
      "invalid-connection-endpoint",
    );
    endpoints.set(ids.block, TEST_IDS.canvasB);
    expect(inspectMindMapConnection(connection, endpoints, new Set())).toBe(
      "invalid-connection-endpoint",
    );
  });
});
