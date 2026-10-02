import { IconArrowDownRight } from "@tabler/icons-react";
import { memo, useState } from "react";
import type { ReactNode } from "react";
import { ContainerHeader } from "./ContainerHeader";
import type { ContainerDocumentElement } from "./containerModel";
import type { ContainerActions, ContainerViewState } from "./containerView";
import "./container.css";

export interface ContainerRendererProps {
  readonly element: ContainerDocumentElement;
  readonly view: ContainerViewState;
  readonly actions: ContainerActions;
  /** The container's text cards, positioned inside its frame. */
  readonly children?: ReactNode;
}

function ContainerRendererComponent({ element, view, actions, children }: ContainerRendererProps) {
  const { id, geometry, data } = element;
  const [article, setArticle] = useState<HTMLElement | null>(null);
  const shadowClass = view.shadowsUnderElements
    ? ""
    : ` canvas-attached-shadow-shell${view.moving ? " canvas-attached-drag-shadow" : ""}`;

  return (
    <article
      ref={setArticle}
      className={`taskmap-container${shadowClass}`}
      data-search={Boolean(view.extensions?.search) || undefined}
      data-moving={view.moving || undefined}
      data-multi-selected={view.multiSelected || undefined}
      data-entering={view.entering || undefined}
      data-deleting={view.deleting || undefined}
      style={{
        zIndex: 20 + view.layer,
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        backgroundColor: data.accent,
        borderColor: view.selected
          ? `color-mix(in srgb, ${data.accent} 72%, white 28%)`
          : data.accent,
      }}
      onPointerDown={(event) => {
        if (event.button !== 1) event.stopPropagation();
        if (event.button === 0 && view.multiSelected) {
          actions.onStartMove(event, id);
          return;
        }
        if (event.button === 0) actions.onSelect(id, event.shiftKey);
      }}
      onWheelCapture={(event) => actions.onWheelContent(event, id)}
    >
      <div className="taskmap-container__frame">
        <ContainerHeader element={element} view={view} actions={actions} article={article} />
        <div
          className="taskmap-container__content"
          data-privacy-hidden={Boolean(view.extensions?.privacy?.enabled) || undefined}
          onContextMenu={(event) => {
            if (view.multiSelected) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            actions.onOpenContentMenu(event, id);
          }}
          onPointerDown={(event) => actions.onStartContentSelection(event, id)}
          onWheelCapture={(event) => actions.onWheelContent(event, id)}
        />
        {children}
        <button
          className="taskmap-container__resize"
          onPointerDown={(event) => {
            event.currentTarget.blur();
            actions.onStartResize(event, id);
          }}
          title="Resize container"
        >
          <IconArrowDownRight size={18} stroke={2} />
        </button>
        <div
          className={`selection-overlay taskmap-container__selection${
            view.selected ? " selection-overlay-active" : ""
          }`}
        />
      </div>
    </article>
  );
}

/**
 * Children are recreated every render; the view's revision tokens stand in for them. Callers
 * rebuild the view state each render, so it is compared by value.
 */
const areContainerPropsEqual = (previous: ContainerRendererProps, next: ContainerRendererProps) => {
  if (previous.element !== next.element || previous.actions !== next.actions) return false;
  const previousView = previous.view as unknown as Record<string, unknown>;
  const nextView = next.view as unknown as Record<string, unknown>;
  const keys = Object.keys(previousView);
  return (
    keys.length === Object.keys(nextView).length &&
    keys.every((key) => previousView[key] === nextView[key])
  );
};

export const ContainerRenderer = memo(ContainerRendererComponent, areContainerPropsEqual);
