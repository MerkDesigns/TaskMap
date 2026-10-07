import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageDrop } from "../platform/media/imageDropClient";
import type { ImageElement } from "../types";
import { importRetainedViewImage } from "./importRetainedViewImage";
import type { RetainedApplicationRuntime } from "./RetainedCanvasContext";
import { useRetainedImageImport, type RetainedImageImportPorts } from "./useRetainedImageImport";

vi.mock("./importRetainedViewImage", () => ({ importRetainedViewImage: vi.fn() }));
const importImage = vi.mocked(importRetainedViewImage);
const ok = { ok: true } as Awaited<ReturnType<typeof importRetainedViewImage>>;

beforeEach(() => {
  vi.clearAllMocks();
  importImage.mockResolvedValue(ok);
});

const placeholder: ImageElement = {
  id: "empty",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  accent: "#fff",
};

function setup() {
  const workspace = { epoch: 1, document: { activeCanvasId: "canvas" } };
  let dropListener: ((drop: ImageDrop) => void) | undefined;
  const runtime = {
    controller: { store: { getState: () => ({ documentWorkspace: workspace }) } },
    media: {
      subscribeDrops: vi.fn(async (listener: (drop: ImageDrop) => void) => {
        dropListener = listener;
        return () => undefined;
      }),
    },
  } as unknown as RetainedApplicationRuntime;
  const ports: RetainedImageImportPorts = {
    runtime,
    canvasPoint: (x, y) => ({ x, y }),
    images: () => [placeholder],
    accent: () => "#abc",
    showToast: vi.fn(),
  };
  const { result } = renderHook(() => useRetainedImageImport(ports));
  const drop = async (drop: ImageDrop) => {
    await waitFor(() => expect(dropListener).toBeDefined());
    await act(async () => dropListener!(drop));
  };
  return { importer: () => result.current, ports, workspace, drop };
}

describe("useRetainedImageImport", () => {
  it("marks an image as importing while its file is picked", async () => {
    let finish!: (value: typeof ok) => void;
    importImage.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const { importer } = setup();

    let picking!: Promise<void>;
    act(() => {
      picking = importer().pick("image");
    });
    expect(importer().importingIds).toEqual(["image"]);

    await act(async () => {
      finish(ok);
      await picking;
    });
    expect(importer().importingIds).toEqual([]);
  });

  it("reports a failed pick but not a cancelled one", async () => {
    const { importer, ports } = setup();
    importImage.mockResolvedValueOnce({ ok: false, error: { code: "cancelled" } } as never);
    await act(() => importer().pick("image"));
    expect(ports.showToast).not.toHaveBeenCalled();

    importImage.mockResolvedValueOnce({ ok: false, error: { code: "unexpected" } } as never);
    await act(() => importer().pick("image"));
    expect(ports.showToast).toHaveBeenCalledOnce();
  });

  it("fills an empty placeholder with the first dropped file and fans the rest out", async () => {
    const { drop } = setup();

    await drop({ x: 50, y: 50, tokens: ["one", "two"] } as ImageDrop);

    expect(importImage.mock.calls.map((call) => call[2])).toEqual([
      { elementId: "empty" },
      { x: 74, y: 74, accent: "#abc" },
    ]);
  });

  it("stops a drop when the document changes underneath it", async () => {
    const { drop, workspace } = setup();
    importImage.mockImplementationOnce(async () => {
      workspace.epoch = 2;
      return ok;
    });

    await drop({ x: 500, y: 500, tokens: ["one", "two"] } as ImageDrop);

    expect(importImage).toHaveBeenCalledOnce();
  });

  it("pastes a clipboard image, but not into a text field", () => {
    setup();
    const file = new File(["png"], "image.png", { type: "image/png" });
    const paste = (target: EventTarget) => {
      const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
      Object.defineProperty(event, "clipboardData", {
        value: { items: [{ type: "image/png", getAsFile: () => file }] },
      });
      target.dispatchEvent(event);
      return event;
    };
    const input = document.body.appendChild(document.createElement("input"));

    expect(paste(input).defaultPrevented).toBe(false);
    expect(paste(document.body).defaultPrevented).toBe(true);
    expect(importImage).toHaveBeenCalledWith(
      expect.anything(),
      file,
      expect.objectContaining({ accent: "#abc" }),
    );
    input.remove();
  });
});
