import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem<Value extends string = string> {
  readonly value: Value;
  readonly label: ReactNode;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly panelId?: string;
}

export function useTabListBehavior<Value extends string>(
  items: readonly TabItem<Value>[],
  value: Value,
  onValueChange: (value: Value) => void,
  orientation: "horizontal" | "vertical",
) {
  const generatedId = useId();
  const refs = useRef(new Map<Value, HTMLButtonElement>());
  const enabled = items.filter((item) => !item.disabled);
  const rovingValue = enabled.some((item) => item.value === value) ? value : enabled[0]?.value;

  const setRef = (itemValue: Value, element: HTMLButtonElement | null) => {
    if (element) refs.current.set(itemValue, element);
    else refs.current.delete(itemValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: Value) => {
    const previousKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    const direction = event.key === nextKey ? 1 : event.key === previousKey ? -1 : 0;
    let target: Value | undefined;
    if (event.key === "Home") target = enabled[0]?.value;
    else if (event.key === "End") target = enabled[enabled.length - 1]?.value;
    else if (direction && enabled.length > 0) {
      const index = Math.max(
        0,
        enabled.findIndex((item) => item.value === current),
      );
      target = enabled[(index + direction + enabled.length) % enabled.length]?.value;
    }
    if (!target) return;
    event.preventDefault();
    onValueChange(target);
    refs.current.get(target)?.focus();
  };

  return {
    generatedId,
    refs,
    rovingValue,
    setRef,
    handleKeyDown,
  };
}
