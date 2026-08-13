import { Button } from "@mantine/core";
import type { PointerEvent } from "react";
import { BENCHMARK_GIF_DATA_URL } from "./benchmarkGifAsset";
import type { BenchmarkSceneStore } from "./benchmarkSceneStore";
import type { BenchmarkElementModel } from "./benchmarkTypes";

interface Props {
  element: BenchmarkElementModel;
  store: BenchmarkSceneStore;
  moveImage: boolean;
  showGif: boolean;
  onMovePointerDown: (event: PointerEvent) => void;
  onResizePointerDown: (event: PointerEvent) => void;
}

export function BenchmarkElementContent({
  element,
  store,
  moveImage,
  showGif,
  onMovePointerDown,
  onResizePointerDown,
}: Props) {
  return (
    <>
      <header className="renderer-benchmark__element-header" onPointerDown={onMovePointerDown}>
        <strong>
          {element.kind === "container"
            ? `Container ${element.ordinal + 1}`
            : `Text card ${element.ordinal + 1}`}
        </strong>
        <div className="renderer-benchmark__z-controls">
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => store.adjustElementZ(element.id, -1)}
          >
            Z -
          </Button>
          <output aria-label={`Element Z ${element.z}`}>{element.z}</output>
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => store.adjustElementZ(element.id, 1)}
          >
            Z +
          </Button>
        </div>
      </header>
      <div className="renderer-benchmark__element-body">
        <p>
          Ordinary DOM text with realistic wrapping, glyph rasterization, punctuation, and several
          lines of TaskMap-style working content.
        </p>
        {element.ordinal % 7 === 0 ? (
          <img
            className={
              moveImage ? "renderer-benchmark__image is-animated" : "renderer-benchmark__image"
            }
            src="/app-icon.png"
            alt="Animated benchmark image"
            draggable={false}
          />
        ) : null}
        {showGif && element.ordinal % 10 === 0 ? (
          <img
            className="renderer-benchmark__gif"
            src={BENCHMARK_GIF_DATA_URL}
            alt="Animated benchmark GIF"
            draggable={false}
          />
        ) : null}
      </div>
      {element.kind === "container" ? (
        <button
          className="renderer-benchmark__element-resize"
          aria-label="Resize container"
          onPointerDown={onResizePointerDown}
        />
      ) : null}
    </>
  );
}
