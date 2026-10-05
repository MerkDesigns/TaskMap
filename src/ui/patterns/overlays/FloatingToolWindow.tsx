import { IconX } from "@tabler/icons-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { markMaterialPresenceContent } from "../../materials/materialPresence";
import { MENU_PRESENCE_TIMING, PRESENCE_PRESETS } from "../../motion/presencePresets";
import { usePresenceMotion } from "../../motion/usePresenceMotion";
import { IconButton } from "../../primitives/Button";
import "./FloatingToolWindow.css";

type Bounds = { left: number; top: number; width: number; height: number };
type ResizeEdge = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
type PointerAction = {
  readonly type: "move" | "resize";
  readonly edge?: ResizeEdge;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly start: Bounds;
};

const EDGES: readonly ResizeEdge[] = ["n", "s", "w", "e", "nw", "ne", "sw", "se"];
const SCREEN_MARGIN = 8;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(value, maximum));

const centered = (width: number, height: number): Bounds => {
  const fittedWidth = Math.min(width, window.innerWidth - 32);
  const fittedHeight = Math.min(height, window.innerHeight - 32);
  return {
    left: Math.max(16, Math.round((window.innerWidth - fittedWidth) / 2)),
    top: Math.max(16, Math.round((window.innerHeight - fittedHeight) / 2)),
    width: fittedWidth,
    height: fittedHeight,
  };
};

export interface FloatingToolWindowHandle {
  /** Plays the exit and then calls `onClose`. */
  readonly requestClose: () => void;
}

export interface FloatingToolWindowProps {
  /** The window's accessible name. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly title: ReactNode;
  /** Controls in the header before the close button; presses there never move the window. */
  readonly actions?: ReactNode;
  readonly closeLabel: string;
  /** Called after the exit animation of a close, Escape or `requestClose`. */
  readonly onClose: () => void;
  readonly initialSize: { readonly width: number; readonly height: number };
  readonly minimumSize: { readonly width: number; readonly height: number };
  /** Block class added beside the shared window class, for the window's own content styles. */
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * A non-modal tool window above the canvas: Major Glass, moved by its header, resized from any edge
 * or corner, kept on screen, and faded in and out with the menu presence.
 */
export const FloatingToolWindow = forwardRef<FloatingToolWindowHandle, FloatingToolWindowProps>(
  function FloatingToolWindow(
    {
      label,
      icon,
      title,
      actions,
      closeLabel,
      onClose,
      initialSize,
      minimumSize,
      className,
      children,
    },
    ref,
  ) {
    const [bounds, setBounds] = useState(() => centered(initialSize.width, initialSize.height));
    const action = useRef<PointerAction | null>(null);
    const windowRef = useRef<HTMLElement | null>(null);
    const closing = useRef(false);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const presence = usePresenceMotion(windowRef, {
      channels: PRESENCE_PRESETS.materialFadeScale,
      enter: MENU_PRESENCE_TIMING.enter,
      exit: MENU_PRESENCE_TIMING.exit,
      initialProgress: 0,
      onComplete: (endpoint) => {
        if (endpoint === "hidden" && closing.current) onCloseRef.current();
      },
    });
    useLayoutEffect(() => {
      if (windowRef.current) markMaterialPresenceContent(windowRef.current);
      presence.show();
    }, [presence]);
    const requestClose = useCallback(() => {
      closing.current = true;
      if (windowRef.current) markMaterialPresenceContent(windowRef.current);
      presence.hide();
    }, [presence]);
    useImperativeHandle(ref, () => ({ requestClose }), [requestClose]);
    useEffect(() => {
      const closeOnEscape = (event: KeyboardEvent) => {
        if (event.key !== "Escape" || !windowRef.current?.contains(document.activeElement)) return;
        event.preventDefault();
        requestClose();
      };
      window.addEventListener("keydown", closeOnEscape);
      return () => window.removeEventListener("keydown", closeOnEscape);
    }, [requestClose]);

    const begin = (
      event: PointerEvent<HTMLElement>,
      type: PointerAction["type"],
      edge?: ResizeEdge,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      action.current = {
        type,
        edge,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        start: bounds,
      };
    };

    const update = (event: PointerEvent<HTMLElement>) => {
      const current = action.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      const { start } = current;
      if (current.type === "move") {
        setBounds({
          ...start,
          left: clamp(
            start.left + dx,
            SCREEN_MARGIN,
            window.innerWidth - start.width - SCREEN_MARGIN,
          ),
          top: clamp(
            start.top + dy,
            SCREEN_MARGIN,
            window.innerHeight - start.height - SCREEN_MARGIN,
          ),
        });
        return;
      }
      const edge = current.edge ?? "se";
      let { left, top, width, height } = start;
      if (edge.includes("e"))
        width = clamp(
          start.width + dx,
          minimumSize.width,
          window.innerWidth - start.left - SCREEN_MARGIN,
        );
      if (edge.includes("s"))
        height = clamp(
          start.height + dy,
          minimumSize.height,
          window.innerHeight - start.top - SCREEN_MARGIN,
        );
      if (edge.includes("w")) {
        left = clamp(start.left + dx, SCREEN_MARGIN, start.left + start.width - minimumSize.width);
        width = start.width + start.left - left;
      }
      if (edge.includes("n")) {
        top = clamp(start.top + dy, SCREEN_MARGIN, start.top + start.height - minimumSize.height);
        height = start.height + start.top - top;
      }
      setBounds({ left, top, width, height });
    };

    const finish = (event: PointerEvent<HTMLElement>) => {
      if (action.current?.pointerId !== event.pointerId) return;
      action.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    };

    return createPortal(
      <div className="taskmap-target-theme">
        <MaterialSurface
          ref={windowRef}
          material="acrylic-large"
          radius={12}
          role="dialog"
          aria-modal="false"
          aria-label={label}
          className={["taskmap-floating-window", className].filter(Boolean).join(" ")}
          style={bounds}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <header
            className="taskmap-floating-window__header"
            onPointerDown={(event) => begin(event, "move")}
            onPointerMove={update}
            onPointerUp={finish}
            onPointerCancel={finish}
          >
            <div className="taskmap-floating-window__identity">
              <span className="taskmap-floating-window__icon">{icon}</span>
              <h2 className="taskmap-floating-window__title">{title}</h2>
            </div>
            <div
              className="taskmap-floating-window__actions"
              onPointerDown={(event) => event.stopPropagation()}
            >
              {actions}
              <IconButton
                icon={<IconX size={17} stroke={2} />}
                variant="ghost"
                size="compact"
                aria-label={closeLabel}
                title={closeLabel}
                onClick={requestClose}
              />
            </div>
          </header>
          {children}
          {EDGES.map((edge) => (
            <div
              key={edge}
              className="taskmap-floating-window__resize"
              data-edge={edge}
              onPointerDown={(event) => begin(event, "resize", edge)}
              onPointerMove={update}
              onPointerUp={finish}
              onPointerCancel={finish}
            />
          ))}
        </MaterialSurface>
      </div>,
      document.body,
    );
  },
);
