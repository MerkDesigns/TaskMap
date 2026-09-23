import { asEntityId } from "../../domain/ids/entityIds";
import { geometryInput, geometryIds as ids } from "./retainedGeometryTestSupport";
import { copiedElementId } from "./retainedCopyTestSupport";
import { extensionTestId } from "./retainedExtensionTestSupport";
import { COPY_PASTE_JSON_INSTRUCTION } from "../../extensions/copyPasteJson";
import type { AiCardIdentity, NewContainerCard } from "./retainedContainerCardContract";

export function containerCardInput() {
  const input = geometryInput();
  ["copy-paste-json", "auto-checkbox", "inherit-card-color", "search", "lock"].forEach(
    (extensionId, index) => {
      const id = extensionTestId(index);
      input.extensionInstallations[id] = {
        id,
        extensionId: asEntityId("extension", extensionId),
        target: { kind: "element", elementId: ids.container },
        enabled: true,
        configuration: extensionId === "search" ? { query: "hidden" } : { enabled: true },
      };
    },
  );
  input.extensionInstallations[extensionTestId(5)] = {
    id: extensionTestId(5),
    extensionId: asEntityId("extension", "checkbox"),
    enabled: true,
    target: { kind: "element", elementId: ids.card },
    configuration: { checked: true },
  };
  return input;
}
export function newContainerCard(): NewContainerCard {
  return {
    id: copiedElementId(20),
    geometry: { x: 40, y: 120, width: 200, height: 43 },
    data: { text: "New card", accent: "#abcdef", link: null },
    checkboxInstallationId: extensionTestId(20),
  };
}
export function aiPayload(count = 2) {
  return {
    instruction: COPY_PASTE_JSON_INSTRUCTION,
    name: "  AI title  ",
    color: "#ABCDEF",
    cards: Array.from({ length: count }, (_, index) => ({
      text: `AI ${index}\ntext`,
      color: "#654321",
      hyperlink: index ? "https://example.com/path?q=1" : null,
    })),
  };
}
export function aiIdentities(count = 2): AiCardIdentity[] {
  return Array.from({ length: count }, (_, index) => ({
    id: copiedElementId(30 + index),
    geometry: { x: 40, y: 120 + index * 50, width: 200, height: 43 },
    checkboxInstallationId: extensionTestId(30 + index),
  }));
}
