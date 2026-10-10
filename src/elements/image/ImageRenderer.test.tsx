import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asEntityId } from "../../domain/ids/entityIds";
import { createDatabaseEntryPreview } from "../../features/database-entry/preview/createDatabaseEntryPreview";
import { importRetainedViewImage } from "../../legacy/importRetainedViewImage";
import type { ImageDocumentElement, ImageMediaMetadata } from "./imageModel";
import {
  ImageRenderer,
  type ImageActions,
  type ImageMediaLeases,
  type ImageViewState,
} from "./ImageRenderer";

afterEach(cleanup);

const actions: ImageActions = {
  onStartMove: () => {},
  onStartResize: () => {},
  onOpenMenu: () => {},
  onPick: () => {},
};

const viewState = (
  media: ImageMediaMetadata | null,
  overrides: Partial<ImageViewState> = {},
): ImageViewState => ({
  layer: 0,
  geometry: { x: 0, y: 0, width: 80, height: 80 },
  media,
  importing: false,
  selected: false,
  entering: false,
  deleting: false,
  dragging: false,
  gesture: false,
  shadowsUnderElements: false,
  ...overrides,
});

async function openSession() {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("fixture", "fixture");
  await runtime.initializeResources();
  runtime.bindCanvas({
    onRevoke() {},
    viewport: { pan: { x: 0, y: 0 }, zoom: 1, screen: { width: 1000, height: 800 } },
  });
  return runtime;
}

describe("ImageRenderer media leases", () => {
  it("loads once across pointer rerenders and culling, and revokes on lock", async () => {
    const runtime = await openSession();
    const url = "blob:visible-image";
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue(url);
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    try {
      expect(
        (await importRetainedViewImage(runtime, null, { x: 100, y: 100, accent: "blue" })).ok,
      ).toBe(true);
      const document = runtime.controller.store.getState().documentWorkspace.document!;
      const element = Object.values(document.elements)[0] as ImageDocumentElement;
      const media = Object.values(document.mediaReferences)[0] as ImageMediaMetadata;
      const acquire = vi.spyOn(runtime.media, "acquire");
      const draw = (visible: boolean, x = 0) =>
        visible ? (
          <ImageRenderer
            element={element}
            view={viewState(media, { geometry: { x, y: 0, width: 80, height: 80 } })}
            actions={actions}
            leases={runtime.media}
          />
        ) : null;

      const view = render(draw(false));
      expect(acquire).not.toHaveBeenCalled();
      await act(async () => {
        view.rerender(draw(true));
      });
      expect(view.container.querySelector("img")?.getAttribute("src")).toBe(url);
      for (let n = 0; n < 100; n++) view.rerender(draw(true, n));
      expect(acquire).toHaveBeenCalledTimes(1);
      view.rerender(draw(false));
      expect(revoke).not.toHaveBeenCalled();
      await act(async () => {
        view.rerender(draw(true));
      });
      expect(acquire).toHaveBeenCalledTimes(2);
      expect(create).toHaveBeenCalledTimes(1);
      view.rerender(draw(false));
      // Already loaded: the remounted image shows on its first render, without a spinner.
      view.rerender(draw(true));
      expect(view.container.querySelector("img")?.getAttribute("src")).toBe(url);
      await act(async () => {
        await runtime.controller.lock();
      });
      expect(revoke).toHaveBeenCalledTimes(1);
      view.unmount();
    } finally {
      create.mockRestore();
      revoke.mockRestore();
      await runtime.controller.dispose();
    }
  });

  it("shows missing media without a broken image or a retry loop", async () => {
    const runtime = await openSession();
    try {
      const document = runtime.controller.store.getState().documentWorkspace.document!;
      const media: ImageMediaMetadata = {
        id: asEntityId("media", "BBBBBBBBBBBBBBBBBBBBBBBB"),
        mimeType: "image/gif",
        byteLength: 10,
        pixelWidth: 1,
        pixelHeight: 1,
        altText: null,
      };
      const element: ImageDocumentElement = {
        id: asEntityId("element", `element-${crypto.randomUUID()}`),
        canvasId: document.activeCanvasId!,
        type: "image",
        geometry: { x: 0, y: 0, width: 80, height: 80 },
        data: { mediaId: media.id, placement: null, accent: "blue", background: true },
      };
      const acquire = vi.spyOn(runtime.media, "acquire");
      const view = render(
        <ImageRenderer
          element={element}
          view={viewState(media)}
          actions={actions}
          leases={runtime.media}
        />,
      );
      expect(await screen.findByText("Image unavailable")).toBeTruthy();
      expect(view.container.querySelector("img")).toBeNull();
      expect(acquire).toHaveBeenCalledTimes(1);
    } finally {
      await runtime.controller.dispose();
    }
  });
});

describe("ImageRenderer", () => {
  const element: ImageDocumentElement = {
    id: asEntityId("element", "element-00000000-0000-4000-8000-000000000001"),
    canvasId: asEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000002"),
    type: "image",
    geometry: { x: 0, y: 0, width: 80, height: 80 },
    data: { mediaId: null, placement: null, accent: "#5f96e8", background: true },
  };
  const noLeases: ImageMediaLeases = {
    acquire: () => ({ ready: Promise.resolve(null), release: () => {} }),
    peek: () => null,
  };

  it("invites a pick or drop while it has no media, and spins while a file imports", () => {
    const { rerender } = render(
      <ImageRenderer
        element={element}
        view={viewState(null)}
        actions={actions}
        leases={noLeases}
      />,
    );
    expect(screen.getByText("Double-click to add image")).toBeInTheDocument();

    rerender(
      <ImageRenderer
        element={element}
        view={viewState(null, { importing: true })}
        actions={actions}
        leases={noLeases}
      />,
    );
    expect(screen.queryByText("Double-click to add image")).not.toBeInTheDocument();
  });

  it("is placed by translation at its shown position, so moves never re-lay it out", () => {
    const { container } = render(
      <ImageRenderer
        element={element}
        view={viewState(null, { geometry: { x: 40, y: 50, width: 120, height: 90 } })}
        actions={actions}
        leases={noLeases}
      />,
    );
    const image = container.querySelector<HTMLElement>(".taskmap-image")!;

    expect(image.style.left).toBe("0px");
    expect(image.style.translate).toBe("40px 50px");
    expect(image.style.width).toBe("120px");
  });
});
