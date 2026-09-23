import { createValidDocumentInput, TEST_IDS } from "../domain/document/documentTestFixtures";
import { validateTaskMapDocument } from "../domain/document/validateDocument";
import type { TaskMapDocument } from "../domain/document/documentTypes";

export { TEST_IDS };

export function createCardContainerInput() {
  const input = createValidDocumentInput();
  input.connections = {};
  input.extensionInstallations = {};
  input.mediaReferences = {};
  input.elements[TEST_IDS.elementA].type = "container";
  input.elements[TEST_IDS.elementA].data = {
    name: "Ideas 🗂️",
    accent: "#123456",
    headerButtonsVisible: false,
  };
  input.elements[TEST_IDS.elementB].type = "text-card";
  input.elements[TEST_IDS.elementB].data = {
    text: "First line\n第二行",
    accent: "#fedcba",
    link: null,
    placement: { containerId: TEST_IDS.elementA, order: 3 },
  };
  return input;
}

export function validated(input: unknown): TaskMapDocument {
  const result = validateTaskMapDocument(input);
  if (!result.ok) throw new Error("Invalid projection test fixture");
  return result.document;
}
