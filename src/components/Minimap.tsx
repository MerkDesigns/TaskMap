import { IconRotateClockwise } from "@tabler/icons-react";
import { getTextCardAccent, MINIMAP_MAX_SIZE } from "../constants";
import { getMindmapConnectionPath, getMindmapPortPoint } from "../mindmapMath";
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
  viewport: {
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
  viewport,
  onResetZoom,
}: MinimapProps) {
  const canvasAspect = canvasWidth / canvasHeight;
  const minimapWidth =
    canvasAspect >= 1
      ? MINIMAP_MAX_SIZE
      : Math.max(72, Math.round(MINIMAP_MAX_SIZE * canvasAspect));
  const minimapHeight =
    canvasAspect >= 1
      ? Math.max(72, Math.round(MINIMAP_MAX_SIZE / canvasAspect))
      : MINIMAP_MAX_SIZE;
  const scaledMindmaps = new Map(
    textCards
      .filter((card) => card.kind === "mindmap")
      .map((card) => {
        const longestLineLength = Math.max(1, ...card.text.split("\n").map((line) => line.length));
        const width = Math.max(44, Math.min(520, longestLineLength * 9 + 48));
        const lineCount = card.text
          .split("\n")
          .reduce((count, line) => count + Math.max(1, Math.ceil((line.length * 9) / 472)), 0);
        const height = 43 + (lineCount - 1) * 24;
        return [
          card.id,
          {
            x: (card.x / canvasWidth) * minimapWidth,
            y: (card.y / canvasHeight) * minimapHeight,
            width: Math.max((width / canvasWidth) * minimapWidth, 3),
            height: Math.max((height / canvasHeight) * minimapHeight, 3),
          },
        ] as const;
      }),
  );
  const scaledConnectables = new Map(scaledMindmaps);
  [...elements, ...textBlocks, ...images].forEach((element) => {
    scaledConnectables.set(element.id, {
      x: (element.x / canvasWidth) * minimapWidth,
      y: (element.y / canvasHeight) * minimapHeight,
      width: Math.max((element.width / canvasWidth) * minimapWidth, 3),
      height: Math.max((element.height / canvasHeight) * minimapHeight, 3),
    });
  });

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
              left: (element.x / canvasWidth) * minimapWidth,
              top: (element.y / canvasHeight) * minimapHeight,
              width: Math.max((element.width / canvasWidth) * minimapWidth, 4),
              height: Math.max((element.height / canvasHeight) * minimapHeight, 4),
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
              left: (element.x / canvasWidth) * minimapWidth,
              top: (element.y / canvasHeight) * minimapHeight,
              width: Math.max((element.width / canvasWidth) * minimapWidth, 4),
              height: Math.max((element.height / canvasHeight) * minimapHeight, 4),
              borderColor: element.accent,
              backgroundColor: `${element.accent}26`,
            }}
          />
        ))}
        {textCards.map((card) => {
          const accent = getTextCardAccent(card.accent);
          const mindmap = scaledMindmaps.get(card.id);
          return (
            <div
              key={card.id}
              className="absolute rounded-[2px] border"
              style={{
                left: mindmap?.x ?? (card.x / canvasWidth) * minimapWidth,
                top: mindmap?.y ?? (card.y / canvasHeight) * minimapHeight,
                width:
                  mindmap?.width ??
                  Math.max((TEXT_CARD_PREVIEW_WIDTH / canvasWidth) * minimapWidth, 3),
                height:
                  mindmap?.height ??
                  Math.max((TEXT_CARD_PREVIEW_HEIGHT / canvasHeight) * minimapHeight, 3),
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
              left: (image.x / canvasWidth) * minimapWidth,
              top: (image.y / canvasHeight) * minimapHeight,
              width: Math.max((image.width / canvasWidth) * minimapWidth, 3),
              height: Math.max((image.height / canvasHeight) * minimapHeight, 3),
              borderColor: image.accent,
              backgroundColor: `${image.accent}26`,
            }}
          />
        ))}
        <div
          className="absolute rounded-[2px] border border-[#c8dae8]/85 bg-[#7aa2c8]/10"
          style={{
            left: viewport.x,
            top: viewport.y,
            width: viewport.width,
            height: viewport.height,
          }}
        />
      </div>
    </div>
  );
}
