import { IconArrowDownRight } from "@tabler/icons-react";
import { Suspense, lazy, memo, useEffect, useRef, useState } from "react";
import type { WheelEvent } from "react";
import { placementStyle, shallowEqual } from "../elementPlacement";
import { TextBlockHeader } from "./TextBlockHeader";
import type { TextBlockDocumentElement } from "./textBlockModel";
import type { TextBlockActions, TextBlockViewState } from "./textBlockView";
import "../elementHeader.css";
import "./textBlock.css";

const MarkdownContent = lazy(() =>
  import("../../components/MarkdownContent").then(({ MarkdownContent }) => ({
    default: MarkdownContent,
  })),
);

export interface TextBlockRendererProps {
  readonly element: TextBlockDocumentElement;
  readonly view: TextBlockViewState;
  readonly actions: TextBlockActions;
}

function TextBlockRendererComponent({ element, view, actions }: TextBlockRendererProps) {
  const { id, data } = element;
  const { geometry } = view;
  const { editing, multiSelected } = view;
  const [article, setArticle] = useState<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }, [editing]);

  // The canvas pans on wheel; the body keeps the wheel while editing or when it can scroll.
  const keepScrollableWheel = (event: WheelEvent<HTMLElement>) => {
    const content = editing ? textareaRef.current : contentRef.current;
    const scrollable = Boolean(
      content &&
      (content.scrollHeight > content.clientHeight || content.scrollWidth > content.clientWidth),
    );
    if (editing || scrollable) event.stopPropagation();
  };

  const shadowClass = view.shadowsUnderElements
    ? ""
    : ` canvas-attached-shadow-shell${view.moving ? " canvas-attached-drag-shadow" : ""}`;

  return (
    <article
      ref={setArticle}
      className={`taskmap-text-block${shadowClass}`}
      data-moving={view.moving || undefined}
      data-multi-selected={multiSelected || undefined}
      data-entering={view.entering || undefined}
      data-deleting={view.deleting || undefined}
      data-pulsing={view.pulsing || undefined}
      style={{
        zIndex: 20 + view.layer,
        ...placementStyle(geometry),
        backgroundColor: data.accent,
        borderColor: view.selected
          ? `color-mix(in srgb, ${data.accent} 72%, white 28%)`
          : data.accent,
      }}
      onPointerDown={(event) => {
        if (event.button !== 1) event.stopPropagation();
        if (event.button === 0 && multiSelected) {
          actions.onStartMove(event, id);
          return;
        }
        if (event.button === 0) actions.onSelect(id, event.shiftKey);
      }}
    >
      <div className="taskmap-text-block__frame">
        <TextBlockHeader element={element} view={view} actions={actions} article={article} />
        <div
          className="taskmap-text-block__content"
          data-privacy-hidden={Boolean(view.extensions?.privacy?.enabled) || undefined}
          onWheel={keepScrollableWheel}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            if (multiSelected) {
              actions.onStartMove(event, id);
              return;
            }
            actions.onSelect(id, event.shiftKey);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            actions.onStartEdit(id);
          }}
        >
          {editing ? (
            <div className="taskmap-text-block__editor">
              <textarea
                ref={textareaRef}
                className="taskmap-scrollbar-hidden taskmap-text-block__textarea"
                value={view.draft}
                spellCheck={false}
                onChange={(event) => actions.onDraftChange(event.target.value)}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onBlur={() => actions.onSave(id)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") actions.onCancel();
                }}
              />
            </div>
          ) : (
            <div
              ref={contentRef}
              data-text-block-content
              className="markdown-content taskmap-scrollbar-hidden taskmap-text-block__markdown"
            >
              <Suspense fallback={<div className="taskmap-text-block__fallback">{data.text}</div>}>
                <MarkdownContent>{data.text}</MarkdownContent>
              </Suspense>
            </div>
          )}
        </div>
        <button
          className="taskmap-text-block__resize"
          onPointerDown={(event) => {
            event.currentTarget.blur();
            actions.onStartResize(event, id);
          }}
          title="Resize text block"
        >
          <IconArrowDownRight size={18} stroke={2} />
        </button>
        <div
          className={`selection-overlay taskmap-text-block__selection${
            view.selected ? " selection-overlay-active" : ""
          }`}
        />
      </div>
    </article>
  );
}

/** Callers rebuild the view state each render; compare it by value so idle blocks never re-render. */
const areTextBlockPropsEqual = (previous: TextBlockRendererProps, next: TextBlockRendererProps) => {
  if (previous.element !== next.element || previous.actions !== next.actions) return false;
  const { geometry: previousGeometry, ...previousView } = previous.view;
  const { geometry: nextGeometry, ...nextView } = next.view;
  return shallowEqual(previousView, nextView) && shallowEqual(previousGeometry, nextGeometry);
};

export const TextBlockRenderer = memo(TextBlockRendererComponent, areTextBlockPropsEqual);
