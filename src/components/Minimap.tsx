import { IconRotateClockwise } from "@tabler/icons-react";
import { memo, useLayoutEffect, useRef } from "react";
import type { CanvasInteractionController } from "../app/interactions/canvasInteractionController";
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
  viewportService?: CanvasInteractionController;
};

type LiveMinimapProps = Omit<MinimapProps, "viewportWorld" | "zoom"> & {
  viewportService: CanvasInteractionController;
};

export const LiveMinimap = memo(function LiveMinimap({
  viewportService,
  ...props
}: LiveMinimapProps) {
  const viewport = viewportService.getSnapshot().viewport;

  return (
    <Minimap
      {...props}
      viewportService={viewportService}
      zoom={viewport.zoom}
      viewportWorld={viewportWorldRectangle(viewport)}
    />
  );
});

export function Minimap({
  elements,
  textBlocks,
  textCards,
  images,
  mindmapConnections,
  canvasWidth,
  canvasHeight,
  visible,
  zoom,
  viewportWorld,
  onResetZoom,
  viewportService,
}: MinimapProps) {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  const zoomLabelRef = useRef<HTMLSpanElement | null>(null);
  const viewportIndicatorRef = useRef<HTMLDivElement | null>(null);
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

  useLayoutEffect(() => {
    if (!viewportService) return;

    const updateViewport = () => {
      const viewport = viewportService.getSnapshot().viewport;
      if (zoomLabelRef.current) {
        zoomLabelRef.current.textContent = `${Math.round(viewport.zoom * 100)}%`;
      }
      const projectedViewport = createMinimapProjection(
        { width: canvasWidth, height: canvasHeight },
        viewportWorldRectangle(viewport),
        [],
        MINIMAP_MAX_SIZE,
      ).viewport;
      const indicator = viewportIndicatorRef.current;
      if (!indicator) return;
      indicator.style.left = `${projectedViewport.x}px`;
      indicator.style.top = `${projectedViewport.y}px`;
      indicator.style.width = `${projectedViewport.width}px`;
      indicator.style.height = `${projectedViewport.height}px`;
    };

    updateViewport();
    return viewportService.subscribe(updateViewport);
  }, [canvasHeight, canvasWidth, viewportService]);

  return (
    <MinimapSurface
      visible={visible}
      data-minimap-render-count={import.meta.env.DEV ? renderCountRef.current : undefined}
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
