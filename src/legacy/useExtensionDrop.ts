import { useMemo, useRef } from "react";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import { useExtensionDropRipples } from "../components/ExtensionDropRipples";
import type { TaskMapDocument } from "../domain/document/documentTypes";
import { addsCardAdornment } from "../extensions/cardAdornmentRegistry";
import { isExtensionCompatible } from "../extensions/extensionCatalog";
import type { RetainedExtensionKey } from "../extensions/retainedExtensionDefinition";
import { searchRowHeight } from "../extensions/search/searchRule";
import type { ContainerElement, ImageElement, TextBlockElement, TextCardElement } from "../types";
import { containerRowSize } from "./canvasElementBounds";
import { CONTAINER_HEADER_HEIGHT, type ContainerCardLayoutModel } from "./containerCardLayout";
import {
  extensionDropTargetIds,
  findExtensionDropTarget,
  type DropBounds,
  type ExtensionDropTarget,
  type ExtensionDropTargetType,
} from "./extensionDropTarget";
import { installRetainedViewExtension } from "./retainedViewExtensions";

type Point = { readonly x: number; readonly y: number };
const uuids = { nextUuid: () => crypto.randomUUID() };

export interface ExtensionDropPorts {
  readonly callbacks: RetainedActionCallbacks;
  readonly document: () => TaskMapDocument | null;
  readonly canvasPoint: (clientX: number, clientY: number) => Point;
  /** What a drop can land on, topmost last. */
  readonly scene: () => {
    readonly containers: readonly ContainerElement[];
    readonly textBlocks: readonly TextBlockElement[];
    readonly looseCards: readonly TextCardElement[];
    readonly images: readonly ImageElement[];
  };
  readonly find: {
    readonly container: (id: string) => ContainerElement | undefined;
    readonly textBlock: (id: string) => TextBlockElement | undefined;
    readonly image: (id: string) => ImageElement | undefined;
    readonly card: (id: string) => TextCardElement | undefined;
  };
  readonly cardLayout: () => ContainerCardLayoutModel;
  /** A card's shown bounds, or null when it is scrolled out of its container. */
  readonly cardBounds: (card: TextCardElement) => DropBounds | null;
  readonly looseCardEstimate: (card: TextCardElement) => DropBounds;
  readonly selection: () => readonly string[];
  readonly select: (ids: string[]) => void;
  readonly closeContextMenus: () => void;
}

const frameBounds = (element: { x: number; y: number; width: number; height: number }) => ({
  left: element.x,
  top: element.y,
  width: element.width,
  height: element.height,
});

/**
 * Dropping an extension from the Extensions panel or quick menu onto the canvas: it installs on
 * the compatible element under the pointer, or on the compatible part of the selection that
 * element is in, selects the element, and plays a ripple over every element it landed on.
 */
export function useExtensionDrop(ports: ExtensionDropPorts) {
  const latest = useRef(ports);
  latest.current = ports;
  const ripples = useExtensionDropRipples();
  const showRipple = ripples.show;

  const drop = useMemo(() => {
    const typeOf = (id: string): ExtensionDropTargetType | null => {
      const { find } = latest.current;
      if (find.container(id)) return "container";
      if (find.textBlock(id)) return "text-block";
      const card = find.card(id);
      if (card) return card.kind === "mindmap" ? "mindmap" : "text-card";
      return find.image(id) ? "image" : null;
    };
    const boundsOf = (target: ExtensionDropTarget): DropBounds | null => {
      const { find, cardBounds } = latest.current;
      if (target.type === "container") {
        const element = find.container(target.id);
        return element ? frameBounds(element) : null;
      }
      if (target.type === "text-block") {
        const element = find.textBlock(target.id);
        return element ? frameBounds(element) : null;
      }
      if (target.type === "image") {
        const element = find.image(target.id);
        return element ? frameBounds(element) : null;
      }
      const card = find.card(target.id);
      return card ? cardBounds(card) : null;
    };
    /** A container's shown card rows, measured where rendered and laid out otherwise. */
    const containerCardSlots = (container: ContainerElement) => {
      const { cardLayout, cardBounds } = latest.current;
      const layout = cardLayout();
      const visibleTop = container.y + CONTAINER_HEADER_HEIGHT + searchRowHeight(container);
      const rowSize = containerRowSize(container);
      return layout.visible(container).map((card, index) => {
        const measured = cardBounds(card);
        const row = layout.rowPosition(container, index);
        return {
          card,
          left: measured?.left ?? row.x,
          top: measured?.top ?? row.y,
          width: measured?.width ?? rowSize.width,
          height: measured?.height ?? rowSize.height,
          visibleTop,
          visibleBottom: container.y + container.height,
        };
      });
    };

    const install = (
      extensionId: RetainedExtensionKey,
      point: Point,
      target: ExtensionDropTarget,
      bounds: DropBounds,
    ) => {
      const p = latest.current;
      const selection = p.selection();
      const targetIds = extensionDropTargetIds(target, selection, (id) => {
        const type = typeOf(id);
        return type !== null && isExtensionCompatible(extensionId, type);
      });
      if (!installRetainedViewExtension(p.callbacks, p.document(), extensionId, targetIds, uuids))
        return;
      p.closeContextMenus();
      if (!selection.includes(target.id)) p.select([target.id]);

      const showRipples = () => {
        for (const id of targetIds) {
          const primary = id === target.id;
          const type = primary ? target.type : typeOf(id);
          if (!type) continue;
          const rippleBounds = boundsOf({ type, id }) ?? (primary ? bounds : null);
          if (!rippleBounds) continue;
          // Other selected elements ripple from their centre; the drop target from the pointer.
          showRipple(
            primary
              ? point
              : {
                  x: rippleBounds.left + rippleBounds.width / 2,
                  y: rippleBounds.top + rippleBounds.height / 2,
                },
            rippleBounds,
          );
        }
      };
      // An adornment resizes the card, so its ripple waits for the next layout.
      if (addsCardAdornment(extensionId)) window.requestAnimationFrame(showRipples);
      else showRipples();
    };

    return (extensionId: RetainedExtensionKey, clientX: number, clientY: number) => {
      const p = latest.current;
      const point = p.canvasPoint(clientX, clientY);
      const hit = findExtensionDropTarget(point, {
        ...p.scene(),
        compatible: (type) => isExtensionCompatible(extensionId, type),
        cardBounds: p.cardBounds,
        looseCardFallbackBounds: p.looseCardEstimate,
        containerCardSlots,
      });
      if (hit) install(extensionId, point, hit.target, hit.bounds);
    };
  }, [showRipple]);

  return { drop, ripples: ripples.ripples };
}
