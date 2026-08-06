// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseTaskMapDocument } from "../../document/documentSchema";
import { createValidDocumentInput } from "../../document/documentTestFixtures";
import {
  COMMAND_TEST_IDS,
  createCommandTestDocument,
  executeTestCommand,
} from "../commandTestSupport";

describe("connection commands", () => {
  it("inserts, updates, and removes a same-canvas connection", () => {
    const input = createValidDocumentInput();
    input.connections = {};
    let document = parseTaskMapDocument(input);
    document = succeed(document, "document.connection.insert", {
      connection: {
        id: COMMAND_TEST_IDS.connectionB,
        canvasId: COMMAND_TEST_IDS.canvasA,
        type: "generic-link",
        source: { elementId: COMMAND_TEST_IDS.elementA, portId: null },
        target: { elementId: COMMAND_TEST_IDS.elementB, portId: "left" },
        data: { weight: 1 },
      },
    });
    document = succeed(document, "document.connection.replace-data", {
      connectionId: COMMAND_TEST_IDS.connectionB,
      data: { weight: 2 },
    });
    expect(document.connections[COMMAND_TEST_IDS.connectionB].data).toEqual({ weight: 2 });

    document = succeed(document, "document.connection.remove", {
      connectionId: COMMAND_TEST_IDS.connectionB,
    });
    expect(document.connections).toEqual({});
  });

  it("rejects missing endpoints and cross-canvas connections", () => {
    const input = createValidDocumentInput();
    input.connections = {};
    input.canvasOrder.push(COMMAND_TEST_IDS.canvasB);
    input.canvases[COMMAND_TEST_IDS.canvasB] = {
      id: COMMAND_TEST_IDS.canvasB,
      name: "Second",
      settings: { width: 100, height: 100 },
      elementOrder: [COMMAND_TEST_IDS.elementC],
    };
    input.elements[COMMAND_TEST_IDS.elementC] = {
      id: COMMAND_TEST_IDS.elementC,
      canvasId: COMMAND_TEST_IDS.canvasB,
      type: "generic-node",
      geometry: { x: 0, y: 0, width: 1, height: 1 },
      data: {},
    };
    const document = parseTaskMapDocument(input);

    const missing = executeTestCommand(document, {
      type: "document.connection.insert",
      payload: {
        connection: {
          id: COMMAND_TEST_IDS.connectionB,
          canvasId: COMMAND_TEST_IDS.canvasA,
          type: "generic-link",
          source: { elementId: "element-00000000-0000-4000-8000-000000000099", portId: null },
          target: { elementId: COMMAND_TEST_IDS.elementB, portId: null },
          data: {},
        },
      },
    });
    const crossCanvas = executeTestCommand(document, {
      type: "document.connection.insert",
      payload: {
        connection: {
          id: COMMAND_TEST_IDS.connectionB,
          canvasId: COMMAND_TEST_IDS.canvasA,
          type: "generic-link",
          source: { elementId: COMMAND_TEST_IDS.elementA, portId: null },
          target: { elementId: COMMAND_TEST_IDS.elementC, portId: null },
          data: {},
        },
      },
    });

    expect(missing.ok).toBe(false);
    expect(crossCanvas.ok).toBe(false);
    expect(missing.document).toBe(document);
    expect(crossCanvas.document).toBe(document);
  });

  it("rejects updates and removals for missing connections", () => {
    const document = createCommandTestDocument();
    for (const type of ["document.connection.replace-data", "document.connection.remove"]) {
      const payload = type.endsWith("replace-data")
        ? { connectionId: COMMAND_TEST_IDS.connectionB, data: {} }
        : { connectionId: COMMAND_TEST_IDS.connectionB };
      expect(executeTestCommand(document, { type, payload }).ok).toBe(false);
    }
  });
});

function succeed(
  document: ReturnType<typeof createCommandTestDocument>,
  type: string,
  payload: unknown,
) {
  const result = executeTestCommand(document, { type, payload });
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(", "));
  return result.document;
}
