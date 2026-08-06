// @vitest-environment node

import { describe, expect, it } from "vitest";
import { inspectDocumentInvariants } from "./documentInvariants";
import { parseTaskMapDocument } from "./documentSchema";

describe("domain foundation", () => {
  it("parses and checks a current-version document without a browser environment", () => {
    const document = parseTaskMapDocument({
      schemaVersion: 1,
      id: "document-1",
      databaseId: "database-1",
      databasePurpose: "development",
      activeCanvasId: "canvas-1",
      canvases: {
        "canvas-1": { id: "canvas-1", name: "First canvas" },
      },
      elements: {},
      connections: {},
      mediaReferences: {},
      settings: {},
    });

    expect(inspectDocumentInvariants(document)).toEqual([]);
  });
});
