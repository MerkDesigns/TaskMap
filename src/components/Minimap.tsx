import { IconRotateClockwise } from "@tabler/icons-react";
import { useLayoutEffect, useRef, type PointerEvent } from "react";
import type { CanvasInteractionController } from "../app/interactions/canvasInteractionTypes";
import { viewportWorldRectangle } from "../canvas/geometry/viewportMath";
import { getTextCardAccent, MINIMAP_MAX_SIZE } from "../constants";
import { getMindmapConnectionPath, getMindmapPortPoint } from "../mindmapMath";
import { createMinimapProjection } from "../features/minimap/minimapProjection";
import { IconButton } from "../ui/primitives";
import { MinimapSurface, MinimapViewport } from "../ui/patterns/workspace";
import {
  ContainerElement,
  ImageElement,
  MindmapConnection,
  TextBlockElement,
  TextCardElement,
} from "../types";

const TEXT_CARD_PREVIEW_WIDTH = 220;
const TEXT_CARD_PREVIEW_HEIGHT = 52;

type MinimapProps = {
  controller?: CanvasInteractionController;
  elements: ContainerElement[];
  textBlocks: TextBlockElement[];
  textCards: TextCardElement[];
  images: ImageElement[];
  mindmapConnections: MindmapConnection[];
  canvasWidth: number;
  canvasHeight: number;
  visible: boolean;
  zoom: number;
  viewportWorld: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  onResetZoom: () => void;
  /** The minimap fades out after camera changes; it is held visible while hovered or dragged. */
  onHoldChange?: (held: boolean) => void;
};

