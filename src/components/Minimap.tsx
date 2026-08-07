import { IconRotateClockwise } from "@tabler/icons-react";
import { getTextCardAccent, MINIMAP_MAX_SIZE } from "../constants";
import { getMindmapConnectionPath, getMindmapPortPoint } from "../mindmapMath";
import { createMinimapProjection } from "../features/minimap/minimapProjection";
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
};

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
}: MinimapProps) {
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

  return (
    <div
      className={`frosted-glass fixed bottom-4 right-4 z-20 rounded-xl border border-white/[0.15] bg-[#1b1b1e]/88 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-sm transition-opacity duration-500 ${
        visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="mb-1 flex items-center gap-2 pl-1 text-[11px] font-medium text-white/70">
        <span>{Math.round(zoom * 100)}%</span>
        <button
          className="pointer-events-auto grid h-5 w-5 place-items-center rounded text-white/45 hover:bg-white/[0.10] hover:text-white/75"
          onClick={onResetZoom}
          title="Reset zoom"
        >
          <IconRotateClockwise size={14} stroke={2} />
        </button>
      </div>
      <div
        className="pointer-events-none relative overflow-hidden rounded-md"
        style={{ width: minimapWidth, height: minimapHeight }}
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
          className="absolute rounded-[2px] border border-[#c8dae8]/85 bg-[#7aa2c8]/10"
          style={{
            left: projection.viewport.x,
            top: projection.viewport.y,
            width: projection.viewport.width,
            height: projection.viewport.height,
          }}
        />
      </div>
    </div>
  );
}
