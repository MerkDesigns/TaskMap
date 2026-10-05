import { useEffect, useRef } from "react";
import type { LeftPanelState } from "./useLeftPanel";

export interface CanvasShortcutPorts {
  /** A settings, clear-canvas or update dialog, or any blocking modal, is open. */
  readonly modalOpen: () => boolean;
  /** Holding C shows the connection ports; releasing it (or leaving the window) hides them. */
  readonly setConnectionMode: (active: boolean) => void;
  /** Shift changes how held text cards travel (true size versus lifted). */
  readonly setShiftHeld: (held: boolean) => void;
  readonly openQuickExtensionsAtPointer: () => void;
  readonly closeQuickExtensions: () => void;
  readonly leftPanel: {
    readonly current: () => LeftPanelState;
    readonly show: (panel: "canvases" | "extensions") => void;
    readonly close: (panel: "canvases" | "extensions") => void;
  };
  readonly closeContextMenus: () => void;
  readonly endRename: () => void;
  readonly deleteSelection: () => void;
  /** Copies the selection; false when nothing was copied, so the key falls through. */
  readonly copySelection: () => boolean;
  readonly canPaste: () => boolean;
  readonly pasteAtPointer: () => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly cycleCanvases: (direction: 1 | -1) => void;
  /** A Ctrl+Tab canvas cycle is in progress and ends when Ctrl is released. */
  readonly cyclingCanvases: () => boolean;
  readonly finishCanvasCycle: () => void;
}

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

const inDialog = (target: EventTarget | null) =>
  target instanceof HTMLElement && Boolean(target.closest("[role='dialog'], [aria-modal='true']"));

const blurFocusedElement = () => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
};

/** Handled: the canvas owns this key, so nothing else should act on it. */
const claim = (event: KeyboardEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

/**
 * The canvas keyboard shortcuts, registered once on the window. Every handler reads the latest
 * ports when a key arrives, so state changes never re-register listeners.
 */
export function useCanvasShortcuts(ports: CanvasShortcutPorts) {
  const latest = useRef(ports);
  latest.current = ports;

  useEffect(() => {
    const connectionModeDown = (event: KeyboardEvent, p: CanvasShortcutPorts) => {
      if (
        event.code !== "KeyC" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isEditableTarget(event.target) ||
        p.modalOpen()
      )
        return;
      event.preventDefault();
      p.setConnectionMode(true);
    };

    const panelsAndSelection = (event: KeyboardEvent, p: CanvasShortcutPorts) => {
      const editing = isEditableTarget(event.target);
      if (p.modalOpen() || inDialog(event.target)) return;
      const plain = !event.altKey && !event.ctrlKey && !event.metaKey;

      if (plain && event.shiftKey && event.key.toLowerCase() === "e" && !editing) {
        claim(event);
        blurFocusedElement();
        p.closeContextMenus();
        p.openQuickExtensionsAtPointer();
        return;
      }

      // Tab toggles the Canvas Browser; Shift+Tab switches between the two panels.
      if (plain && event.key === "Tab" && !editing) {
        claim(event);
        blurFocusedElement();
        const shown = p.leftPanel.current();
        if (event.shiftKey) {
          p.leftPanel.show(shown === "canvases" ? "extensions" : "canvases");
        } else if (shown === "canvases") {
          p.leftPanel.close("canvases");
        } else {
          p.leftPanel.close("extensions");
          p.closeQuickExtensions();
          p.leftPanel.show("canvases");
        }
        return;
      }

      // Shared menus close themselves first; the next Escape closes panels.
      if (
        event.key === "Escape" &&
        !editing &&
        !(
          event.target instanceof HTMLElement &&
          event.target.closest('[role="menu"][data-context-menu]')
        )
      ) {
        claim(event);
        blurFocusedElement();
        p.closeContextMenus();
        p.leftPanel.close("canvases");
        p.leftPanel.close("extensions");
        p.endRename();
        return;
      }

      // A button keeps focus after a click; Delete yields only to text editing.
      if (event.key === "Delete" && !editing) {
        event.preventDefault();
        p.deleteSelection();
        p.closeContextMenus();
        p.endRename();
      }
    };

    const clipboard = (event: KeyboardEvent, p: CanvasShortcutPorts) => {
      if (
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        isEditableTarget(event.target)
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "c") {
        if (!p.copySelection()) return;
      } else if (key === "v") {
        if (!p.canPaste()) return;
        p.pasteAtPointer();
      } else return;
      claim(event);
    };

    const canvasCycle = (event: KeyboardEvent, p: CanvasShortcutPorts) => {
      if (
        event.key !== "Tab" ||
        !event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditableTarget(event.target)
      )
        return;
      claim(event);
      p.cycleCanvases(event.shiftKey ? -1 : 1);
    };

    const keyDownCapture = (event: KeyboardEvent) => {
      const p = latest.current;
      connectionModeDown(event, p);
      if (event.key === "Shift" && !event.repeat) p.setShiftHeld(true);
      panelsAndSelection(event, p);
      clipboard(event, p);
      canvasCycle(event, p);
    };

    // Undo/redo listen in the bubble phase, after anything focused had the chance to handle it.
    const keyDownBubble = (event: KeyboardEvent) => {
      const p = latest.current;
      if (
        isEditableTarget(event.target) ||
        p.modalOpen() ||
        inDialog(event.target) ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) p.redo();
        else p.undo();
      } else if (key === "y" && !event.shiftKey) {
        event.preventDefault();
        p.redo();
      }
    };

    const keyUpCapture = (event: KeyboardEvent) => {
      const p = latest.current;
      if (event.code === "KeyC") p.setConnectionMode(false);
      if (event.key === "Shift") p.setShiftHeld(false);
      if (
        (event.key === "Control" || event.key === "ControlLeft" || event.key === "ControlRight") &&
        p.cyclingCanvases()
      )
        p.finishCanvasCycle();
    };

    const blur = () => latest.current.setConnectionMode(false);

    window.addEventListener("keydown", keyDownCapture, true);
    window.addEventListener("keydown", keyDownBubble);
    window.addEventListener("keyup", keyUpCapture, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", keyDownCapture, true);
      window.removeEventListener("keydown", keyDownBubble);
      window.removeEventListener("keyup", keyUpCapture, true);
      window.removeEventListener("blur", blur);
    };
  }, []);
}