export function Minimap({
  controller,
  elements,
  textBlocks,
  textCards,
  images,
  mindmapConnections,
  canvasWidth,
  canvasHeight,
  visible,
  zoom: settledZoom,
  viewportWorld: settledViewportWorld,
  onResetZoom,
  onHoldChange,
}: MinimapProps) {
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const viewportIndicatorRef = useRef<HTMLDivElement>(null);
  const camera = controller?.getSnapshot().viewport;
  const zoom = camera?.zoom ?? settledZoom;
  const viewportWorld = camera ? viewportWorldRectangle(camera) : settledViewportWorld;
  const cardGeometry = textCards.map((card) => {
    const longestLineLength = Math.max(1, ...card.text.split("\n").map((line) => line.length));
    const lineCount = card.text
      .split("\n")
      .reduce((count, line) => count + Math.max(1, Math.ceil((line.length * 9) / 472)), 0);
    return {
      id: card.id,
      geometry: {
        x: card.x,
        y: card.y,
        width:
          card.kind === "mindmap"
            ? Math.max(44, Math.min(520, longestLineLength * 9 + 48))
            : TEXT_CARD_PREVIEW_WIDTH,
        height: card.kind === "mindmap" ? 43 + (lineCount - 1) * 24 : TEXT_CARD_PREVIEW_HEIGHT,
      },
      minimumPixels: 3,
    };
  });
  const projection = createMinimapProjection(
    { width: canvasWidth, height: canvasHeight },
    viewportWorld,
    [
      ...elements.map((element) => ({ id: element.id, geometry: element, minimumPixels: 4 })),
      ...textBlocks.map((element) => ({ id: element.id, geometry: element, minimumPixels: 4 })),
      ...cardGeometry,
      ...images.map((image) => ({ id: image.id, geometry: image, minimumPixels: 3 })),
    ],
    MINIMAP_MAX_SIZE,
  );
  const scaledConnectables = projection.elements;
  const minimapWidth = projection.size.width;
  const minimapHeight = projection.size.height;
  // While the viewport indicator is dragged: the grab point's offset from the camera centre, in
  // world units, so the indicator follows the pointer without jumping under it.
  const navigationRef = useRef<{ pointerId: number; offset: { x: number; y: number } } | null>(
    null,
  );
  const hoveredRef = useRef(false);
  const heldRef = useRef(false);
  const updateHold = () => {
    const held = hoveredRef.current || navigationRef.current !== null;
    if (held === heldRef.current) return;
    heldRef.current = held;
    onHoldChange?.(held);
  };

  const worldAt = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvasWidth,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvasHeight,
    };
  };

  // Pressing the map centres the camera there; pressing the indicator grabs it. Either way the
  // camera then follows the drag, and is remembered once when it ends.
  const startNavigation = (event: PointerEvent<HTMLElement>) => {
    if (!controller || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const world = worldAt(event);
    const camera = viewportWorldRectangle(controller.getSnapshot().viewport);
    const grabbed =
      world.x >= camera.x &&
      world.x <= camera.x + camera.width &&
      world.y >= camera.y &&
      world.y <= camera.y + camera.height;
    const offset = grabbed
      ? { x: world.x - (camera.x + camera.width / 2), y: world.y - (camera.y + camera.height / 2) }
      : { x: 0, y: 0 };
    navigationRef.current = { pointerId: event.pointerId, offset };
    updateHold();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.navigating = "";
    if (!grabbed) controller.centerOn(world, false);
  };
  const followNavigation = (event: PointerEvent<HTMLElement>, settled: boolean) => {
    const navigation = navigationRef.current;
    if (!controller || navigation?.pointerId !== event.pointerId) return;
    const world = worldAt(event);
    controller.centerOn(
      { x: world.x - navigation.offset.x, y: world.y - navigation.offset.y },
      settled,
    );
    if (!settled) return;
    navigationRef.current = null;
    updateHold();
    delete event.currentTarget.dataset.navigating;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useLayoutEffect(() => {
    if (!controller) return;
    let previous = controller.getSnapshot().viewport;
    const present = () => {
      const viewport = controller.getSnapshot().viewport;
      if (viewport === previous) return;
      previous = viewport;
      const bounds = viewportWorldRectangle(viewport);
      const indicator = viewportIndicatorRef.current;
      if (indicator) {
        indicator.style.left = `${(bounds.x / Math.max(1, canvasWidth)) * minimapWidth}px`;
        indicator.style.top = `${(bounds.y / Math.max(1, canvasHeight)) * minimapHeight}px`;
        indicator.style.width = `${Math.min(minimapWidth, Math.max(0, (bounds.width / Math.max(1, canvasWidth)) * minimapWidth))}px`;
        indicator.style.height = `${Math.min(minimapHeight, Math.max(0, (bounds.height / Math.max(1, canvasHeight)) * minimapHeight))}px`;
      }
      if (zoomLabelRef.current) {
        zoomLabelRef.current.textContent = `${Math.round(viewport.zoom * 100)}%`;
      }
    };
    return controller.subscribe(present);
  }, [controller, canvasWidth, canvasHeight, minimapWidth, minimapHeight]);

  return (
    <MinimapSurface
      visible={visible}
      onPointerEnter={() => {
        hoveredRef.current = true;
        updateHold();
      }}
      onPointerLeave={() => {
        hoveredRef.current = false;
        updateHold();
      }}
    >
      <div className="taskmap-minimap-header">
        <span ref={zoomLabelRef} className="taskmap-minimap-zoom">
          {Math.round(zoom * 100)}%
        </span>
        <IconButton
          className="taskmap-minimap-reset"
          variant="ghost"
          size="compact"
          aria-label="Reset zoom"
          onClick={onResetZoom}
          title="Reset zoom"
          icon={<IconRotateClockwise size={14} stroke={2} />}
        />
      </div>
      <MinimapViewport
        style={{ width: minimapWidth, height: minimapHeight }}
        data-minimap-viewport-surface
        data-navigable={controller ? true : undefined}
        onPointerDown={startNavigation}
        onPointerMove={(event) => followNavigation(event, false)}
        onPointerUp={(event) => followNavigation(event, true)}
        onPointerCancel={(event) => followNavigation(event, true)}
      >
        <svg
          className="absolute inset-0 overflow-visible"
          width={minimapWidth}
          height={minimapHeight}
        >
          {mindmapConnections.map((connection) => {
            const source = scaledConnectables.get(connection.sourceId);
            const target = scaledConnectables.get(connection.targetId);
            if (!source || !target) return null;
            return (
              <path
                key={connection.id}
                d={getMindmapConnectionPath(
                  getMindmapPortPoint(source, connection.sourcePort),
                  connection.sourcePort,
                  getMindmapPortPoint(target, connection.targetPort),
                  connection.targetPort,
                )}
                fill="none"
                stroke="rgba(220, 226, 235, 0.52)"
                strokeWidth={0.8}
              />
            );
          })}
        </svg>
        {elements.map((element) => (
          <div
            key={element.id}
            className="absolute rounded-[2px] border"
            data-minimap-element="container"
            data-minimap-id={element.id}
            style={{
              left: projection.elements.get(element.id)?.x,
              top: projection.elements.get(element.id)?.y,
              width: projection.elements.get(element.id)?.width,
              height: projection.elements.get(element.id)?.height,
              borderColor: element.accent,
              backgroundColor: `${element.accent}26`,
            }}
          />
        ))}
        {textBlocks.map((element) => (
          <div
            key={element.id}
            className="absolute rounded-[2px] border"
            data-minimap-element="text-block"
            data-minimap-id={element.id}
            style={{
              left: projection.elements.get(element.id)?.x,
              top: projection.elements.get(element.id)?.y,
              width: projection.elements.get(element.id)?.width,
              height: projection.elements.get(element.id)?.height,
              borderColor: element.accent,
              backgroundColor: `${element.accent}26`,
            }}
          />
        ))}
        {textCards.map((card) => {
          const accent = getTextCardAccent(card.accent);
          const bounds = projection.elements.get(card.id);
          return (
            <div
              key={card.id}
              className="absolute rounded-[2px] border"
              data-minimap-element="text-card"
              data-minimap-id={card.id}
              style={{
                left: bounds?.x,
                top: bounds?.y,
                width: bounds?.width,
                height: bounds?.height,
                borderColor: accent,
                backgroundColor: `${accent}26`,
              }}
            />
          );
        })}
        {images.map((image) => (
          <div
            key={image.id}
            className="absolute rounded-[2px] border"
            data-minimap-element="image"
            data-minimap-id={image.id}
            style={{
              left: projection.elements.get(image.id)?.x,
              top: projection.elements.get(image.id)?.y,
              width: projection.elements.get(image.id)?.width,
              height: projection.elements.get(image.id)?.height,
              borderColor: image.accent,
              backgroundColor: `${image.accent}26`,
            }}
          />
        ))}
        <div
          ref={viewportIndicatorRef}
          className="taskmap-minimap-viewport-indicator absolute rounded-[2px] border"
          data-minimap-viewport-indicator
          style={{
            left: projection.viewport.x,
            top: projection.viewport.y,
            width: projection.viewport.width,
            height: projection.viewport.height,
          }}
        />
      </MinimapViewport>
    </MinimapSurface>
  );
}
