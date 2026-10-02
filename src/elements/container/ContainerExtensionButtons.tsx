import {
  IconBraces,
  IconEye,
  IconEyeOff,
  IconLock,
  IconLockOpen,
  IconPalette,
} from "@tabler/icons-react";
import { useMemo } from "react";
import type { MouseEvent, RefObject, SyntheticEvent } from "react";
import type { HeaderExtensionItem, HeaderLayoutMetrics } from "../useHeaderExtensionLayout";
import type { ElementExtensions } from "../../types";

export type HeaderExtension = "lock" | "privacy" | "colorPicker" | "counter" | "copyPasteJson";

const BUTTON_WIDTH = 36;

export const CONTAINER_HEADER_METRICS: HeaderLayoutMetrics = {
  horizontalPadding: 32,
  minimumTitleReserve: 76,
  titleShare: 0.42,
  spacing: 12,
};

/** The container's installed header extensions in display order, with their button widths. */
export function useContainerHeaderExtensions(
  extensions: ElementExtensions | undefined,
  cardCount: number,
): readonly HeaderExtensionItem<HeaderExtension>[] {
  const counterWidth = extensions?.counter ? Math.max(36, String(cardCount).length * 8 + 26) : 0;
  return useMemo(() => {
    const installed: HeaderExtensionItem<HeaderExtension>[] = [];
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
          className="taskmap-element-header__button"
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
          className="taskmap-element-header__button"
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
          className="taskmap-element-header__button"
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
          className="taskmap-element-header__button"
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
