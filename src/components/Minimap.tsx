import { IconRotateClockwise } from "@tabler/icons-react";
import { getTextCardAccent, MINIMAP_MAX_SIZE } from "../constants";
import { ContainerElement, ImageElement, TextBlockElement, TextCardElement } from "../types";

const TEXT_CARD_PREVIEW_WIDTH = 220;
const TEXT_CARD_PREVIEW_HEIGHT = 52;

type MinimapProps = {
  elements: ContainerElement[];
  textBlocks: TextBlockElement[];
  textCards: TextCardElement[];
  images: ImageElement[];
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

  return (
    <div
      className={`fixed bottom-4 right-4 z-20 rounded-md border border-white/10 bg-[#15171c]/58 p-2 shadow-[0_12px_34px_rgba(0,0,0,0.32)] backdrop-blur-md transition-opacity duration-500 ${
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
          return (
            <div
              key={card.id}
              className="absolute rounded-[2px] border"
              style={{
                left: (card.x / canvasWidth) * minimapWidth,
                top: (card.y / canvasHeight) * minimapHeight,
                width: Math.max((TEXT_CARD_PREVIEW_WIDTH / canvasWidth) * minimapWidth, 3),
                height: Math.max((TEXT_CARD_PREVIEW_HEIGHT / canvasHeight) * minimapHeight, 3),
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
