import { useEffect, useState } from "react";
import type { RefObject } from "react";

export interface HeaderExtensionItem<Key extends string> {
  readonly key: Key;
  /** Fixed per button, so the split never waits for a render of the buttons themselves. */
  readonly width: number;
}

/** How an element header divides its row between the title and the extension buttons. */
export interface HeaderLayoutMetrics {
  /** The row's horizontal padding, both sides together. */
  readonly horizontalPadding: number;
  /** The title keeps at least this much width, or its full width when that is smaller. */
  readonly minimumTitleReserve: number;
  /** ...and up to this share of the row before buttons overflow. */
  readonly titleShare: number;
  readonly spacing: number;
}

const MENU_BUTTON_WIDTH = 28;
const COLLAPSE_BUTTON_WIDTH = 24;
const OVERFLOW_BUTTON_WIDTH = 32;

/**
 * Which installed extension buttons fit in an element header beside its title; the rest go to the
 * overflow popover. `items` and `metrics` must be referentially stable.
 */
export function useHeaderExtensionLayout<Key extends string>(
  items: readonly HeaderExtensionItem<Key>[],
  buttonsVisible: boolean,
  title: { readonly name: string; readonly renaming: boolean },
  metrics: HeaderLayoutMetrics,
  rowRef: RefObject<HTMLElement | null>,
  titleRef: RefObject<HTMLElement | null>,
) {
  const totalWidth = items.reduce((total, item) => total + item.width, 0);
  const collapsible = items.length > 1;
  const [visibleCount, setVisibleCount] = useState(items.length);
  const { name, renaming } = title;

  useEffect(() => {
    const row = rowRef.current;
    const titleElement = titleRef.current;
    if (!row || !titleElement) return;
    const measure = () => {
      const innerWidth = Math.max(0, row.clientWidth - metrics.horizontalPadding);
      const titleReserve = Math.min(
        titleElement.scrollWidth,
        Math.max(metrics.minimumTitleReserve, innerWidth * metrics.titleShare),
      );
      const fixedControlsWidth = MENU_BUTTON_WIDTH + (collapsible ? COLLAPSE_BUTTON_WIDTH : 0);
      const available = Math.max(
        0,
        innerWidth - titleReserve - fixedControlsWidth - metrics.spacing,
      );
      if (totalWidth <= available) {
        setVisibleCount(items.length);
        return;
      }
      const availableBesideOverflow = Math.max(0, available - OVERFLOW_BUTTON_WIDTH);
      let usedWidth = 0;
      let count = 0;
      for (const item of items) {
        if (usedWidth + item.width > availableBesideOverflow) break;
        usedWidth += item.width;
        count += 1;
      }
      setVisibleCount(count);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(titleElement);
    measure();
    return () => observer.disconnect();
  }, [collapsible, name, items, totalWidth, renaming, metrics, rowRef, titleRef]);

  const visibleItems = items.slice(0, visibleCount);
  return {
    collapsible,
    visibleItems,
    visibleWidth: visibleItems.reduce((total, item) => total + item.width, 0),
    overflowItems: buttonsVisible ? items.slice(visibleCount) : [],
  };
}
