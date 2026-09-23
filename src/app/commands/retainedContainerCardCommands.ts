import { castDraft, original } from "immer";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import type { ExtensionInstallation, TaskMapDocument } from "../../domain/document/documentTypes";
import type { ElementId } from "../../domain/ids/entityIds";
import {
  insertContainerCardSchema,
  replaceContainerCardsSchema,
} from "./retainedContainerCardContract";
import { matchesRetainedContainer, containerHasExtension } from "./retainedContainerSnapshot";
import { automaticCardCheckbox } from "./retainedCardCompanions";

const reject = () => [
  commandRejected(
    "command.payload",
    "Container, children or extension state changed or input is invalid.",
  ),
];
function freshInstallations(
  source: TaskMapDocument,
  entries: readonly ExtensionInstallation[],
  cardIds: Set<ElementId>,
) {
  const ids = new Set(entries.map(({ id }) => id));
  return (
    ids.size === entries.length &&
    entries.every(
      (entry) =>
        !source.extensionInstallations[entry.id] &&
        entry.target.kind === "element" &&
        cardIds.has(entry.target.elementId),
    )
  );
}
function setChildOrder(document: object, ids: readonly ElementId[], containerId: ElementId) {
  ids.forEach((id, order) => {
    // Read through the immutable contract; Object.assign below still writes to the Immer proxy.
    const element = (document as TaskMapDocument).elements[id];
    const placement = element.data.placement;
    if (
      placement &&
      typeof placement === "object" &&
      "order" in placement &&
      placement.order === order
    )
      return;
    Object.assign(element, { data: { ...element.data, placement: { containerId, order } } });
  });
}

export const insertRetainedContainerCardCommand = defineCommandHandler({
  type: "document.container.insert-card",
  label: "Insert card",
  history: "record",
  payloadSchema: insertContainerCardSchema,
  apply(document, { expected, origin, card, index, installations, checkboxInstallationId }) {
    const source = original(document as object) as TaskMapDocument;
    if (
      !matchesRetainedContainer(source, expected) ||
      source.elements[card.id] ||
      card.canvasId !== expected.container.canvasId ||
      card.data.placement !== null ||
      index > expected.children.length ||
      (origin === "create" && installations.length)
    )
      return reject();
    let automatic;
    try {
      automatic = automaticCardCheckbox(expected, card.id, installations, checkboxInstallationId);
    } catch {
      return reject();
    }
    const entries = automatic ? [...installations, automatic] : installations;
    if (!freshInstallations(source, entries, new Set([card.id]))) return reject();
    const accent =
      origin === "create" && containerHasExtension(expected, "inherit-card-color")
        ? expected.container.data.accent
        : card.data.accent;
    Object.assign(document.elements, {
      [card.id]: {
        ...card,
        data: {
          ...card.data,
          accent,
          placement: { containerId: expected.container.id, order: index },
        },
      },
    });
    document.canvases[card.canvasId].elementOrder.push(card.id);
    for (const entry of entries) document.extensionInstallations[entry.id] = castDraft(entry);
    const ids = expected.children.map(({ id }) => id);
    ids.splice(index, 0, card.id);
    setChildOrder(document, ids, expected.container.id);
  },
});

export const replaceRetainedContainerCardsCommand = defineCommandHandler({
  type: "document.container.replace-cards-from-json",
  label: "Replace container cards",
  history: "record",
  payloadSchema: replaceContainerCardsSchema,
  apply(document, { expected, payload, cards }) {
    const source = original(document as object) as TaskMapDocument;
    if (
      !matchesRetainedContainer(source, expected) ||
      !containerHasExtension(expected, "copy-paste-json") ||
      cards.length !== payload.cards.length
    )
      return reject();
    const newIds = new Set(cards.map(({ id }) => id));
    if (newIds.size !== cards.length || cards.some(({ id }) => source.elements[id]))
      return reject();
    const entries: ExtensionInstallation[] = [];
    try {
      for (const card of cards) {
        const automatic = automaticCardCheckbox(expected, card.id, [], card.checkboxInstallationId);
        if (automatic) entries.push(automatic);
      }
    } catch {
      return reject();
    }
    if (!freshInstallations(source, entries, newIds)) return reject();
    const removed = new Set(
      expected.children.filter(({ type }) => type === "text-card").map(({ id }) => id),
    );
    for (const id of removed) delete document.elements[id];
    for (const edge of Object.values(source.connections))
      if (removed.has(edge.source.elementId) || removed.has(edge.target.elementId))
        delete document.connections[edge.id];
    for (const entry of Object.values(source.extensionInstallations))
      if (entry.target.kind === "element" && removed.has(entry.target.elementId))
        delete document.extensionInstallations[entry.id];
    const canvas = document.canvases[expected.container.canvasId];
    if (removed.size) canvas.elementOrder = canvas.elementOrder.filter((id) => !removed.has(id));
    cards.forEach((identity, index) => {
      const value = payload.cards[index];
      Object.assign(document.elements, {
        [identity.id]: {
          id: identity.id,
          canvasId: expected.container.canvasId,
          type: "text-card",
          geometry: identity.geometry,
          data: {
            text: value.text,
            accent: value.color,
            link: value.hyperlink,
            placement: { containerId: expected.container.id, order: index },
          },
        },
      });
      canvas.elementOrder.push(identity.id);
    });
    for (const entry of entries) document.extensionInstallations[entry.id] = castDraft(entry);
    const container = (document as unknown as TaskMapDocument).elements[expected.container.id];
    Object.assign(container.data, { name: payload.name, accent: payload.color });
    // Replacement occupies the old card slots in order, then appends surplus cards. Images retain
    // relative position and geometry; the one shared child-order namespace cannot have collisions.
    let next = 0;
    const ordered: ElementId[] = [];
    for (const child of expected.children) {
      if (child.type === "image") ordered.push(child.id);
      else if (next < cards.length) ordered.push(cards[next++].id);
    }
    while (next < cards.length) ordered.push(cards[next++].id);
    if (removed.size || cards.length) setChildOrder(document, ordered, expected.container.id);
  },
});
