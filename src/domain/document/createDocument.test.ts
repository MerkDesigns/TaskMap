// @vitest-environment node

import { describe, expect, it } from "vitest";
import { asEntityId } from "../ids/entityIds";
import { createTaskMapDocument } from "./createDocument";
import { validateTaskMapDocument } from "./validateDocument";
import { TEST_IDS } from "./documentTestFixtures";

describe("current document creation", () => {
  it("creates a minimal valid current-version document with an injectable ID source", () => {
    const uuids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000003"];
    const document = createTaskMapDocument({
      databaseId: asEntityId("database", TEST_IDS.database),
      databasePurpose: "development",
      idSource: { nextUuid: () => uuids.shift() ?? "unexpected" },
    });

    expect(validateTaskMapDocument(document)).toMatchObject({ ok: true });
    expect(document).toMatchObject({
      schemaVersion: 1,
      id: TEST_IDS.document,
      databaseId: TEST_IDS.database,
      activeCanvasId: TEST_IDS.canvasA,
      canvasOrder: [TEST_IDS.canvasA],
    });
    expect(Object.values(document.canvases)[0]?.elementOrder).toEqual([]);
  });
});
