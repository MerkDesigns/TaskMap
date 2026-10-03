import { IconBox, IconDotsVertical, IconSearch, IconX } from "@tabler/icons-react";
import { useRef } from "react";
import type { SyntheticEvent } from "react";
import type { ExtensionCommands } from "../../extensions/headerControl";
import type { HeaderLayoutMetrics } from "../useHeaderExtensionLayout";
import { useElementHeaderExtensions } from "../useElementHeaderExtensions";
import type { ContainerDocumentElement } from "./containerModel";
import type { ContainerActions, ContainerViewState } from "./containerView";

export interface ContainerHeaderProps {
  readonly element: ContainerDocumentElement;
  readonly view: ContainerViewState;
  readonly actions: ContainerActions;
  readonly extensionCommands: ExtensionCommands;
  /** The container's article; the overflow popover renders into it, outside the frame's clip. */
  readonly article: HTMLElement | null;
}

const CONTAINER_HEADER_METRICS: HeaderLayoutMetrics = {
  horizontalPadding: 32,
  minimumTitleReserve: 76,
  titleShare: 0.42,
  spacing: 12,
};

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function ContainerHeader({
  element,
  view,
  actions,
  extensionCommands,
  article,
}: ContainerHeaderProps) {
  const { id, data } = element;
  const { extensions, renaming, renameDraft } = view;
  const searchInstalled = Boolean(extensions?.search);
  const searchQuery = extensions?.search?.query ?? "";
  const rowRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const headerExtensions = useElementHeaderExtensions({
    context: {
      elementId: id,
      host: "container",
      extensions: extensions ?? {},
      accent: data.accent,
      cardCount: view.cardCount,
      recentColors: view.recentColors,
    },
    commands: extensionCommands,
    buttonsVisible: data.headerButtonsVisible,
    onButtonsVisibleChange: (visible) => actions.onHeaderButtonsVisibleChange(id, visible),
    name: data.name,
    renaming,
    metrics: CONTAINER_HEADER_METRICS,
    rowRef,
    titleRef,
    article,
    width: view.geometry.width,
  });

  return (
    <>
      <div
        className="taskmap-container__header"
        style={{ backgroundColor: data.accent }}
        onPointerDown={(event) => actions.onStartMove(event, id)}
      >
        <div ref={rowRef} className="taskmap-container__header-row">
          <div ref={titleRef} className="taskmap-container__title">
            <span className="taskmap-container__icon">
              <IconBox size={19} stroke={2} />
            </span>
            {renaming ? (
              <input
                data-container-rename-input
                className="taskmap-element-header__rename taskmap-container__rename"
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
              <span className="taskmap-element-header__name taskmap-container__name">
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
              title="Container menu"
            >
              <IconDotsVertical size={18} stroke={2} />
            </button>
          </div>
        </div>

        {searchInstalled && (
          <div
            className="taskmap-container__search-row"
            onPointerDown={stopPropagation}
            onClick={stopPropagation}
          >
            <div className="taskmap-container__search">
              <IconSearch size={16} stroke={2} />
              <input
                className="taskmap-container__search-input"
                value={searchQuery}
                spellCheck={false}
                placeholder="Search"
                onChange={(event) => actions.onSearchChange(id, event.target.value)}
              />
              {searchQuery && (
                <button
                  className="taskmap-container__search-clear"
                  onClick={() => actions.onSearchChange(id, "")}
                  title="Clear search"
                >
                  <IconX size={15} stroke={2} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Siblings of the header, so their presses never reach its start-move handler. */}
      {headerExtensions.popovers}
    </>
  );
}
