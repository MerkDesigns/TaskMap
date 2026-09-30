import { cleanup, render } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  MajorGlassLayerContext,
  WorkspaceMajorGlassEnabled,
  type MajorGlassLayerOwner,
} from "./MajorGlassLayer";
import {
  WorkspaceMajorGlass,
  WorkspaceMajorGlassBridge,
  createWorkspaceMajorOwner,
} from "./WorkspaceMajorGlass";
import { supplyMaterialPresentation } from "./materialGeometryInvalidation";
import { readNativeGlassDiagnostics } from "./SharedSmallGlassPlane";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("counts a shared Major plane once rather than counting its filter-free shells", () => {
  const root = document.createElement("div");
  root.innerHTML = `<div data-major-glass-plane="true"><span class="taskmap-native-glass-preblur"></span><span class="taskmap-native-glass-backdrop"></span></div><div data-material-strategy="native-glass" data-material-role="large" data-material-backdrop-source="plane"></div>`;
  expect(readNativeGlassDiagnostics(root)).toMatchObject({
    activeGlassBatchCount: 1,
    localMaterialBackdropFilterCount: 0,
    nativeBackdropSurfaceCount: 1,
    nativeBackdropFilterLayerCount: 2,
  });
});

it("projects motion from cached bounds and removes registrations without measuring motion frames", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frames.set(++id, fn);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (key: number) => frames.delete(key));
  const plane = document.createElement("div");
  const panel = document.createElement("div");
  const measure = vi
    .spyOn(panel, "getBoundingClientRect")
    .mockReturnValue({ x: -84, y: 71, width: 288, height: 500 } as DOMRect);
  supplyMaterialPresentation(panel, { translateX: -100 });
  const owner = createWorkspaceMajorOwner(() => plane);
  const dispose = owner.register(panel, 20);
  [...frames.values()].forEach((fn) => fn(0));
  // Layered mask: position moves with presentation; opacity is baked into a cached image.
  const position = () => plane.style.getPropertyValue("--taskmap-plane-mask-position");
  const image = () => decodeURIComponent(plane.style.getPropertyValue("--taskmap-plane-mask"));
  const mask = () => `${image()}|${position()}`;
  expect(position()).toBe("-84px 71px");
  measure.mockClear();
  supplyMaterialPresentation(panel, { translateX: 0 });
  expect(position()).toBe("16px 71px");
  const opaqueImage = image();
  supplyMaterialPresentation(panel, { opacity: 0.5 });
  expect(image()).toContain('fill-opacity="0.5"');
  expect(position()).toBe("16px 71px");
  supplyMaterialPresentation(panel, { opacity: 1 });
  expect(image()).toBe(opaqueImage);
  expect(measure).not.toHaveBeenCalled();
  dispose();
  expect(plane.dataset.planeShapeCount).toBe("0");
  const final = mask();
  supplyMaterialPresentation(panel, { translateX: 20 });
  expect(mask()).toBe(final);
});

it("keeps the owner's mask across re-renders after the window size changes", () => {
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => (fn(0), 1));
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  const panel = document.createElement("div");
  document.body.append(panel);
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
    x: 16,
    y: 71,
    width: 288,
    height: 500,
  } as DOMRect);
  let owner: MajorGlassLayerOwner | null = null;
  const Probe = () => {
    owner = useContext(MajorGlassLayerContext);
    return null;
  };
  const view = (
    <WorkspaceMajorGlassEnabled.Provider value>
      <WorkspaceMajorGlass>
        <Probe />
      </WorkspaceMajorGlass>
    </WorkspaceMajorGlassEnabled.Provider>
  );
  const { container, rerender } = render(view);
  const dispose = owner!.register(panel, 20);
  const plane = container.querySelector<HTMLElement>("[data-major-glass-plane]")!;
  const mask = () =>
    `${decodeURIComponent(plane.style.getPropertyValue("--taskmap-plane-mask"))}|${plane.style.getPropertyValue("--taskmap-plane-mask-position")}`;
  expect(mask()).toContain("16px 71px");
  expect(mask()).toContain('rx="20"');
  vi.stubGlobal("innerWidth", window.innerWidth + 40);
  rerender(view);
  expect(mask()).toContain("16px 71px");
  expect(mask()).toContain('rx="20"');
  dispose();
  // An empty plane must mask everything; WebView2 ignores an SVG mask that paints nothing.
  expect(plane.style.getPropertyValue("--taskmap-plane-mask")).toBe(
    "linear-gradient(transparent, transparent)",
  );
  panel.remove();
});

it("bridges base Majors outside the workspace subtree only while a workspace plane is mounted", () => {
  let bridged: MajorGlassLayerOwner | null = null;
  let workspace: MajorGlassLayerOwner | null = null;
  const BridgeProbe = () => {
    bridged = useContext(MajorGlassLayerContext);
    return null;
  };
  const WorkspaceProbe = () => {
    workspace = useContext(MajorGlassLayerContext);
    return null;
  };
  const bridge = render(
    <WorkspaceMajorGlassBridge>
      <BridgeProbe />
    </WorkspaceMajorGlassBridge>,
  );
  expect(bridged).toBeNull();
  const view = (enabled: boolean) => (
    <WorkspaceMajorGlassEnabled.Provider value={enabled}>
      <WorkspaceMajorGlass>
        <WorkspaceProbe />
      </WorkspaceMajorGlass>
    </WorkspaceMajorGlassEnabled.Provider>
  );
  const mounted = render(view(true));
  expect(workspace).not.toBeNull();
  expect(bridged).toBe(workspace);
  mounted.rerender(view(false));
  expect(bridged).toBeNull();
  mounted.rerender(view(true));
  expect(bridged).toBe(workspace);
  mounted.unmount();
  expect(bridged).toBeNull();
  bridge.unmount();
});
