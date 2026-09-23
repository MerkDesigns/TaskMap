import type { ElementId } from "../../domain/ids/entityIds";
import { inspectJsonSafety } from "../../domain/document/jsonSafety";
import { parseCopyPasteJson, serializeContainerForAi } from "../../extensions/copyPasteJson";
import type { createRetainedCompletionOwner } from "./retainedCompletionOwner";
import { captureRetainedContainer, containerHasExtension } from "./retainedContainerSnapshot";
import {
  newContainerCardSchema,
  type NewContainerCard,
  type AiCardIdentity,
} from "./retainedContainerCardContract";

export function retainedContainerCardCallbacks(
  owner: ReturnType<typeof createRetainedCompletionOwner>,
) {
  const snapshot = (id: ElementId) => captureRetainedContainer(owner.readDocument(), id);
  return {
    captureNewContainerCard(containerId: ElementId, index: number) {
      const expected = snapshot(containerId);
      if (!expected || !Number.isInteger(index) || index < 0 || index > expected.children.length)
        return null;
      return owner.capture(
        "container-cards",
        { expected, index },
        (saved, input: NewContainerCard | null) => {
          if (input === null) return null;
          const parsed = newContainerCardSchema.parse(input);
          return {
            type: "document.container.insert-card",
            payload: {
              ...saved,
              origin: "create",
              installations: [],
              checkboxInstallationId: parsed.checkboxInstallationId,
              card: {
                id: parsed.id,
                type: "text-card",
                canvasId: saved.expected.container.canvasId,
                geometry: parsed.geometry,
                data: { ...parsed.data, placement: null },
              },
            },
          };
        },
      );
    },
    getContainerJsonForAi(containerId: ElementId) {
      const saved = snapshot(containerId);
      if (!saved || !containerHasExtension(saved, "copy-paste-json")) return null;
      return serializeContainerForAi(
        saved.container.data,
        saved.children
          .filter((child) => child.type === "text-card")
          .map((card) => ({
            text: card.data.text,
            accent: card.data.accent,
            link: card.data.link ?? undefined,
          })),
      );
    },
    // Capture before an asynchronous clipboard read or opening the JSON editor. Draft/clipboard text
    // remains caller-owned and must be cleared by the existing visible purge hook on session loss.
    captureContainerJsonReplace(containerId: ElementId) {
      const expected = snapshot(containerId);
      if (!expected || !containerHasExtension(expected, "copy-paste-json")) return null;
      return owner.capture(
        "container-cards",
        expected,
        (
          saved,
          input: { readonly json: string; readonly cards: readonly AiCardIdentity[] } | null,
        ) => {
          if (input === null) return null;
          const parsed = parseCopyPasteJson(input.json);
          if (!parsed.success || inspectJsonSafety(parsed.data).length)
            throw new Error("Invalid AI JSON");
          return {
            type: "document.container.replace-cards-from-json",
            payload: {
              expected: saved,
              payload: parsed.data,
              cards: input.cards,
            },
          };
        },
      );
    },
  };
}
