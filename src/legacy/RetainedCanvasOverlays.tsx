import { useMemo, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import type { ElementId } from "../domain/ids/entityIds";
import { MindMapPorts } from "../elements/mind-map/MindMapPorts";
import { TextCardRenderer, type TextCardActions } from "../elements/text-card/TextCardRenderer";
import { asTextCardRendererElement } from "../elements/text-card/textCardViewProjection";
import type { ExtensionCommands } from "../extensions/extensionCommands";
import type { MindmapBounds } from "../mindmapMath";
import type { MindmapPort, TextCardElement } from "../types";
import {
  getLegacyTextCardDragRenderPosition,
  isLegacyTextCardSpread,
} from "./interactions/legacyTextCardDragPresentation";
import type {
  LegacyTextCardInteractionService,
  LegacyTextCardRelease,
} from "./interactions/legacyTextCardInteraction";
import { useRetainedDocumentElements } from "./RetainedCanvasContext";
import { isOutsideContainerCardViewport } from "./containerCardLayout";

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
  /**
   * The text card drag, whose held cards are drawn above everything while they travel. The
   * overlay follows it itself, once per frame, so moving them never re-renders the canvas.
   */
  readonly heldCards: Pick<LegacyTextCardInteractionService, "getSnapshot" | "subscribe">;
  /** Text cards flying to their slots after a drop. */
  readonly releasedCards: LegacyTextCardRelease | null;
  /** The canvas band a container shows its card rows in (see containerCardViewport). */
  readonly cardViewportOf: (
    containerId: string,
  ) => { readonly top: number; readonly bottom: number } | null;
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
  cardViewportOf,
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
      <HeldCardsOverlay
        source={heldCards}
        layer={layer}
        cardById={cardById}
        renderElement={renderElement}
        outlinedIds={outlinedIds}
        shadowsUnderElements={shadowsUnderElements}
        cardActions={cardActions}
        extensionCommands={extensionCommands}
      />
      {releasedCards && (
        <CameraLayer className="z-[100]" {...layer}>
          {releasedCards.cards.map(({ card, from, to }) => {
            const element = renderElement(card.id);
            if (!element) return null;
            // A card settling into a row its container does not show (scrolled away or past its
            // bottom) slides under the container's edge instead of showing outside it.
            const viewport = card.containerId ? cardViewportOf(card.containerId) : null;
            const clip =
              viewport && isOutsideContainerCardViewport(to.y, viewport) ? viewport : null;
            const position = releasedCards.active ? to : from;
            const settling = (
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
                  position: clip ? { x: position.x, y: position.y - clip.top } : position,
                  motion: "settling",
                  interaction: "forced",
                  selected: outlinedIds.includes(card.id),
                  linksDisabled: true,
                  shadowsUnderElements,
                }}
              />
            );
            return clip ? (
              <div
                key={`release-clip-${card.id}`}
                data-release-clip
                style={{
                  position: "absolute",
                  left: 0,
                  top: clip.top,
                  width: layer.width,
                  height: clip.bottom - clip.top,
                  overflow: "hidden",
                }}
              >
                {settling}
              </div>
            ) : (
              settling
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

/**
 * The cards held by a text card drag. They sit at their offsets inside a group that follows the
 * held card, so a bundled card's own position only changes when it gathers into the stack or
 * spreads back into its arrangement, which it animates. Drag updates are drawn at most once per
 * frame; a render for any other reason shows the latest drag state.
 */
function HeldCardsOverlay({
  source,
  layer,
  cardById,
  renderElement,
  outlinedIds,
  shadowsUnderElements,
  cardActions,
  extensionCommands,
}: {
  readonly source: RetainedCanvasOverlaysProps["heldCards"];
  readonly layer: { readonly width: number; readonly height: number; readonly inset: number };
  readonly cardById: (id: string) => TextCardElement | undefined;
  readonly renderElement: (id: string) => ReturnType<typeof asTextCardRendererElement>;
  readonly outlinedIds: readonly string[];
  readonly shadowsUnderElements: boolean;
  readonly cardActions: TextCardActions;
  readonly extensionCommands: ExtensionCommands;
}) {
  const subscribeFrames = useMemo(
    () => (listener: () => void) => {
      let frame = 0;
      const unsubscribe = source.subscribe(() => {
        if (frame === 0) {
          frame = requestAnimationFrame(() => {
            frame = 0;
            listener();
          });
        }
      });
      return () => {
        unsubscribe();
        cancelAnimationFrame(frame);
      };
    },
    [source],
  );
  const heldCards = useSyncExternalStore(
    subscribeFrames,
    source.getSnapshot,
    source.getSnapshot,
  ).active;
  if (!heldCards) return null;
  const { current } = heldCards;
  return (
    <CameraLayer className="z-[100]" {...layer}>
      {/* Canvas-sized like the layer, so the cards keep their natural width inside it. */}
      <div
        data-held-cards
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: layer.width,
          height: layer.height,
          transform: `translate3d(${current.x}px, ${current.y}px, 0)`,
        }}
      >
        {heldCards.ids.map((id, bundleIndex) => {
          const card = cardById(id);
          const element = renderElement(id);
          if (!card || !element) return null;
          const offset = heldCards.offsets.find((candidate) => candidate.id === id);
          const position = getLegacyTextCardDragRenderPosition(heldCards, id);
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
                position: { x: position.x - current.x, y: position.y - current.y },
                drag: {
                  primary: id === heldCards.primaryId,
                  atTrueSize: heldCards.trueSize,
                  bundleIndex,
                  depth: offset?.depth ?? bundleIndex,
                  swayX: heldCards.sway.x,
                  swayY: heldCards.sway.y,
                  spread: isLegacyTextCardSpread(heldCards),
                  ...(heldCards.stackedAtPickup && offset
                    ? {
                        pickup: {
                          x: offset.formation.x - offset.x,
                          y: offset.formation.y - offset.y,
                        },
                      }
                    : {}),
                },
                selected: outlinedIds.includes(id),
                linksDisabled: true,
                shadowsUnderElements,
              }}
            />
          );
        })}
      </div>
    </CameraLayer>
  );
}
