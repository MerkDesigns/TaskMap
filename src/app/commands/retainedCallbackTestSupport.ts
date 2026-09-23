import {
  sessionSetup,
  success,
  loadedSessionDocument,
  unlockTestSession,
} from "../database/databaseSessionTestSupport";
import { acceptRetainedDocument } from "../database/acceptRetainedDocument";
import { retainedDocumentCommandHandlers } from "./retainedDocumentCommandHandlers";
import { createRetainedActionCallbacks } from "./createRetainedActionCallbacks";
import { geometryInput, geometryIds } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import type { MoveCommit } from "../interactions/canvasInteractionTypes";
import type { ElementId } from "../../domain/ids/entityIds";

export async function callbackSetup(input = geometryInput()) {
  const setup = sessionSetup(acceptRetainedDocument, retainedDocumentCommandHandlers);
  input.databasePurpose = "development";
  input.canvases[TEST_IDS.canvasB] = {
    id: TEST_IDS.canvasB,
    name: "Second",
    settings: { width: 1000, height: 800 },
    elementOrder: [],
  };
  input.canvasOrder.push(TEST_IDS.canvasB);
  setup.client.unlockDatabase.mockResolvedValue(
    success({ ...loadedSessionDocument, serializedDocument: JSON.stringify(input) }),
  );
  const actions = createRetainedActionCallbacks(setup.controller);
  await unlockTestSession(setup);
  const { store } = setup.controller;
  function move(elementIds: readonly ElementId[] = [geometryIds.card]): MoveCommit {
    return {
      primaryId: elementIds[0],
      completionBehavior: "translate",
      pointerWorld: { x: 100, y: 100 },
      screenDistance: 100,
      targets: elementIds.map((id) => {
        const from = store.getState().documentWorkspace.document!.elements[id].geometry;
        return {
          id,
          from: { ...from, width: 77, height: 33 },
          to: { ...from, x: from.x + 10, y: from.y + 20, width: 77, height: 33 },
        };
      }),
    };
  }
  return {
    ...setup,
    store,
    actions,
    move,
    dispose: async () => {
      actions.dispose();
      await setup.controller.dispose();
    },
  };
}
