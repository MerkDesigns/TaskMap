import {
  IconBraces,
  IconEye,
  IconEyeOff,
  IconLock,
  IconLockOpen,
  IconPalette,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent, RefObject, SyntheticEvent } from "react";
import type { ElementExtensions } from "../../types";

export type HeaderExtension = "lock" | "privacy" | "colorPicker" | "counter" | "copyPasteJson";

interface HeaderExtensionItem {
  readonly key: HeaderExtension;
  readonly width: number;
}

const BUTTON_WIDTH = 36;

/**
 * Which installed extension buttons fit in the header beside the title; the rest go to the
 * overflow popover. Widths are fixed per button so the split never waits for a render.
 */
export function useHeaderExtensionLayout(
  extensions: ElementExtensions | undefined,
  headerButtonsVisible: boolean,
  name: string,
  cardCount: number,
  renaming: boolean,
  rowRef: RefObject<HTMLElement | null>,
  titleRef: RefObject<HTMLElement | null>,
) {
  const counterWidth = extensions?.counter ? Math.max(36, String(cardCount).length * 8 + 26) : 0;
  const items = useMemo(() => {
    const installed: HeaderExtensionItem[] = [];
    if (extensions?.lock) installed.push({ key: "lock", width: BUTTON_WIDTH });
    if (extensions?.privacy) installed.push({ key: "privacy", width: BUTTON_WIDTH });
    if (extensions?.colorPicker) installed.push({ key: "colorPicker", width: BUTTON_WIDTH });
    if (extensions?.counter) installed.push({ key: "counter", width: counterWidth });
    if (extensions?.copyPasteJson) installed.push({ key: "copyPasteJson", width: BUTTON_WIDTH });
    return installed;
  }, [
    extensions?.lock,
    extensions?.privacy,
    extensions?.colorPicker,
    extensions?.counter,
    extensions?.copyPasteJson,
    counterWidth,
  ]);
  const totalWidth = items.reduce((total, item) => total + item.width, 0);
  const collapsible = items.length > 1;
  const buttonsVisible = headerButtonsVisible;
  const [visibleCount, setVisibleCount] = useState(items.length);

  useEffect(() => {
    const row = rowRef.current;
    const title = titleRef.current;
    if (!row || !title) return;
    const measure = () => {
      const innerWidth = Math.max(0, row.clientWidth - 32);
      const titleReserve = Math.min(title.scrollWidth, Math.max(76, innerWidth * 0.42));
      const fixedControlsWidth = 28 + (collapsible ? 24 : 0);
      const available = Math.max(0, innerWidth - titleReserve - fixedControlsWidth - 12);
      if (totalWidth <= available) {
        setVisibleCount(items.length);
        return;
      }
      const availableBesideOverflow = Math.max(0, available - 32);
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
    observer.observe(title);
    measure();
    return () => observer.disconnect();
  }, [collapsible, name, items, totalWidth, renaming, rowRef, titleRef]);

  const visibleItems = items.slice(0, visibleCount);
  return {
    collapsible,
    buttonsVisible,
    visibleItems,
    visibleWidth: visibleItems.reduce((total, item) => total + item.width, 0),
    overflowItems: buttonsVisible ? items.slice(visibleCount) : [],
  };
}

export interface ContainerExtensionButtonProps {
  readonly extension: HeaderExtension;
  readonly id: string;
  readonly extensions: ElementExtensions | undefined;
  readonly cardCount: number;
  readonly jsonMenuOpen: boolean;
  readonly jsonButtonRef: RefObject<HTMLButtonElement | null>;
  readonly onToggleLock: (id: string) => void;
  readonly onTogglePrivacy: (id: string) => void;
  readonly onToggleColorPicker: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly onToggleJsonMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function ContainerExtensionButton({
  extension,
  id,
  extensions,
  cardCount,
  jsonMenuOpen,
  jsonButtonRef,
  onToggleLock,
  onTogglePrivacy,
  onToggleColorPicker,
  onToggleJsonMenu,
}: ContainerExtensionButtonProps) {
  switch (extension) {
    case "lock": {
      const enabled = Boolean(extensions?.lock?.enabled);
      return (
        <button
          className="taskmap-container__button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleLock(id);
          }}
          onPointerDown={stopPropagation}
          title={enabled ? "Unlock" : "Lock"}
        >
          {enabled ? <IconLock size={22} stroke={2} /> : <IconLockOpen size={22} stroke={2} />}
        </button>
      );
    }
    case "privacy": {
      const enabled = Boolean(extensions?.privacy?.enabled);
      return (
        <button
          className="taskmap-container__button"
          onClick={(event) => {
            event.stopPropagation();
            onTogglePrivacy(id);
          }}
          onPointerDown={stopPropagation}
          title={enabled ? "Show content" : "Hide content"}
        >
          {enabled ? <IconEyeOff size={25} stroke={2} /> : <IconEye size={25} stroke={2} />}
        </button>
      );
    }
    case "colorPicker":
      return (
        <button
          className="taskmap-container__button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleColorPicker(event);
          }}
          onPointerDown={stopPropagation}
          title="Open color picker"
        >
          <IconPalette size={22} stroke={2} />
        </button>
      );
    case "counter":
      return (
        <span
          className="taskmap-container__counter"
          onPointerDown={stopPropagation}
          title={`${cardCount} ${cardCount === 1 ? "card" : "cards"}`}
        >
          {cardCount}
        </span>
      );
    case "copyPasteJson":
      return (
        <button
          ref={jsonButtonRef}
          className="taskmap-container__button"
          data-active={jsonMenuOpen || undefined}
          onClick={onToggleJsonMenu}
          onPointerDown={stopPropagation}
          title="Copy/Paste JSON"
        >
          <IconBraces size={22} stroke={2} />
        </button>
      );
  }
}
