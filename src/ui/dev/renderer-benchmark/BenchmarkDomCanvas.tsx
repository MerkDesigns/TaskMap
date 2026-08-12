import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BenchmarkPresentation } from "./benchmarkPresentation";
import { BenchmarkGlassPanel } from "./BenchmarkGlassPanel";
import { BenchmarkSceneElement } from "./BenchmarkSceneElement";
import type { BenchmarkSceneStore } from "./benchmarkSceneStore";
import type { BenchmarkViewportController } from "./benchmarkViewportController";
import type { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";
import { useBenchmarkCanvasInput, type BenchmarkSpawnMenuRequest } from "./useBenchmarkCanvasInput";
import { useBenchmarkVisibleElements } from "./useBenchmarkVisibleElements";

interface Props {
  mode: "A" | "B";
  store: BenchmarkSceneStore;
  viewport: BenchmarkViewportController;
  version: number;
  runtime?: LiquidSceneBenchmarkRuntime;
  onPresentation: (presentation: BenchmarkPresentation | null) => void;
  onSpawnMenu: (request: BenchmarkSpawnMenuRequest | null) => void;
}

export function BenchmarkDomCanvas({
  mode,
  store,
  viewport,
  version,
  runtime,
  onPresentation,
  onSpawnMenu,
}: Props) {
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null);
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
      syncGlass(glass) {
        runtime?.syncGlass(glass);
      },
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
        runtime?.render();
      },
      getLiquidCounts: () =>
        runtime?.getCounts() ?? { html: 0, containers: 0, captureAvailable: false },
    }),
    [runtime, store],
  );

  useLayoutEffect(() => {
    if (moveCards) return;
    for (const node of elementNodes.current.values()) node.style.translate = "0px 0";
    cardsWereAnimating.current = false;
  }, [moveCards]);

  useBenchmarkCanvasInput(
    mode === "A" ? canvas : (runtime?.canvas ?? null),
    viewport,
    onSpawnMenu,
    setCameraActive,
  );
  useLayoutEffect(() => {
    viewport.bindPresenter(() => presentation.presentCamera(store.scene.camera));
    onPresentation(presentation);
    return () => {
      viewport.bindPresenter(null);
      onPresentation(null);
    };
  }, [onPresentation, presentation, store, viewport]);

  const content = (
    <div ref={setCanvas} className="renderer-benchmark__canvas" data-mode={mode}>
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
      {mode === "A" ? (
        <div className="renderer-benchmark__glass-layer">
          {store.scene.glasses.map((glass) => (
            <BenchmarkGlassPanel
              key={glass.id}
              glass={glass}
              store={store}
              presentation={presentation}
              liquidPositioned={false}
            />
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {mode === "B" && runtime?.coarseHost ? createPortal(content, runtime.coarseHost) : content}
      {mode === "B" && runtime
        ? store.scene.glasses.map((glass) => {
            const host = runtime.getGlassHost(glass.id);
            return host
              ? createPortal(
                  <BenchmarkGlassPanel
                    key={glass.id}
                    glass={glass}
                    store={store}
                    presentation={presentation}
                    liquidPositioned
                  />,
                  host,
                )
              : null;
          })
        : null}
    </>
  );
}
