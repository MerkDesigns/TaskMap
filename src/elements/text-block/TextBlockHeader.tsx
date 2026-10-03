import { IconDotsVertical, IconNotes } from "@tabler/icons-react";
import { useRef } from "react";
import type { SyntheticEvent } from "react";
import type { ExtensionCommands } from "../../extensions/headerControl";
import type { HeaderLayoutMetrics } from "../useHeaderExtensionLayout";
import { useElementHeaderExtensions } from "../useElementHeaderExtensions";
import type { TextBlockDocumentElement } from "./textBlockModel";
import type { TextBlockActions, TextBlockViewState } from "./textBlockView";

export interface TextBlockHeaderProps {
  readonly element: TextBlockDocumentElement;
  readonly view: TextBlockViewState;
  readonly actions: TextBlockActions;
  readonly extensionCommands: ExtensionCommands;
  /** The text block's article; the overflow popover renders into it, outside the frame's clip. */
  readonly article: HTMLElement | null;
}

const TEXT_BLOCK_HEADER_METRICS: HeaderLayoutMetrics = {
  horizontalPadding: 24,
  minimumTitleReserve: 56,
  titleShare: 0.38,
  spacing: 10,
};

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function TextBlockHeader({
  element,
  view,
  actions,
  extensionCommands,
  article,
}: TextBlockHeaderProps) {
  const { id, data } = element;
  const { renaming, renameDraft } = view;
  const headerRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const headerExtensions = useElementHeaderExtensions({
    context: {
      elementId: id,
      host: "text-block",
      extensions: view.extensions ?? {},
      accent: data.accent,
      cardCount: 0,
      recentColors: view.recentColors,
    },
    commands: extensionCommands,
    buttonsVisible: data.headerButtonsVisible,
    onButtonsVisibleChange: (visible) => actions.onHeaderButtonsVisibleChange(id, visible),
    name: data.name,
    renaming,
    metrics: TEXT_BLOCK_HEADER_METRICS,
    rowRef: headerRef,
    titleRef,
    article,
    width: view.geometry.width,
  });

  return (
    <>
      <div
        ref={headerRef}
        className="taskmap-text-block__header"
        style={{ backgroundColor: data.accent }}
        onPointerDown={(event) => actions.onStartMove(event, id)}
      >
        <div ref={titleRef} className="taskmap-text-block__title">
          <IconNotes size={18} stroke={2} />
          {renaming ? (
            <input
              data-container-rename-input
              className="taskmap-element-header__rename taskmap-text-block__rename"
              value={renameDraft}
              autoFocus
              spellCheck={false}
              onChange={(event) => actions.onRenameDraftChange(event.target.value)}
              onFocus={(event) => event.target.select()}
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
              onBlur={() => actions.onSaveRename(id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") actions.onSaveRename(id);
                if (event.key === "Escape") actions.onCancelRename();
              }}
            />
          ) : (
            <span className="taskmap-element-header__name taskmap-text-block__name">
              {data.name}
            </span>
          )}
        </div>
        <div className="taskmap-element-header__controls">
          {headerExtensions.controls}
          <button
            className="taskmap-element-header__button"
            data-kind="menu"
            onClick={(event) => actions.onToggleMenu(event, id)}
            onPointerDown={stopPropagation}
            title="Text block menu"
          >
            <IconDotsVertical size={18} stroke={2} />
          </button>
        </div>
      </div>
      {/* Siblings of the header, so their presses never reach its start-move handler. */}
      {headerExtensions.popovers}
    </>
  );
}
