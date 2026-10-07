import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementId } from "../domain/ids/entityIds";
import type { RetainedImageView } from "../elements/image/imageViewProjection";
import type { ImageDrop } from "../platform/media/imageDropClient";
import type { ImageElement, ToastTone } from "../types";
import { importRetainedViewImage } from "./importRetainedViewImage";
import type { RetainedApplicationRuntime } from "./RetainedCanvasContext";

type Point = { readonly x: number; readonly y: number };
/** Several dropped files fan out from the drop point by this much each. */
const DROP_STAGGER = 24;

export interface RetainedImageImportPorts {
  readonly runtime: RetainedApplicationRuntime;
  readonly canvasPoint: (clientX: number, clientY: number) => Point;
  /** Loose images, topmost last. */
  readonly images: () => readonly ImageElement[];
  readonly accent: () => string;
  readonly showToast: (toast: { tone: ToastTone; title: string; message?: string }) => void;
}

type ImportResult = Awaited<ReturnType<typeof importRetainedViewImage>>;
/** The import was abandoned on purpose: the picker was cancelled or the document moved on. */
const abandoned = (result: ImportResult, includingCancel: boolean) =>
  ("code" in result && result.code === "expired-action") ||
  (includingCancel && "error" in result && result.error.code === "cancelled");

const failed = (ports: RetainedImageImportPorts, message: string) =>
  ports.showToast({ tone: "error", title: "Could not add image", message });

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

/**
 * How images enter the canvas: picking a file for an image, dropping files (onto an empty
 * placeholder, which they fill, or anywhere else, where they become new images) and pasting an
 * image from the clipboard. Images being picked are marked as importing.
 */
export function useRetainedImageImport(ports: RetainedImageImportPorts) {
  const latest = useRef(ports);
  latest.current = ports;
  const [importingIds, setImportingIds] = useState<readonly string[]>([]);

  const actions = useMemo(
    () => ({
      /** Picks a file for the image `id`, replacing what it shows. */
      async pick(id: string) {
        setImportingIds((current) => (current.includes(id) ? current : [...current, id]));
        try {
          const result = await importRetainedViewImage(latest.current.runtime, null, {
            elementId: id as ElementId,
          });
          if (!result.ok && !abandoned(result, true))
            failed(latest.current, "The image could not be imported.");
        } finally {
          setImportingIds((current) => current.filter((importing) => importing !== id));
        }
      },
    }),
    [],
  );

  const { runtime } = ports;
  // Dropped files arrive through the media service, which authorizes the paths natively.
  useEffect(() => {
    const importDrop = async (drop: ImageDrop) => {
      const p = latest.current;
      const workspace = () => p.runtime.controller.store.getState().documentWorkspace;
      if (!workspace().document) return;
      const captured = { epoch: workspace().epoch, canvasId: workspace().document?.activeCanvasId };
      const point = p.canvasPoint(drop.x, drop.y);
      const images = p.images();
      let placeholder: ImageElement | undefined;
      for (let index = images.length - 1; index >= 0 && !placeholder; index -= 1) {
        const image = images[index];
        const empty = !(image as unknown as RetainedImageView).media;
        if (
          empty &&
          point.x >= image.x &&
          point.x <= image.x + image.width &&
          point.y >= image.y &&
          point.y <= image.y + image.height
        )
          placeholder = image;
      }
      for (const [index, dropToken] of drop.tokens.entries()) {
        // A lock, canvas switch or reload during the drop ends it.
        const now = workspace();
        if (now.epoch !== captured.epoch || now.document?.activeCanvasId !== captured.canvasId)
          break;
        const result = await importRetainedViewImage(
          p.runtime,
          { dropToken },
          placeholder && index === 0
            ? { elementId: placeholder.id as ElementId }
            : {
                x: point.x + index * DROP_STAGGER,
                y: point.y + index * DROP_STAGGER,
                accent: p.accent(),
              },
        );
        if (!result.ok) {
          if (!abandoned(result, false)) failed(p, "The dropped image could not be imported.");
          break;
        }
      }
    };
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void runtime.media
      .subscribeDrops((drop) => void importDrop(drop))
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch(() =>
        latest.current.showToast({
          tone: "error",
          title: "Image drops unavailable",
          message: "Could not connect image file drops.",
        }),
      );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [runtime]);

  // A pasted image becomes a new image at the centre of the window.
  useEffect(() => {
    const pasteImage = (event: ClipboardEvent) => {
      if (!event.clipboardData || isEditableTarget(event.target)) return;
      const file = Array.from(event.clipboardData.items)
        .find((entry) => entry.type.startsWith("image/"))
        ?.getAsFile();
      const p = latest.current;
      if (!file || !p.runtime.controller.store.getState().documentWorkspace.document) return;
      event.preventDefault();
      void importRetainedViewImage(p.runtime, file, {
        ...p.canvasPoint(window.innerWidth / 2, window.innerHeight / 2),
        accent: p.accent(),
      }).then((result) => {
        if (!result.ok && !abandoned(result, false)) failed(p, "The image could not be imported.");
      });
    };
    window.addEventListener("paste", pasteImage);
    return () => window.removeEventListener("paste", pasteImage);
  }, []);

  return useMemo(() => ({ importingIds, ...actions }), [actions, importingIds]);
}
