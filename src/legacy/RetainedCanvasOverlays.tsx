import type { PointerEvent, ReactNode } from "react";
import type { ElementId } from "../domain/ids/entityIds";
import { MindMapPorts } from "../elements/mind-map/MindMapPorts";
import { TextCardRenderer, type TextCardActions } from "../elements/text-card/TextCardRenderer";
import { asTextCardRendererElement } from "../elements/text-card/textCardViewProjection";
import type { ExtensionCommands } from "../extensions/extensionCommands";
import type { MindmapBounds } from "../mindmapMath";
import type { MindmapPort, TextCardElement } from "../types";
import { getLegacyTextCardDragRenderPosition } from "./interactions/legacyTextCardDragPresentation";
import type {
  LegacyTextCardPresentation,
  LegacyTextCardRelease,
} from "./interactions/legacyTextCardInteraction";
import { useRetainedDocumentElements } from "./RetainedCanvasContext";

/**
 * A layer that moves with the camera like the canvas content, above it, for things drawn over
 * every element. `inset` matches the canvas frame's content inset.
 */
function CameraLayer({
  className,
  width,
  height,
  inset,
  children,
}: {
  readonly className: string;
  readonly width: number;
  readonly height: number;
  readonly inset: number;
  readonly children: ReactNode;
}) {
  return (
    <div
      className={`pointer-events-none absolute left-0 top-0 ${className} overflow-visible`}
      data-camera-layer
      style={{
        width,
        height,
        transform: `var(--taskmap-camera-transform) translate3d(${inset}px, ${inset}px, 0)`,
        transformOrigin: "0 0",
      }}
    >
      {children}
    </div>
  );
}

export interface ConnectionDragPreview {
  readonly sourceId: string;
  readonly sourcePort: MindmapPort;
  readonly targetId?: string;
  readonly targetPort?: MindmapPort;
}

export interface RetainedCanvasOverlaysProps {
  readonly canvasSize: { readonly width: number; readonly height: number };
  readonly contentInset: number;
  /** Text cards held by the pointer, drawn above everything while they travel. */
  readonly heldCards: LegacyTextCardPresentation | null;
  /** Text cards flying to their slots after a drop. */
  readonly releasedCards: LegacyTextCardRelease | null;
  readonly cardById: (id: string) => TextCardElement | undefined;
  readonly outlinedIds: readonly string[];
  readonly shadowsUnderElements: boolean;
  readonly cardActions: TextCardActions;
  readonly extensionCommands: ExtensionCommands;
  /** Connectable elements while connection mode shows their ports, or null outside it. */
  readonly connectionPorts: {
    readonly bounds: ReadonlyMap<string, MindmapBounds>;
    readonly accentOf: (ownerId: string) => string;
    readonly drag: ConnectionDragPreview | null;
    readonly onStartConnection: (
      event: PointerEvent<HTMLButtonElement>,
      ownerId: string,
      port: MindmapPort,
    ) => void;
  } | null;
}

/** What the canvas draws above its elements: held and released text cards, connection ports. */
export function RetainedCanvasOverlays({
  canvasSize,
  contentInset,
  heldCards,
  releasedCards,
  cardById,
  outlinedIds,
  shadowsUnderElements,
  cardActions,
  extensionCommands,
  connectionPorts,
}: RetainedCanvasOverlaysProps) {
  const documentElements = useRetainedDocumentElements();
  const layer = { width: canvasSize.width, height: canvasSize.height, inset: contentInset };
  const renderElement = (id: string) =>
    asTextCardRendererElement(documentElements[id as ElementId]);

  return (
    <>
      {heldCards && (
        <CameraLayer className="z-[100]" {...layer}>
          {heldCards.ids.map((id, bundleIndex) => {
            const card = cardById(id);
            const element = renderElement(id);
            if (!card || !element) return null;
            const offset = heldCards.offsets.find((candidate) => candidate.id === id);
            return (
              <TextCardRenderer
                key={`drag-overlay-${id}`}
                element={element}
                actions={cardActions}
                extensionCommands={extensionCommands}
                view={{
                  layer: card.layer ?? 0,
                  extensions: card.extensions,
                  editing: false,
                  draft: "",
                  position: getLegacyTextCardDragRenderPosition(heldCards, id),
                  drag: {
                    primary: id === heldCards.primaryId,
                    atTrueSize: heldCards.trueSize,
                    bundleIndex,
                    pickupX: offset?.pickupX ?? 0,
                    pickupY: offset?.pickupY ?? 0,
                    swayX: heldCards.sway.x,
                    swayY: heldCards.sway.y,
                  },
                  selected: outlinedIds.includes(id),
                  linksDisabled: true,
                  shadowsUnderElements,
                }}
              />
            );
          })}
        </CameraLayer>
      )}
      {releasedCards && (
        <CameraLayer className="z-[100]" {...layer}>
          {releasedCards.cards.map(({ card, from, to }) => {
            const element = renderElement(card.id);
            if (!element) return null;
            return (
              <TextCardRenderer
                key={`release-overlay-${card.id}`}
                element={element}
                actions={cardActions}
                extensionCommands={extensionCommands}
                view={{
                  layer: card.layer ?? 0,
                  extensions: card.extensions,
                  editing: false,
                  draft: "",
                  position: releasedCards.active ? to : from,
                  motion: "settling",
                  interaction: "forced",
                  selected: outlinedIds.includes(card.id),
                  linksDisabled: true,
                  shadowsUnderElements,
                }}
              />
            );
          })}
        </CameraLayer>
      )}
      {connectionPorts && (
        <CameraLayer className="z-[110]" {...layer}>
          {Array.from(connectionPorts.bounds.entries()).map(([ownerId, bounds]) => {
            const { drag } = connectionPorts;
            return (
              <div
                key={ownerId}
                className="pointer-events-none absolute"
                style={{
                  left: bounds.x,
                  top: bounds.y,
                  width: bounds.width,
                  height: bounds.height,
                }}
              >
                <MindMapPorts
                  ownerId={ownerId}
                  accent={connectionPorts.accentOf(ownerId)}
                  connectionMode
                  activeSourcePort={drag?.sourceId === ownerId ? drag.sourcePort : undefined}
                  activeTargetPort={drag?.targetId === ownerId ? drag.targetPort : undefined}
                  onStartConnection={connectionPorts.onStartConnection}
                />
              </div>
            );
          })}
        </CameraLayer>
      )}
    </>
  );
}
