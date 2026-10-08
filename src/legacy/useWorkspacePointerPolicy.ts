import { useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from "react";

const isEditable = (target: HTMLElement | null) =>
  target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

export interface WorkspacePointerPorts {
  readonly worldRef: RefObject<HTMLDivElement | null>;
  readonly renamingId: () => string | null;
  readonly saveRename: () => void;
  readonly closeContextMenus: () => void;
  readonly openCanvasMenu: (clientX: number, clientY: number) => void;
}

/**
 * How the workspace treats presses outside the element they land on: a press clears stray text
 * selection, drops focus from the pressed control, saves an open rename and closes context menus.
 * The browser's own context menu and spellcheck are off throughout the workspace.
 */
export function useWorkspacePointerPolicy(ports: WorkspacePointerPorts) {
  const latest = useRef(ports);
  latest.current = ports;

  useEffect(() => {
    const root = document.documentElement.getAttribute("spellcheck");
    const body = document.body.getAttribute("spellcheck");
    document.documentElement.setAttribute("spellcheck", "false");
    document.body.setAttribute("spellcheck", "false");
    return () => {
      if (root === null) document.documentElement.removeAttribute("spellcheck");
      else document.documentElement.setAttribute("spellcheck", root);
      if (body === null) document.body.removeAttribute("spellcheck");
      else document.body.setAttribute("spellcheck", body);
    };
  }, []);

  return {
    onPointerDownCapture(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0) return;
      const p = latest.current;
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-text-block-content]") && !isEditable(target))
        window.getSelection()?.removeAllRanges();
      const control = target?.closest("button, [role='button'], a, select, [tabindex]");
      if (control instanceof HTMLElement && !isEditable(control))
        requestAnimationFrame(() => control.blur());
      if (p.renamingId() && !target?.closest("[data-container-rename-input]")) p.saveRename();
      // A menu's own trigger toggles it on click; closing it here first would reopen it.
      // Quick Extensions owns its outside-click close so its exit animation can run.
      if (target?.closest("[data-context-menu], [data-context-menu-trigger]")) return;
      p.closeContextMenus();
    },
    suppressContextMenu: (event: MouseEvent) => event.preventDefault(),
    /** A right-click on empty canvas opens the canvas menu. */
    onCanvasContextMenu(event: MouseEvent<HTMLDivElement>) {
      event.preventDefault();
      const p = latest.current;
      if (event.target === p.worldRef.current) p.openCanvasMenu(event.clientX, event.clientY);
    },
  };
}
