import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type ForwardedRef,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { MaterialSurface } from "../materials/MaterialSurface";
import { MOTION_DURATION_MS } from "../motion/motionTokens";
import { useReducedMotion } from "../motion/reducedMotionPreference";
import { CONTEXT_MENU_ITEM_SELECTOR } from "./ContextMenuParts";
import "./contextMenu.css";

type ContextMenuMotionState = "open" | "closing";
type ContextMenuCloseReason = "escape" | "outside" | "tab";

export interface ContextMenuPosition {
  readonly left: number;
  readonly top: number;
}

export interface ContextMenuProps {
  readonly children: ReactNode;
  readonly label: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly position: ContextMenuPosition;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Render into a themed portal on body so fixed positioning never resolves against a transformed
   * ancestor (e.g. an animating side panel). Callers own viewport clamping via the forwarded ref.
   */
  readonly portal?: boolean;
}

export const ContextMenu = forwardRef<HTMLElement, ContextMenuProps>(function ContextMenu(
  { children, label, onOpenChange, open, portal = false, position, returnFocusRef },
  forwardedRef,
) {
  const menuRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closeReasonRef = useRef<ContextMenuCloseReason | null>(null);
  const previousOpenRef = useRef(open);
  const [rendered, setRendered] = useState(open);
  const [motionState, setMotionState] = useState<ContextMenuMotionState>("open");
  const reducedMotion = useReducedMotion();
  const setMenuRef = useCallback(
    (element: HTMLElement | null) => {
      menuRef.current = element;
      setForwardedRef(forwardedRef, element);
    },
    [forwardedRef],
  );

  useEffect(() => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    if (open) {
      closeReasonRef.current = null;
      setRendered(true);
      setMotionState("open");
      return;
    }
    if (!rendered) return;
    if (reducedMotion) {
      setRendered(false);
      return;
    }
    setMotionState("closing");
    closeTimerRef.current = window.setTimeout(() => {
      setRendered(false);
      closeTimerRef.current = null;
    }, MOTION_DURATION_MS.menuExit);
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    };
  }, [open, reducedMotion, rendered]);

  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;
    if (open || !wasOpen) return;
    const reason = closeReasonRef.current;
    closeReasonRef.current = null;
    if (reason === null || reason === "escape") returnFocusRef?.current?.focus();
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!rendered) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current?.contains(target) || returnFocusRef?.current?.contains(target)) return;
      closeReasonRef.current = "outside";
      onOpenChange(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !open) return;
      event.preventDefault();
      closeReasonRef.current = "escape";
      onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onOpenChange, open, rendered, returnFocusRef]);

  useLayoutEffect(() => {
    if (!open || !rendered || motionState !== "open" || !menuRef.current) return;
    focusMenuItem(menuRef.current, 0);
  }, [motionState, open, rendered]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const menu = menuRef.current;
      if (!menu) return;
      if (event.key === "Tab") {
        closeReasonRef.current = "tab";
        onOpenChange(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveMenuFocus(menu, 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveMenuFocus(menu, -1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusMenuItem(menu, 0);
      } else if (event.key === "End") {
        event.preventDefault();
        focusMenuItem(menu, -1);
      }
    },
    [onOpenChange],
  );

  const handleFocusCapture = useCallback((event: ReactFocusEvent<HTMLElement>) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>(CONTEXT_MENU_ITEM_SELECTOR);
    if (item && menuRef.current?.contains(item) && isEnabledMenuItem(item)) {
      setRovingTabStop(menuRef.current, item);
    }
  }, []);

  if (!rendered) return null;
  const menu = (
    <ContextMenuSurface
      ref={setMenuRef}
      label={label}
      motionState={motionState}
      position={position}
      onKeyDown={handleKeyDown}
      onFocusCapture={handleFocusCapture}
    >
      {children}
    </ContextMenuSurface>
  );
  return portal
    ? createPortal(<div className="taskmap-target-theme">{menu}</div>, document.body)
    : menu;
});

export interface ContextMenuSurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly label: string;
  readonly position: ContextMenuPosition;
  readonly motionState?: ContextMenuMotionState;
}

/**
 * The shared menu surface: opaque material, sizing, and CSS enter/exit motion driven by
 * `motionState`. `ContextMenu` builds focus/dismiss behaviour on it; menus whose lifecycle is owned
 * elsewhere (App's canvas menus) render it directly.
 */
export const ContextMenuSurface = forwardRef<HTMLElement, ContextMenuSurfaceProps>(
  function ContextMenuSurface(
    { className, label, motionState = "open", position, style, ...props },
    ref,
  ) {
    const reducedMotion = useReducedMotion();
    return (
      <MaterialSurface
        {...props}
        ref={ref}
        as="nav"
        material="opaque"
        radius={8}
        role="menu"
        aria-label={label}
        data-motion-state={motionState}
        data-reduced-motion={reducedMotion}
        data-context-menu=""
        className={["taskmap-context-menu taskmap-scrollbar-thin", className]
          .filter(Boolean)
          .join(" ")}
        style={{ ...style, left: position.left, top: position.top }}
      />
    );
  },
);

function getEnabledMenuItems(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>(CONTEXT_MENU_ITEM_SELECTOR)].filter(
    isEnabledMenuItem,
  );
}

function isEnabledMenuItem(item: HTMLElement): boolean {
  return !(item instanceof HTMLButtonElement && item.disabled) && item.ariaDisabled !== "true";
}

function setRovingTabStop(menu: HTMLElement, activeItem: HTMLElement) {
  for (const item of menu.querySelectorAll<HTMLElement>(CONTEXT_MENU_ITEM_SELECTOR)) {
    item.tabIndex = item === activeItem ? 0 : -1;
  }
}

function focusMenuItem(menu: HTMLElement, requestedIndex: number) {
  const items = getEnabledMenuItems(menu);
  if (items.length === 0) return;
  const index = requestedIndex < 0 ? items.length - 1 : Math.min(requestedIndex, items.length - 1);
  const item = items[index];
  setRovingTabStop(menu, item);
  item.focus();
}

function moveMenuFocus(menu: HTMLElement, direction: -1 | 1) {
  const items = getEnabledMenuItems(menu);
  if (items.length === 0) return;
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  const nextIndex =
    currentIndex < 0
      ? direction > 0
        ? 0
        : items.length - 1
      : (currentIndex + direction + items.length) % items.length;
  focusMenuItem(menu, nextIndex);
}

function setForwardedRef(ref: ForwardedRef<HTMLElement>, element: HTMLElement | null) {
  if (typeof ref === "function") ref(element);
  else if (ref) (ref as { current: HTMLElement | null }).current = element;
}
