import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { MaterialSurface } from "../materials/MaterialSurface";
import { primitiveClassNames } from "./primitiveClassNames";
import "./floatingPanel.css";

export type FloatingPanelPlacement = "bottom-start" | "top-center";

export interface FloatingPanelProps extends HTMLAttributes<HTMLDivElement> {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly dismissOnOutsidePress?: boolean;
  readonly matchAnchorWidth?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly open: boolean;
  readonly placement?: FloatingPanelPlacement;
}

export const FloatingPanel = forwardRef<HTMLDivElement, FloatingPanelProps>(function FloatingPanel(
  {
    anchorRef,
    children,
    className,
    dismissOnOutsidePress = false,
    matchAnchorWidth = false,
    onOpenChange,
    open,
    placement = "bottom-start",
    style,
    ...props
  },
  forwardedRef,
) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const next = calculatePosition(
        anchor.getBoundingClientRect(),
        panel.getBoundingClientRect(),
        placement,
      );
      setPosition({
        left: next.left,
        top: next.top,
        minWidth: matchAnchorWidth ? anchor.getBoundingClientRect().width : undefined,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, matchAnchorWidth, open, placement]);

  useEffect(() => {
    if (!open || !onOpenChange) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!dismissOnOutsidePress) return;
      const target = event.target as Node | null;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorRef, dismissOnOutsidePress, onOpenChange, open]);

  if (!open) return null;
  return createPortal(
    <MaterialSurface
      {...props}
      material="opaque"
      radius={8}
      ref={(element) => {
        panelRef.current = element as HTMLDivElement | null;
        if (typeof forwardedRef === "function") forwardedRef(element as HTMLDivElement | null);
        else if (forwardedRef) forwardedRef.current = element as HTMLDivElement | null;
      }}
      className={primitiveClassNames("taskmap-target-theme taskmap-floating-panel", className)}
      style={{ ...style, ...position, visibility: position ? undefined : "hidden" }}
    >
      {children}
    </MaterialSurface>,
    document.body,
  );
});

function calculatePosition(anchor: DOMRect, panel: DOMRect, placement: FloatingPanelPlacement) {
  const edge = 8;
  const gap = 5;
  let left =
    placement === "top-center" ? anchor.left + (anchor.width - panel.width) / 2 : anchor.left;
  let top = placement === "top-center" ? anchor.top - panel.height - gap : anchor.bottom + gap;

  if (placement === "top-center" && top < edge) top = anchor.bottom + gap;
  if (placement === "bottom-start" && top + panel.height > window.innerHeight - edge) {
    top = Math.max(edge, anchor.top - panel.height - gap);
  }

  left = Math.min(Math.max(edge, left), Math.max(edge, window.innerWidth - panel.width - edge));
  return { left, top };
}
