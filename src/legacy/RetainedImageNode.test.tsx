import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RetainedImageNode } from "./RetainedImageNode";
import { RetainedCanvasContext } from "./RetainedCanvasContext";
import { createDatabaseEntryPreview } from "../features/database-entry/preview/createDatabaseEntryPreview";
import { importRetainedViewImage } from "./importRetainedViewImage";
import { asEntityId } from "../domain/ids/entityIds";
import { projectImage } from "../elements/image/imageViewProjection";

afterEach(cleanup);
it("loads once across pointer rerenders, revokes on culling, and reacquires on remount", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("fixture", "fixture");
  await runtime.initializeResources();
  const binding = runtime.bindCanvas({
    onRevoke() {},
    viewport: { pan: { x: 0, y: 0 }, zoom: 1, screen: { width: 1000, height: 800 } },
  });
  const url = "blob:visible-image";
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue(url);
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  try {
    expect(
      (await importRetainedViewImage(runtime, null, { x: 100, y: 100, accent: "blue" })).ok,
    ).toBe(true);
    const document = runtime.controller.store.getState().documentWorkspace.document!;
    const element = Object.values(document.elements)[0];
    const metadata = Object.values(document.mediaReferences)[0];
    const image = projectImage(element, 0, metadata as Parameters<typeof projectImage>[2]);
    const acquire = vi.spyOn(runtime.media, "acquire");
    const draw = (visible: boolean, x = image.x) => (
      <RetainedCanvasContext.Provider value={{ runtime, binding }}>
        {visible && (
          <RetainedImageNode
            image={{ ...image, x }}
            url={null}
            shadowsUnderElements={false}
            onStartMove={() => {}}
            onStartResize={() => {}}
            onOpenMenu={() => {}}
            onPick={() => {}}
          />
        )}
      </RetainedCanvasContext.Provider>
    );
    const view = render(draw(false));
    expect(acquire).not.toHaveBeenCalled();
    await act(async () => {
      view.rerender(draw(true));
    });
    expect(view.container.querySelector("img")?.getAttribute("src")).toBe(url);
    for (let n = 0; n < 100; n++) view.rerender(draw(true, n));
    expect(acquire).toHaveBeenCalledTimes(1);
    view.rerender(draw(false));
    expect(revoke).toHaveBeenCalledWith(url);
    await act(async () => {
      view.rerender(draw(true));
    });
    expect(acquire).toHaveBeenCalledTimes(2);
    await act(async () => {
      await runtime.controller.lock();
    });
    expect(revoke).toHaveBeenCalledTimes(2);
    view.unmount();
  } finally {
    create.mockRestore();
    revoke.mockRestore();
    await runtime.controller.dispose();
  }
});

it("shows missing media without a broken image or a retry loop", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("fixture", "fixture");
  await runtime.initializeResources();
  const binding = runtime.bindCanvas({
    onRevoke() {},
    viewport: { pan: { x: 0, y: 0 }, zoom: 1, screen: { width: 1000, height: 800 } },
  });
  try {
    const document = runtime.controller.store.getState().documentWorkspace.document!;
    const media = {
      id: asEntityId("media", "BBBBBBBBBBBBBBBBBBBBBBBB"),
      mimeType: "image/gif" as const,
      byteLength: 10,
      pixelWidth: 1,
      pixelHeight: 1,
      altText: null,
    };
    const image = projectImage(
      {
        id: asEntityId("element", `element-${crypto.randomUUID()}`),
        canvasId: document.activeCanvasId!,
        type: "image",
        geometry: { x: 0, y: 0, width: 80, height: 80 },
        data: { mediaId: media.id, placement: null, accent: "blue", background: true },
      },
      0,
      media,
    );
    const acquire = vi.spyOn(runtime.media, "acquire");
    const view = render(
      <RetainedCanvasContext.Provider value={{ runtime, binding }}>
        <RetainedImageNode
          image={image}
          url={null}
          shadowsUnderElements={false}
          onStartMove={() => {}}
          onStartResize={() => {}}
          onOpenMenu={() => {}}
          onPick={() => {}}
        />
      </RetainedCanvasContext.Provider>,
    );
    expect(await screen.findByText("Image unavailable")).toBeTruthy();
    expect(view.container.querySelector("img")).toBeNull();
    expect(acquire).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.controller.dispose();
  }
});
