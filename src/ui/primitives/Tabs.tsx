import type { HTMLAttributes } from "react";
import { primitiveClassNames } from "./primitiveClassNames";
import { useTabListBehavior, type TabItem } from "./tabListBehavior";
import "./navigation.css";

export type { TabItem } from "./tabListBehavior";

export interface TabsProps<Value extends string = string> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  readonly label: string;
  readonly items: readonly TabItem<Value>[];
  readonly value: Value;
  readonly onValueChange: (value: Value) => void;
  readonly orientation?: "horizontal" | "vertical";
}

export function Tabs<Value extends string>({
  className,
  items,
  label,
  onValueChange,
  orientation = "horizontal",
  value,
  ...props
}: TabsProps<Value>) {
  const behavior = useTabListBehavior(items, value, onValueChange, orientation);
  return (
    <div
      {...props}
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      className={primitiveClassNames("taskmap-tabs", `taskmap-tabs--${orientation}`, className)}
    >
      {items.map((item, index) => (
        <button
          key={item.value}
          ref={(element) => behavior.setRef(item.value, element)}
          id={item.id ?? `${behavior.generatedId}-tab-${index}`}
          role="tab"
          type="button"
          disabled={item.disabled}
          aria-selected={item.value === value}
          aria-controls={item.panelId}
          tabIndex={item.value === behavior.rovingValue ? 0 : -1}
          className="taskmap-control taskmap-tabs__tab"
          onClick={() => onValueChange(item.value)}
          onKeyDown={(event) => behavior.handleKeyDown(event, item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
