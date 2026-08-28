import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
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
  onValueChange,
  orientation = "horizontal",
  style,
  value,
  ...props
}: LiquidTabsProps<Value>) {
  const behavior = useTabListBehavior(items, onValueChange, orientation);
  const rootRef = useRef<HTMLDivElement>(null);
  const [indicatorTarget, setIndicatorTarget] = useState<LiquidIndicatorTarget | null>(null);

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
            top: activeBounds.top - rootBounds.top,
            height: activeBounds.height,
          }
        : {
            orientation,
            left: activeBounds.left - rootBounds.left,
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

  return (
    <div
      {...props}
      ref={rootRef}
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      data-orientation={orientation}
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
          tabIndex={-1}
          className="taskmap-control taskmap-liquid-tabs__tab"
          onClick={() => onValueChange(item.value)}
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
