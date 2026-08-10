import { useCallback, useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";
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
  readonly value: Value;
  readonly onValueChange: (value: Value) => void;
}

export function LiquidTabs<Value extends string>({
  className,
  items,
  label,
  onValueChange,
  value,
  ...props
}: LiquidTabsProps<Value>) {
  const behavior = useTabListBehavior(items, value, onValueChange, "horizontal");
  const rootRef = useRef<HTMLDivElement>(null);
  const [indicatorTarget, setIndicatorTarget] = useState<LiquidIndicatorTarget | null>(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const active = behavior.refs.current.get(value);
    if (!root || !active) return;
    const rootBounds = root.getBoundingClientRect();
    const activeBounds = active.getBoundingClientRect();
    const next = {
      left: activeBounds.left - rootBounds.left,
      width: activeBounds.width,
    };
    setIndicatorTarget((current) =>
      current?.left === next.left && current.width === next.width ? current : Object.freeze(next),
    );
  }, [behavior.refs, value]);

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
      aria-orientation="horizontal"
      className={primitiveClassNames("taskmap-liquid-tabs", className)}
    >
      {indicatorTarget ? <LiquidSelectionIndicator target={indicatorTarget} /> : null}
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
          tabIndex={item.value === behavior.rovingValue ? 0 : -1}
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
