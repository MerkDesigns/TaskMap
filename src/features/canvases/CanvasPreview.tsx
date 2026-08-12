import type { CanvasRecord, DocumentElement } from "../../domain/document/documentTypes";

export interface CanvasPreviewProps {
  readonly canvas: CanvasRecord;
  readonly elements: readonly DocumentElement[];
}

export function CanvasPreview({ canvas, elements }: CanvasPreviewProps) {
  const width = canvas.settings.width;
  const height = canvas.settings.height;
  const scale = Math.min(88 / width, 56 / height);
  const offsetX = (96 - width * scale) / 2;
  const offsetY = (64 - height * scale) / 2;

  return (
    <svg className="taskmap-canvas-preview" viewBox="0 0 96 64" aria-hidden="true">
      <rect x="0" y="0" width="96" height="64" rx="6" className="taskmap-canvas-preview__bg" />
      <rect
        x={offsetX}
        y={offsetY}
        width={width * scale}
        height={height * scale}
        className="taskmap-canvas-preview__bounds"
      />
      {elements.slice(0, 80).map((element) => {
        const geometry = element.geometry;
        return (
          <rect
            key={element.id}
            x={offsetX + geometry.x * scale}
            y={offsetY + geometry.y * scale}
            width={Math.max(1, geometry.width * scale)}
            height={Math.max(1, geometry.height * scale)}
            rx="1"
            className={
              element.type.includes("container")
                ? "taskmap-canvas-preview__container"
                : "taskmap-canvas-preview__element"
            }
          />
        );
      })}
    </svg>
  );
}
