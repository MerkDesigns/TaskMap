import { useEffect, useMemo, useRef, useState } from "react";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { TaskMapDocument } from "../domain/document/documentTypes";
import type { ElementId } from "../domain/ids/entityIds";
import {
  captureRetainedViewCopy,
  pasteRetainedViewCopy,
  type RetainedViewCopy,
} from "./retainedViewClipboard";
import { contextActionIds } from "./useRetainedExtensionCommands";

type Point = { readonly x: number; readonly y: number };
export type PastedElement = ReturnType<typeof pasteRetainedViewCopy>["inserted"][number];

export interface RetainedClipboardPorts {
  readonly callbacks: RetainedActionCallbacks;
  readonly document: () => TaskMapDocument | null;
  readonly selection: () => readonly string[];
  /** Locked elements (unless locked deletion is allowed) are never cut. */
  readonly isDeletionLocked: (id: string) => boolean;
  /** Where a text card is shown, so a pasted card lands relative to what was seen. */
  readonly cardPosition: (id: string) => Point | undefined;
  readonly canvasPoint: (clientX: number, clientY: number) => Point;
  /** The card row a paste into this container lands in, or undefined when it no longer exists. */
  readonly containerCardIndex: (containerId: string, point: Point) => number | undefined;
  /** Removes the cut elements (with their delete animation) and ends menus and renaming. */
  readonly deleteElements: (ids: readonly string[]) => void;
  readonly closeContextMenus: () => void;
  readonly onPasted: (inserted: readonly PastedElement[]) => void;
  readonly onPasteFailed: () => void;
}

/**
 * The canvas clipboard: one captured copy of elements, pasted at most once. A copy is dropped when
 * the document it came from changes in a way that invalidates it, or when the canvas unmounts.
 */
export function useRetainedClipboard(ports: RetainedClipboardPorts) {
  const latest = useRef(ports);
  latest.current = ports;
  const copied = useRef<RetainedViewCopy | null>(null);
  const [hasCopy, setHasCopy] = useState(false);

  const { callbacks } = ports;
  useEffect(() => {
    const unsubscribe = callbacks.subscribeInvalidation(() => {
      if (copied.current?.captured.isActive()) return;
      copied.current = null;
      setHasCopy(false);
    });
    return () => {
      unsubscribe();
      copied.current?.captured.cancel();
      copied.current = null;
    };
  }, [callbacks]);

  const actions = useMemo(() => {
    const copyElements = (ids: readonly string[]) => {
      const p = latest.current;
      copied.current?.captured.cancel();
      copied.current = captureRetainedViewCopy(
        p.callbacks,
        p.document(),
        ids as ElementId[],
        (id) => p.cardPosition(id),
      );
      setHasCopy(copied.current !== null);
      p.closeContextMenus();
    };

    /** Copies `id`, or the whole selection when `id` is part of a multi-selection. */
    const copy = (id: string) => copyElements(contextActionIds(latest.current.selection(), id));

    /** Copies the selection, as Ctrl+C does; false when nothing is selected. */
    const copySelection = () => {
      const selection = latest.current.selection();
      if (selection.length === 0) return false;
      copyElements(selection);
      return true;
    };

    /** Copies and removes `id` or its multi-selection, leaving locked elements in place. */
    const cut = (id: string) => {
      const p = latest.current;
      const targets = contextActionIds(p.selection(), id).filter(
        (target) => !p.isDeletionLocked(target),
      );
      if (targets.length === 0) return;
      copyElements(targets);
      p.deleteElements(targets);
    };

    const paste = (clientX: number, clientY: number, containerId?: string) => {
      const p = latest.current;
      const copy = copied.current;
      const document = p.document();
      if (!copy || !document) return;
      copied.current = null;
      setHasCopy(false);
      const point = p.canvasPoint(clientX, clientY);
      const cardIndex =
        containerId === undefined ? undefined : p.containerCardIndex(containerId, point);
      const { result, inserted } = pasteRetainedViewCopy(
        copy,
        document,
        point,
        { nextUuid: () => crypto.randomUUID() },
        containerId !== undefined && cardIndex !== undefined
          ? { containerId: containerId as ElementId, cardIndex }
          : undefined,
      );
      if (result.ok) p.onPasted(inserted);
      else p.onPasteFailed();
    };

    return { copy, copySelection, cut, paste };
  }, []);

  return useMemo(() => ({ hasCopy, ...actions }), [actions, hasCopy]);
}
