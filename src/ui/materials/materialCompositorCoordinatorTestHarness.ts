import { vi } from "vitest";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { createAcrylicCacheRuntime } from "./compositor/acrylicCacheRuntime";
import type { CompositorOutputPlaneSet } from "./compositor/compositorOutputPlanes";
import { ControlledAcrylicExecutor, createTestScene } from "./compositor/compositorTestFixtures";
import { createMaterialCompositorCoordinator } from "./materialCompositorCoordinator";
import { createMaterialCompositorDiagnosticsStore } from "./materialCompositorDiagnostics";
import type { MaterialBackdropPresentation } from "./materialCompositorPresentation";
import {
  createMaterialSurfaceRegistry,
  type MaterialSurfaceElement,
} from "./materialSurfaceRegistry";

export function createCoordinatorHarness(kind: "worker-offscreen" | "main-thread-fallback") {
  const executor = new ControlledAcrylicExecutor(kind);
  const runtime = createAcrylicCacheRuntime(
    kind === "worker-offscreen" ? { workerExecutor: executor } : { mainThreadExecutor: executor },
  );
  const registry = createMaterialSurfaceRegistry(null);
  const outputs = fakeOutputs();
  const frames = frameHarness();
  const diagnostics = createMaterialCompositorDiagnosticsStore();
  const sceneBuilds = vi.fn((revision: number) => createTestScene({ revision }));
  const coordinator = createMaterialCompositorCoordinator({
    runtime,
    surfaces: registry,
    outputs,
    frames,
    diagnostics,
  });
  return {
    executor,
    runtime,
    registry,
    outputs,
    frames,
    coordinator,
    sceneBuilds,
    present: (revision: number, overrides: PresentationOverrides = {}) =>
      createPresentation(revision, sceneBuilds, overrides),
    register(id: string, plane: "base" | "modal") {
      const element = new FakeSurfaceElement();
      registry.register({
        id,
        element,
        material: "acrylic-large",
        plane,
        radiusPx: 12,
      });
      return element;
    },
    dispose() {
      coordinator.dispose();
      registry.dispose();
      runtime.dispose();
    },
  };
}

type PresentationOverrides = Partial<{
  sceneKey: string;
  pan: { x: number; y: number };
  screen: { width: number; height: number };
  interactionActive: boolean;
}>;

function createPresentation(
  revision: number,
  build: (revision: number) => ReturnType<typeof createTestScene>,
  overrides: PresentationOverrides,
): MaterialBackdropPresentation {
  return {
    sceneKey: overrides.sceneKey ?? "scene-a",
    sceneRevision: revision,
    viewport: createViewport(
      overrides.pan ?? { x: 0, y: 0 },
      1,
      overrides.screen ?? { width: 800, height: 500 },
    ),
    interactionActive: overrides.interactionActive ?? false,
    buildScene: () => {
      const scene = build(revision);
      return overrides.sceneKey
        ? { ...scene, identity: { ...scene.identity, key: overrides.sceneKey } }
        : scene;
    },
  };
}

class FakeSurfaceElement implements MaterialSurfaceElement {
  isConnected = true;
  rectangle = { left: 10, top: 20, width: 140, height: 60 };
  getBoundingClientRect() {
    return this.rectangle;
  }
}

function frameHarness() {
  let serial = 0;
  const callbacks = new Map<number, () => void>();
  return {
    request(callback: () => void) {
      serial += 1;
      callbacks.set(serial, callback);
      return serial;
    },
    cancel(handle: number) {
      callbacks.delete(handle);
    },
    pending: () => callbacks.size,
    flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback());
    },
  };
}

function fakeOutputs() {
  return {
    resize: vi.fn<CompositorOutputPlaneSet["resize"]>(),
    rebuildMask: vi.fn<CompositorOutputPlaneSet["rebuildMask"]>(),
    compose: vi.fn<CompositorOutputPlaneSet["compose"]>(),
    clear: vi.fn<CompositorOutputPlaneSet["clear"]>(),
    dispose: vi.fn<CompositorOutputPlaneSet["dispose"]>(),
  } satisfies CompositorOutputPlaneSet;
}
