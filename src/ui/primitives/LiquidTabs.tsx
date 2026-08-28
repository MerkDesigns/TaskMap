import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { LiquidIndicatorTarget } from "../motion/liquidIndicatorMotion";
import { LiquidSelectionIndicator } from "./LiquidSelectionIndicator";
import { primitiveClassNames } from "./primitiveClassNames";
import { useTabListBehavior, type TabItem } from "./tabListBehavior";
import "./navigation.css";

export interface LiquidTabsProps<Value extends string = string> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  readonly label: string;
  readonly items: readonly TabItem<Value>[];
  readonly backgroundRadius?: number;
  readonly indicatorRadius?: number;
  readonly movingIndicatorRadius?: number;
  readonly orientation?: "horizontal" | "vertical";
  readonly value: Value;
  readonly onValueChange: (value: Value) => void;
}

export function LiquidTabs<Value extends string>({
  backgroundRadius,
  className,
  indicatorRadius,
  items,
  label,
  movingIndicatorRadius,
  onMouseDown,
  onValueChange,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  orientation = "horizontal",
  style,
  value,
  ...props
}: LiquidTabsProps<Value>) {
  const behavior = useTabListBehavior(items, onValueChange, orientation);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const mouseDragActiveRef = useRef(false);
  const dragValueRef = useRef<Value | null>(null);
  const suppressClickRef = useRef(false);
  const clickResetTimerRef = useRef<number | null>(null);
  const [indicatorTarget, setIndicatorTarget] = useState<LiquidIndicatorTarget | null>(null);

  const selectTabAt = useCallback(
    (clientX: number, clientY: number) => {
      const root = rootRef.current;
      const hit = document.elementFromPoint(clientX, clientY);
      const tab = hit?.closest<HTMLElement>("[data-liquid-tab-index]");
      if (!root || !tab || !root.contains(tab)) return;
      const item = items[Number(tab.dataset.liquidTabIndex)];
      if (!item || item.disabled || dragValueRef.current === item.value) return;
      dragValueRef.current = item.value;
      onValueChange(item.value);
    },
    [items, onValueChange],
  );

  const scheduleClickReset = useCallback(() => {
    if (clickResetTimerRef.current !== null) window.clearTimeout(clickResetTimerRef.current);
    clickResetTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      clickResetTimerRef.current = null;
    });
  }, []);

  const finishPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragPointerIdRef.current !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragPointerIdRef.current = null;
      dragValueRef.current = null;
      scheduleClickReset();
    },
    [scheduleClickReset],
  );

  const measure = useCallback(() => {
    const root = rootRef.current;
    const active = behavior.refs.current.get(value);
    if (!root || !active) return;
    const rootBounds = root.getBoundingClientRect();
    const activeBounds = active.getBoundingClientRect();
    const next: LiquidIndicatorTarget =
      orientation === "vertical"
        ? {
            orientation,
            top: activeBounds.top - rootBounds.top - root.clientTop,
            height: activeBounds.height,
          }
        : {
            orientation,
            left: activeBounds.left - rootBounds.left - root.clientLeft,
            width: activeBounds.width,
          };
    setIndicatorTarget((current) =>
      sameIndicatorTarget(current, next) ? current : Object.freeze(next),
    );
  }, [behavior.refs, orientation, value]);

  useLayoutEffect(measure, [items, measure]);
  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (rootRef.current) observer.observe(rootRef.current);
    behavior.refs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [behavior.refs, items, measure]);
  useLayoutEffect(
    () => () => {
      if (clickResetTimerRef.current !== null) window.clearTimeout(clickResetTimerRef.current);
    },
    [],
  );
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (mouseDragActiveRef.current) selectTabAt(event.clientX, event.clientY);
    };
    const handleMouseUp = (event: MouseEvent) => {
      if (!mouseDragActiveRef.current) return;
      selectTabAt(event.clientX, event.clientY);
      mouseDragActiveRef.current = false;
      dragValueRef.current = null;
      scheduleClickReset();
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [scheduleClickReset, selectTabAt]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerDown?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    const tab = (event.target as Element).closest<HTMLElement>("[data-liquid-tab-index]");
    if (!tab || !event.currentTarget.contains(tab) || tab.matches(":disabled")) return;
    event.preventDefault();
    dragPointerIdRef.current = event.pointerId;
    dragValueRef.current = null;
    suppressClickRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    selectTabAt(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (event.defaultPrevented || dragPointerIdRef.current !== event.pointerId) return;
    selectTabAt(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerUp?.(event);
    if (!event.defaultPrevented && dragPointerIdRef.current === event.pointerId) {
      selectTabAt(event.clientX, event.clientY);
    }
    finishPointerDrag(event);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerCancel?.(event);
    finishPointerDrag(event);
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    onMouseDown?.(event);
    if (event.defaultPrevented || event.button !== 0 || dragPointerIdRef.current !== null) {
      return;
    }
    const tab = (event.target as Element).closest<HTMLElement>("[data-liquid-tab-index]");
    if (!tab || !event.currentTarget.contains(tab) || tab.matches(":disabled")) return;
    event.preventDefault();
    mouseDragActiveRef.current = true;
    dragValueRef.current = null;
    suppressClickRef.current = true;
    selectTabAt(event.clientX, event.clientY);
  };

  return (
    <div
      {...props}
      ref={rootRef}
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      data-orientation={orientation}
      onMouseDown={handleMouseDown}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={primitiveClassNames("taskmap-liquid-tabs", className)}
      style={
        backgroundRadius === undefined
          ? style
          : ({ ...style, "--taskmap-liquid-tabs-radius": `${backgroundRadius}px` } as CSSProperties)
      }
    >
      {indicatorTarget ? (
        <LiquidSelectionIndicator
          target={indicatorTarget}
          settledRadius={indicatorRadius}
          movingRadius={movingIndicatorRadius}
        />
      ) : null}
      {items.map((item, index) => (
        <button
          key={item.value}
          ref={(element) => behavior.setRef(item.value, element)}
          id={item.id ?? `${behavior.generatedId}-liquid-tab-${index}`}
          role="tab"
          type="button"
          disabled={item.disabled}
          aria-selected={item.value === value}
          aria-controls={item.panelId}
          data-liquid-tab-index={index}
          tabIndex={-1}
          className="taskmap-control taskmap-liquid-tabs__tab"
          onClick={() => {
            if (suppressClickRef.current) return;
            onValueChange(item.value);
          }}
          onKeyDown={(event) => behavior.handleKeyDown(event, item.value)}
        >
          <span className="taskmap-liquid-tabs__label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function sameIndicatorTarget(
  current: LiquidIndicatorTarget | null,
  next: LiquidIndicatorTarget,
): boolean {
  if (!current || (current.orientation ?? "horizontal") !== (next.orientation ?? "horizontal")) {
    return false;
  }
  if (current.orientation === "vertical" && next.orientation === "vertical") {
    return current.top === next.top && current.height === next.height;
  }
  if (current.orientation !== "vertical" && next.orientation !== "vertical") {
    return current.left === next.left && current.width === next.width;
  }
  return false;
}
