import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { BenchmarkPresentation } from "./benchmarkPresentation";
import { BenchmarkSceneElement } from "./BenchmarkSceneElement";
import type { BenchmarkSceneStore } from "./benchmarkSceneStore";
import type { BenchmarkViewportController } from "./benchmarkViewportController";
import type { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";
import { useBenchmarkCanvasInput, type BenchmarkSpawnMenuRequest } from "./useBenchmarkCanvasInput";
import { useBenchmarkVisibleElements } from "./useBenchmarkVisibleElements";

interface Props {
  store: BenchmarkSceneStore;
  viewport: BenchmarkViewportController;
  version: number;
  runtime: LiquidSceneBenchmarkRuntime;
  onPresentation: (presentation: BenchmarkPresentation | null) => void;
  onSpawnMenu: (request: BenchmarkSpawnMenuRequest | null) => void;
}

export function BenchmarkDomCanvas({
  store,
  viewport,
  version,
  runtime,
  onPresentation,
  onSpawnMenu,
}: Props) {
  const worldRef = useRef<HTMLDivElement>(null);
  const elementNodes = useRef(new Map<string, HTMLElement>());
  const cardsWereAnimating = useRef(false);
  const lastGridZoom = useRef<number | null>(null);
  const moveCards = store.scene.animations.moveCards;
  const { elements, pinElement } = useBenchmarkVisibleElements(store, viewport, version);
  const registerElement = useCallback((id: string, element: HTMLElement | null) => {
    if (element) elementNodes.current.set(id, element);
    else elementNodes.current.delete(id);
  }, []);
  const setCameraActive = useCallback((active: boolean) => {
    if (worldRef.current) worldRef.current.style.willChange = active ? "transform" : "auto";
  }, []);

  const presentation = useMemo<BenchmarkPresentation>(
    () => ({
      presentCamera(current) {
        if (!worldRef.current) return;
        worldRef.current.style.transform = `translate3d(${current.pan.x}px, ${current.pan.y}px, 0) scale(${current.zoom})`;
        if (lastGridZoom.current !== current.zoom) {
          worldRef.current.style.setProperty(
            "--renderer-benchmark-dot-size",
            `${1.25 / current.zoom}px`,
          );
          lastGridZoom.current = current.zoom;
        }
      },
      syncElement() {},
      tick(now) {
        const active = store.scene.animations.moveCards;
        if (active || cardsWereAnimating.current) {
          for (const element of store.scene.elements) {
            const node = elementNodes.current.get(element.id);
            if (!node) continue;
            const offset =
              active && element.ordinal % 5 === 0 ? Math.sin(now / 520 + element.ordinal) * 34 : 0;
            node.style.translate = `${offset}px 0`;
          }
        }
        cardsWereAnimating.current = active;
        runtime.tick(now);
      },
      getLiquidCounts: () => runtime.getCounts(),
      resetLiquidCounts: () => runtime.resetCounters(),
    }),
    [runtime, store],
  );

  useLayoutEffect(() => {
    if (moveCards) return;
    for (const node of elementNodes.current.values()) node.style.translate = "0px 0";
    cardsWereAnimating.current = false;
  }, [moveCards]);

  useBenchmarkCanvasInput(runtime.canvas, viewport, onSpawnMenu, setCameraActive);
  useLayoutEffect(() => {
    viewport.bindPresenter(() => presentation.presentCamera(store.scene.camera));
    onPresentation(presentation);
    return () => {
      viewport.bindPresenter(null);
      onPresentation(null);
    };
  }, [onPresentation, presentation, store, viewport]);

  const content = (
    <div
      className="renderer-benchmark__canvas"
      data-active-benchmark-canvas={store.scene.activeCanvasCardId}
    >
      <div ref={worldRef} className="renderer-benchmark__world">
        {elements.map((element) => (
          <BenchmarkSceneElement
            key={element.id}
            element={element}
            store={store}
            presentation={presentation}
            liquidPositioned={false}
            moveImage={store.scene.animations.moveImage}
            showGif={store.scene.animations.showGif}
            registerElement={registerElement}
            onGesturePin={pinElement}
          />
        ))}
      </div>
    </div>
  );

  return createPortal(content, runtime.coarseHost);
}
