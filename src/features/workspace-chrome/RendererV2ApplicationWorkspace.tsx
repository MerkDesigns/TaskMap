import { lazy, Suspense, useEffect, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { RendererV2CanvasViewport } from "../../canvas/RendererV2CanvasViewport";
import { createCanvasCameraSession } from "../../canvas/interaction/canvasCameraSession";
import { LiquidDomRoot } from "../../ui/materials/liquid-dom";
import { RendererV2ApplicationChrome } from "./RendererV2ApplicationChrome";
import { useDevelopmentWorkspaceBootstrap } from "./useDevelopmentWorkspaceBootstrap";
import "./RendererV2ApplicationChrome.css";

const DevelopmentRefractionTestLayer = import.meta.env.DEV
  ? lazy(() =>
      import("../../ui/dev/refraction-test/DevelopmentRefractionTestLayer").then((module) => ({
        default: module.DevelopmentRefractionTestLayer,
      })),
    )
  : null;

export function RendererV2ApplicationWorkspace() {
  useDevelopmentWorkspaceBootstrap();
  const document = useAppSelector((state) => state.documentWorkspace.document);
  const [cameraSession] = useState(createCanvasCameraSession);
  const activeCanvas = document?.activeCanvasId
    ? document.canvases[document.activeCanvasId]
    : undefined;

  useEffect(() => {
    cameraSession.retain(new Set(document?.canvasOrder ?? []));
  }, [cameraSession, document?.canvasOrder]);

  return (
    <LiquidDomRoot
      className="taskmap-target-theme taskmap-renderer-v2-application"
      backdrop={
        <RendererV2CanvasViewport
          activeCanvasId={document?.activeCanvasId}
          cameraSession={cameraSession}
          worldSize={activeCanvas?.settings}
        >
          {DevelopmentRefractionTestLayer ? (
            <Suspense fallback={null}>
              <DevelopmentRefractionTestLayer activeCanvasId={document?.activeCanvasId ?? null} />
            </Suspense>
          ) : null}
        </RendererV2CanvasViewport>
      }
    >
      <RendererV2ApplicationChrome document={document} />
    </LiquidDomRoot>
  );
}
