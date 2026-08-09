import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createBrowserAcrylicRuntime } from "./compositor/browserAcrylicRuntime";
import { createCompositorOutputPlaneSet } from "./compositor/compositorOutputPlanes";
import { MaterialAcrylicProof } from "./MaterialAcrylicProof";
import "./MaterialCompositor.css";
import {
  createMaterialCompositorCoordinator,
  type MaterialCompositorCoordinator,
} from "./materialCompositorCoordinator";
import { createMaterialCompositorDiagnosticsStore } from "./materialCompositorDiagnostics";
import type { MaterialCompositorPresentationSource } from "./materialCompositorPresentation";
import {
  createMaterialSurfaceRegistry,
  type MaterialSurfaceRegistry,
} from "./materialSurfaceRegistry";
import { MaterialSurfaceRegistrationProvider } from "./MaterialSurfaceRegistration";

const proofEnabled = import.meta.env.DEV && import.meta.env.VITE_TASKMAP_ACRYLIC_PROOF === "1";

export interface MaterialCompositorProviderProps {
  readonly children: ReactNode;
  readonly presentation: MaterialCompositorPresentationSource;
}

export function MaterialCompositorProvider({
  children,
  presentation,
}: MaterialCompositorProviderProps) {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  const coordinatorRef = useRef<MaterialCompositorCoordinator | null>(null);
  const [surfaceRegistry, setSurfaceRegistry] = useState<MaterialSurfaceRegistry | null>(null);
  const notifySurfaceGeometryChanged = useCallback(
    () => coordinatorRef.current?.notifySurfaceGeometryChanged(),
    [],
  );
  const registrationBoundary = useMemo(
    () =>
      surfaceRegistry
        ? Object.freeze({ registry: surfaceRegistry, notifySurfaceGeometryChanged })
        : null,
    [notifySurfaceGeometryChanged, surfaceRegistry],
  );

  useEffect(() => {
    const baseCanvas = baseCanvasRef.current;
    const modalCanvas = modalCanvasRef.current;
    if (!baseCanvas || !modalCanvas) return;

    const browserRuntime = createBrowserAcrylicRuntime();
    const registry = createMaterialSurfaceRegistry();
    const diagnostics = createMaterialCompositorDiagnosticsStore();
    let coordinator: MaterialCompositorCoordinator | null = null;
    try {
      const outputs = createCompositorOutputPlaneSet({ base: baseCanvas, modal: modalCanvas });
      coordinator = createMaterialCompositorCoordinator({
        runtime: browserRuntime.runtime,
        surfaces: registry,
        outputs,
        frames: {
          request: (callback) => window.requestAnimationFrame(callback),
          cancel: (handle) => window.cancelAnimationFrame(handle),
        },
        diagnostics,
      });
      coordinatorRef.current = coordinator;
    } catch {
      browserRuntime.runtime.dispose();
      registry.dispose();
      return;
    }

    setSurfaceRegistry(registry);
    const publishPresentation = () => coordinator?.updatePresentation(presentation.getSnapshot());
    const unsubscribePresentation = presentation.subscribe(publishPresentation);
    publishPresentation();

    const diagnosticsGlobal = Object.freeze({
      getSnapshot: diagnostics.getSnapshot,
      subscribe: diagnostics.subscribe,
    });
    if (import.meta.env.DEV)
      developmentWindow().__TASKMAP_ACRYLIC_DIAGNOSTICS__ = diagnosticsGlobal;

    return () => {
      unsubscribePresentation();
      coordinatorRef.current = null;
      coordinator?.dispose();
      registry.dispose();
      browserRuntime.runtime.dispose();
      if (
        import.meta.env.DEV &&
        developmentWindow().__TASKMAP_ACRYLIC_DIAGNOSTICS__ === diagnosticsGlobal
      ) {
        delete developmentWindow().__TASKMAP_ACRYLIC_DIAGNOSTICS__;
      }
    };
  }, [presentation]);

  return (
    <MaterialSurfaceRegistrationProvider value={registrationBoundary}>
      <canvas
        ref={baseCanvasRef}
        className="taskmap-compositor-plane taskmap-compositor-plane--base"
        aria-hidden="true"
        tabIndex={-1}
      />
      <canvas
        ref={modalCanvasRef}
        className="taskmap-compositor-plane taskmap-compositor-plane--modal"
        aria-hidden="true"
        tabIndex={-1}
      />
      {children}
      {proofEnabled ? <MaterialAcrylicProof /> : null}
    </MaterialSurfaceRegistrationProvider>
  );
}

interface DevelopmentDiagnosticsWindow extends Window {
  __TASKMAP_ACRYLIC_DIAGNOSTICS__?: {
    readonly getSnapshot: () => unknown;
    readonly subscribe: (listener: () => void) => () => void;
  };
}

function developmentWindow(): DevelopmentDiagnosticsWindow {
  return window;
}
