import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MajorGlassLayerContext, type MajorGlassLayerOwner } from "./MajorGlassLayer";
import { MaterialPlaneProvider } from "./MaterialPlane";
import { MaterialSurface } from "./MaterialSurface";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const owner: MajorGlassLayerOwner = { register: vi.fn(() => () => {}) };
const source = (text: string) =>
  screen.getByText(text).closest("[data-material]")!.getAttribute("data-material-backdrop-source");

// Glass contract section 7: Layer-1 persistent Majors share the workspace plane (isolated from
// each other); Layer-2 overlays keep their own filters so they sample completed Layer-1 UI.
it("places persistent Majors on the workspace plane and overlays on their own filters", () => {
  render(
    <>
      <MajorGlassLayerContext.Provider value={owner}>
        <MaterialSurface material="acrylic-large" geometryActive={false}>
          Persistent chrome
        </MaterialSurface>
        <MaterialPlaneProvider plane="modal">
          <MaterialSurface material="acrylic-large" geometryActive={false}>
            Modal dialog
          </MaterialSurface>
        </MaterialPlaneProvider>
        <MaterialSurface material="acrylic-large" geometryActive={false}>
          <MaterialSurface material="acrylic-large" geometryActive={false}>
            Major inside a Major
          </MaterialSurface>
        </MaterialSurface>
      </MajorGlassLayerContext.Provider>
      <MaterialSurface material="acrylic-large" geometryActive={false}>
        Portal overlay
      </MaterialSurface>
    </>,
  );

  expect(source("Persistent chrome")).toBe("plane");
  expect(source("Modal dialog")).toBe("self");
  expect(source("Major inside a Major")).toBe("self");
  expect(source("Portal overlay")).toBe("self");
});
