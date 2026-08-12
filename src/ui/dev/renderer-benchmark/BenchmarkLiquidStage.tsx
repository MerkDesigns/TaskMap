import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BenchmarkPresentation } from "./benchmarkPresentation";
import { BenchmarkDomCanvas } from "./BenchmarkDomCanvas";
import { BenchmarkGlassPanel } from "./BenchmarkGlassPanel";
import { BenchmarkSceneElement } from "./BenchmarkSceneElement";
import type { BenchmarkSceneStore } from "./benchmarkSceneStore";
import type { BenchmarkViewportController } from "./benchmarkViewportController";
import { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";
import { useBenchmarkCanvasInput, type BenchmarkSpawnMenuRequest } from "./useBenchmarkCanvasInput";
import { useBenchmarkVisibleElements } from "./useBenchmarkVisibleElements";

interface Props {
  mode: "B" | "C";
  store: BenchmarkSceneStore;
  viewport: BenchmarkViewportController;
  version: number;
  metricsEnabled: boolean;
  reportCapture: (width: number | null, height: number | null) => void;
  onPresentation: (presentation: BenchmarkPresentation | null) => void;
  onSpawnMenu: (request: BenchmarkSpawnMenuRequest | null) => void;
}

export function BenchmarkLiquidStage(props: Props) {
  return props.mode === "B" ? <CoarseLiquidStage {...props} /> : <LiquidGroupStage {...props} />;
}

function useLiquidRuntime(
  mode: "B" | "C",
  reportCapture: Props["reportCapture"],
  metricsEnabled: boolean,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<LiquidSceneBenchmarkRuntime | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const next = new LiquidSceneBenchmarkRuntime(mode, reportCapture);
    host.append(next.canvas);
    next.resize(host.clientWidth, host.clientHeight);
    setRuntime(next);
    const observer = new ResizeObserver(() => next.resize(host.clientWidth, host.clientHeight));
    observer.observe(host);
    return () => {
      observer.disconnect();
      setRuntime(null);
      next.destroy();
      next.canvas.remove();
    };
  }, [mode, reportCapture]);

  useLayoutEffect(() => {
    runtime?.setCaptureInstrumentation(metricsEnabled);
  }, [metricsEnabled, runtime]);
  return { hostRef, runtime };
}

function CoarseLiquidStage(props: Props) {
  const { store, viewport, version, metricsEnabled, reportCapture, onPresentation, onSpawnMenu } =
    props;
  const { hostRef, runtime } = useLiquidRuntime("B", reportCapture, metricsEnabled);
  const [, setRuntimeRevision] = useState(0);

  useLayoutEffect(() => {
    if (!runtime) return;
    runtime.reconcile(store.scene);
    setRuntimeRevision((value) => value + 1);
  }, [runtime, store, version]);

  return (
    <div ref={hostRef} className="renderer-benchmark__liquid-stage" data-mode="B">
      {runtime ? (
        <BenchmarkDomCanvas
          mode="B"
          store={store}
          viewport={viewport}
          version={version}
          runtime={runtime}
          onPresentation={onPresentation}
          onSpawnMenu={onSpawnMenu}
        />
      ) : null}
    </div>
  );
}

function LiquidGroupStage(props: Props) {
  const { store, viewport, version, metricsEnabled, reportCapture, onPresentation, onSpawnMenu } =
    props;
  const { hostRef, runtime } = useLiquidRuntime("C", reportCapture, metricsEnabled);
  const { elements, pinElement } = useBenchmarkVisibleElements(store, viewport, version);
  const [, setRuntimeRevision] = useState(0);

  useLayoutEffect(() => {
    if (!runtime) return;
    runtime.reconcile(store.scene, elements);
    setRuntimeRevision((value) => value + 1);
  }, [elements, runtime, store, version]);

  const presentation = useMemo<BenchmarkPresentation | null>(
    () =>
      runtime
        ? {
            presentCamera(current) {
              runtime.presentCamera(current);
            },
            syncElement(element) {
              runtime.syncElement(element);
            },
            syncGlass(glass) {
              runtime.syncGlass(glass);
            },
            tick(now) {
              runtime.animate(now, store.scene);
              runtime.render();
            },
            getLiquidCounts: () => runtime.getCounts(),
          }
        : null,
    [runtime, store],
  );

  useBenchmarkCanvasInput(runtime?.canvas ?? null, viewport, onSpawnMenu);
  useLayoutEffect(() => {
    if (!presentation) return;
    viewport.bindPresenter(() => presentation.presentCamera(store.scene.camera));
    onPresentation(presentation);
    return () => {
      viewport.bindPresenter(null);
      onPresentation(null);
    };
  }, [onPresentation, presentation, store, viewport]);

  return (
    <div ref={hostRef} className="renderer-benchmark__liquid-stage" data-mode="C">
      {runtime?.backgroundHost
        ? createPortal(
            <div className="renderer-benchmark__canvas renderer-benchmark__canvas--liquid-scene" />,
            runtime.backgroundHost,
          )
        : null}
      {runtime && presentation
        ? elements.map((element) => {
            const host = runtime.getElementHost(element.id);
            return host
              ? createPortal(
                  <BenchmarkSceneElement
                    key={element.id}
                    element={element}
                    store={store}
                    presentation={presentation}
                    liquidPositioned
                    moveImage={store.scene.animations.moveImage}
                    showGif={store.scene.animations.showGif}
                    onGesturePin={pinElement}
                  />,
                  host,
                )
              : null;
          })
        : null}
      {runtime && presentation
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
    </div>
  );
}
