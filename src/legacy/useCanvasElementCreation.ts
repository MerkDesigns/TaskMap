import { useMemo, useRef } from "react";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import {
  createEntityId,
  type CanvasId,
  type ElementId,
  type ExtensionInstanceId,
} from "../domain/ids/entityIds";
import type {
  ContainerElement,
  DefaultElementColors,
  TextBlockElement,
  TextCardElement,
} from "../types";
import {
  CONTAINER_TEXT_CARD_GAP,
  CONTAINER_TEXT_CARD_PADDING,
  CONTAINER_TEXT_CARD_ROW_HEIGHT,
  containerCardStackTop,
  type ContainerCardLayoutModel,
} from "./containerCardLayout";
import {
  newContainer,
  newImagePlaceholder,
  newLooseTextCard,
  newTextBlock,
} from "./newCanvasElements";
import { createRetainedViewElement } from "./retainedViewCreation";
import type { ElementIdsByKind } from "./useElementPresenceMarks";

type PresenceKind = keyof ElementIdsByKind;

type Point = { readonly x: number; readonly y: number };
const uuids = { nextUuid: () => crypto.randomUUID() };

interface InlineEdit {
  readonly begin: (id: string, text: string) => void;
  readonly end: () => void;
}

export interface CanvasElementCreationPorts {
  readonly callbacks: RetainedActionCallbacks;
  readonly activeCanvasId: () => string;
  readonly canvasPoint: (clientX: number, clientY: number) => Point;
  readonly canvasSize: () => { width: number; height: number };
  readonly colors: () => DefaultElementColors;
  readonly containers: () => readonly ContainerElement[];
  readonly textBlocks: () => readonly TextBlockElement[];
  readonly textCards: () => readonly TextCardElement[];
  readonly cardLayout: () => ContainerCardLayoutModel;
  /** Scrolls a container so the row at `offset` shows. */
  readonly scrollContainer: (containerId: string, offset: number) => void;
  readonly select: (ids: string[]) => void;
  readonly animateIn: (kind: PresenceKind, id: string) => void;
  readonly closeContextMenus: () => void;
  readonly rename: InlineEdit;
  readonly cardEdit: InlineEdit;
  readonly blockEdit: InlineEdit;
}

/**
 * Creating elements from the canvas and container menus. Each lands as one transaction, then
 * animates in and opens for naming or editing: frames are selected and renamed, cards start in
 * text editing, and an image placeholder is selected for the user to fill.
 */
export function useCanvasElementCreation(ports: CanvasElementCreationPorts) {
  const latest = useRef(ports);
  latest.current = ports;

  return useMemo(() => {
    const placement = (clientX: number, clientY: number) => {
      const p = latest.current;
      const id = createEntityId("element", uuids);
      return {
        id,
        point: p.canvasPoint(clientX, clientY),
        canvas: p.canvasSize(),
        colors: p.colors(),
      };
    };
    const create = (input: Parameters<typeof createRetainedViewElement>[2]): boolean =>
      createRetainedViewElement(
        latest.current.callbacks,
        latest.current.activeCanvasId() as CanvasId,
        input,
      ).ok;
    /** Shows a new element and opens it the way its kind starts out. */
    const present = (
      kind: PresenceKind,
      id: string,
      open: { readonly rename?: string; readonly text?: string } = {},
    ) => {
      const p = latest.current;
      p.animateIn(kind, id);
      p.select(kind === "textCards" ? [] : [id]);
      p.closeContextMenus();
      if (open.rename === undefined) p.rename.end();
      else p.rename.begin(id, open.rename);
      if (open.text === undefined) p.cardEdit.end();
      else p.cardEdit.begin(id, open.text);
      p.blockEdit.end();
    };
    const looseCard = (clientX: number, clientY: number, text: string, kind?: "mindmap") => {
      const at = placement(clientX, clientY);
      const card = newLooseTextCard(at, text, kind);
      if (create({ type: "text-card", value: card }))
        present("textCards", at.id, { text: card.text });
    };

    return {
      container(clientX: number, clientY: number) {
        const at = placement(clientX, clientY);
        const container = newContainer(at, latest.current.containers().length);
        if (create({ type: "container", value: container }))
          present("containers", at.id, { rename: container.name });
      },
      textBlock(clientX: number, clientY: number) {
        const at = placement(clientX, clientY);
        const block = newTextBlock(at, latest.current.textBlocks().length);
        if (create({ type: "text-block", value: block }))
          present("textBlocks", at.id, { rename: block.name });
      },
      /** An empty image the user fills by double-clicking it or dropping a file on it. */
      imagePlaceholder(clientX: number, clientY: number) {
        const at = placement(clientX, clientY);
        if (create({ type: "image", value: newImagePlaceholder(at) })) present("images", at.id);
      },
      textCard: (clientX: number, clientY: number) => looseCard(clientX, clientY, "Text card"),
      mindmapNode: (clientX: number, clientY: number) =>
        looseCard(clientX, clientY, "Mindmap", "mindmap"),
      /** A card in the container's row under the pointer, scrolled into view. */
      containerCard(containerId: string, clientX: number, clientY: number) {
        const p = latest.current;
        const container = p.containers().find(({ id }) => id === containerId);
        if (!container) return;
        const layout = p.cardLayout();
        const cards = p.textCards();
        const id = createEntityId("element", uuids);
        const order = layout.dropIndex(container, p.canvasPoint(clientX, clientY), cards, id);
        const text = "Text card";
        const position = {
          x: container.x + CONTAINER_TEXT_CARD_PADDING,
          y:
            containerCardStackTop(container) +
            order * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP),
        };
        const card: TextCardElement = { id, text, accent: "", containerId, order, ...position };
        // Where the new card will show once inserted, to scroll its row into view.
        const containerCards = [...layout.ordered(containerId)];
        containerCards.splice(order, 0, card);
        const nextCards = [
          ...cards.filter((other) => other.containerId !== containerId),
          ...containerCards.map((other, index) => ({ ...other, order: index })),
        ];
        const visibleIndex = layout
          .visible(container, nextCards)
          .findIndex((other) => other.id === id);

        const result = p.callbacks
          .captureNewContainerCard(containerId as ElementId, order)
          ?.complete({
            id: id as ElementId,
            geometry: { ...position, width: 1, height: 1 },
            data: { text, accent: p.colors().textCard, link: null },
            checkboxInstallationId:
              container.extensions?.autoCheckbox !== undefined
                ? (createEntityId("extension-instance", uuids) as ExtensionInstanceId)
                : null,
          });
        if (!result?.ok) return;
        if (visibleIndex >= 0)
          p.scrollContainer(containerId, layout.revealOffset(container, visibleIndex, nextCards));
        present("textCards", id, { text });
      },
    };
  }, []);
}
