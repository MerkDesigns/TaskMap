import { vi } from "vitest";
import { createAppStore } from "../store";
import { acceptRetainedDocument } from "../database/acceptRetainedDocument";
import { retainedDocumentCommandHandlers } from "./retainedDocumentCommandHandlers";
import { createImageInput, IMAGE_TEST_IDS } from "../../elements/image/imageTestFixtures";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { asEntityId, type ElementId } from "../../domain/ids/entityIds";
import { FakePersistenceScheduler, savedDocument } from "../workspace/workspaceTestSupport";

export const geometryIds = {
  container: TEST_IDS.elementA,
  card: TEST_IDS.elementB,
  image: IMAGE_TEST_IDS.image,
  block: asEntityId("element", "element-00000000-0000-4000-8000-000000000081"),
  mindmap: asEntityId("element", "element-00000000-0000-4000-8000-000000000082"),
};
export function geometryInput() {
  const input = createImageInput();
  for (const [id, type, data] of [
    [
      geometryIds.block,
      "text-block",
      { name: "Block", text: "Text", accent: "red", headerButtonsVisible: true },
    ],
    [geometryIds.mindmap, "mind-map-node", { text: "Node", accent: "blue" }],
  ] as const) {
    input.elements[id] = {
      id,
      canvasId: TEST_IDS.canvasA,
      type,
      geometry: { x: 200, y: 300, width: 200, height: 100 },
      data,
    };
    input.canvases[TEST_IDS.canvasA].elementOrder.push(id);
  }
  return input;
}
export function geometrySetup(input = geometryInput()) {
  const scheduler = new FakePersistenceScheduler();
  const saveDocument = vi.fn(async () => savedDocument(5));
  const store = createAppStore({
    acceptDocument: acceptRetainedDocument,
    commandHandlers: retainedDocumentCommandHandlers,
    persistence: { databaseClient: { saveDocument }, scheduler },
  });
  if (!store.workspace.load(input, 4).ok) throw new Error("Invalid geometry test fixture");
  return { store, scheduler, saveDocument };
}
export function geometryLock(
  input: ReturnType<typeof geometryInput>,
  id: ElementId,
  enabled = true,
  configured = true,
) {
  input.extensionInstallations[TEST_IDS.extensionA] = {
    id: TEST_IDS.extensionA,
    extensionId: "lock",
    enabled,
    target: { kind: "element", elementId: id },
    configuration: { enabled: configured },
  };
  return input;
}
