import { IconArrowDownRight } from "@tabler/icons-react";
import { memo, useState } from "react";
import type { MouseEvent, PointerEvent, ReactNode, WheelEvent } from "react";
import type { ContainerElement } from "../../types";
import { ContainerHeader, type ContainerHeaderProps } from "./ContainerHeader";
import "./container.css";

export type ContainerRendererProps = Omit<ContainerHeaderProps, "article"> & {
  readonly selected: boolean;
  readonly multiSelected: boolean;
  readonly entering: boolean;
  readonly deleting: boolean;
  readonly moving: boolean;
  readonly shadowsUnderElements: boolean;
  readonly onSelect: (element: ContainerElement, additive?: boolean) => void;
  readonly onStartResize: (
    event: PointerEvent<HTMLButtonElement>,
    element: ContainerElement,
  ) => void;
  readonly onOpenContentMenu: (event: MouseEvent<HTMLElement>, element: ContainerElement) => void;
  readonly onWheelContent: (event: WheelEvent<HTMLElement>, element: ContainerElement) => void;
  readonly onStartContentSelection: (
    event: PointerEvent<HTMLElement>,
    element: ContainerElement,
  ) => void;
  /** Change tokens for the hosted cards; they re-render the container when its content changes. */
  readonly contentRevision: object;
  readonly contentEditRevision: string;
  /** The container's text cards, positioned inside its frame. */
  readonly children?: ReactNode;
};

function ContainerRendererComponent({
  selected,
  multiSelected,
  entering,
  deleting,
  moving,
  shadowsUnderElements,
  onSelect,
  onStartResize,
  onOpenContentMenu,
  onWheelContent,
  onStartContentSelection,
  contentRevision: _contentRevision,
  contentEditRevision: _contentEditRevision,
  children,
  ...headerProps
}: ContainerRendererProps) {
  const { element, onStartMove } = headerProps;
  const [article, setArticle] = useState<HTMLElement | null>(null);
  const shadowClass = shadowsUnderElements
    ? ""
    : ` canvas-attached-shadow-shell${moving ? " canvas-attached-drag-shadow" : ""}`;

  return (
    <article
      ref={setArticle}
      className={`taskmap-container${shadowClass}`}
      data-search={Boolean(element.extensions?.search) || undefined}
      data-moving={moving || undefined}
      data-multi-selected={multiSelected || undefined}
      data-entering={entering || undefined}
      data-deleting={deleting || undefined}
      style={{
        zIndex: 20 + (element.layer ?? 0),
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        backgroundColor: element.accent,
        borderColor: selected
          ? `color-mix(in srgb, ${element.accent} 72%, white 28%)`
          : element.accent,
      }}
      onPointerDown={(event) => {
        if (event.button !== 1) event.stopPropagation();
        if (event.button === 0 && multiSelected) {
          onStartMove(event, element);
          return;
        }
        if (event.button === 0) onSelect(element, event.shiftKey);
      }}
      onWheelCapture={(event) => onWheelContent(event, element)}
    >
      <div className="taskmap-container__frame">
        <ContainerHeader {...headerProps} article={article} />
        <div
          className="taskmap-container__content"
          data-privacy-hidden={Boolean(element.extensions?.privacy?.enabled) || undefined}
          onContextMenu={(event) => {
            if (multiSelected) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            onOpenContentMenu(event, element);
          }}
          onPointerDown={(event) => onStartContentSelection(event, element)}
          onWheelCapture={(event) => onWheelContent(event, element)}
        />
        {children}
        <button
          className="taskmap-container__resize"
          onPointerDown={(event) => {
            event.currentTarget.blur();
            onStartResize(event, element);
          }}
          title="Resize container"
        >
          <IconArrowDownRight size={18} stroke={2} />
        </button>
        <div
          className={`selection-overlay taskmap-container__selection${
            selected ? " selection-overlay-active" : ""
          }`}
        />
      </div>
    </article>
  );
}

/** Children are recreated every render; the revision tokens stand in for them. */
const areContainerPropsEqual = (previous: ContainerRendererProps, next: ContainerRendererProps) => {
  const previousValues = previous as unknown as Record<string, unknown>;
  const nextValues = next as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(previousValues), ...Object.keys(nextValues)]);
  keys.delete("children");
  return [...keys].every((key) => previousValues[key] === nextValues[key]);
};

export const ContainerRenderer = memo(ContainerRendererComponent, areContainerPropsEqual);
