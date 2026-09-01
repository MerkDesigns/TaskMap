import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type ForwardedRef,
  type HTMLAttributes,
} from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { Fade } from "../../motion/presenceController";
import { MOTION_DURATION_MS } from "../../motion/motionTokens";
import { useSurfacePresence } from "../../motion/useSurfacePresence";
import "./MinimapSurface.css";

export const MINIMAP_PRESENCE_DURATION_MS = MOTION_DURATION_MS.normal * 1.5;

export interface MinimapSurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly onExitComplete?: () => void;
  readonly visible: boolean;
}

export const MinimapSurface = forwardRef<HTMLElement, MinimapSurfaceProps>(function MinimapSurface(
  { className, onExitComplete, visible, ...props },
  forwardedRef,
) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const presence = useSurfacePresence(surfaceRef, {
    effects: Fade,
    durationMs: MINIMAP_PRESENCE_DURATION_MS,
    initialProgress: visible ? 0 : 1,
    contentTargets: () => materialContentChildren(surfaceRef.current),
    onComplete: (endpoint) => {
      if (endpoint === "hidden") onExitComplete?.();
    },
  });
  useLayoutEffect(() => {
    if (visible) presence.show();
    else presence.hide();
  }, [presence, visible]);
  const composedRef = useCallback(
    (element: HTMLElement | null) => {
      surfaceRef.current = element;
      assignRef(forwardedRef, element);
    },
    [forwardedRef],
  );

  return (
    <MaterialSurface
      {...props}
      ref={composedRef}
      material="acrylic-large"
      radius={12}
      aria-label="Minimap"
      data-visible={visible}
      className={["taskmap-minimap-surface", className].filter(Boolean).join(" ")}
    />
  );
});

export const MinimapViewport = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function MinimapViewport({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={["taskmap-minimap-viewport", className].filter(Boolean).join(" ")}
      />
    );
  },
);

function assignRef(ref: ForwardedRef<HTMLElement>, element: HTMLElement | null): void {
  if (typeof ref === "function") ref(element);
  else if (ref) ref.current = element;
}

function materialContentChildren(surface: HTMLElement | null): HTMLElement[] {
  if (!surface) return [];
  return [...surface.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      !child.classList.contains("taskmap-material-native-glass__clip") &&
      !child.classList.contains("taskmap-material-native-glass__rim"),
  );
}
