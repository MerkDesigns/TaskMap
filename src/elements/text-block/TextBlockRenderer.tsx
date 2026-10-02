import { IconArrowDownRight } from "@tabler/icons-react";
import { Suspense, lazy, memo, useEffect, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import type { TextBlockElement } from "../../types";
import { TextBlockHeader, type TextBlockHeaderProps } from "./TextBlockHeader";
import "../elementHeader.css";
import "./textBlock.css";

const MarkdownContent = lazy(() =>
  import("../../components/MarkdownContent").then(({ MarkdownContent }) => ({
    default: MarkdownContent,
  })),
);

export type TextBlockRendererProps = Omit<TextBlockHeaderProps, "article"> & {
  readonly selected: boolean;
  readonly multiSelected: boolean;
  readonly entering: boolean;
  readonly deleting: boolean;
  readonly pulsing: boolean;
  readonly moving: boolean;
  readonly shadowsUnderElements: boolean;
  readonly editing: boolean;
  readonly draft: string;
  readonly onDraftChange: (value: string) => void;
  readonly onSave: (id: string) => void;
  readonly onCancel: () => void;
  readonly onStartEdit: (element: TextBlockElement) => void;
  readonly onSelect: (element: TextBlockElement, additive?: boolean) => void;
  readonly onStartResize: (
    event: PointerEvent<HTMLButtonElement>,
    element: TextBlockElement,
  ) => void;
};

function TextBlockRendererComponent({
  selected,
  multiSelected,
  entering,
  deleting,
  pulsing,
  moving,
  shadowsUnderElements,
  editing,
  draft,
  onDraftChange,
  onSave,
  onCancel,
  onStartEdit,
  onSelect,
  onStartResize,
  ...headerProps
}: TextBlockRendererProps) {
  const { element, onStartMove } = headerProps;
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

  const shadowClass = shadowsUnderElements
    ? ""
    : ` canvas-attached-shadow-shell${moving ? " canvas-attached-drag-shadow" : ""}`;

  return (
    <article
      ref={setArticle}
      className={`taskmap-text-block${shadowClass}`}
      data-moving={moving || undefined}
      data-multi-selected={multiSelected || undefined}
      data-entering={entering || undefined}
      data-deleting={deleting || undefined}
      data-pulsing={pulsing || undefined}
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
    >
      <div className="taskmap-text-block__frame">
        <TextBlockHeader {...headerProps} article={article} />
        <div
          className="taskmap-text-block__content"
          data-privacy-hidden={Boolean(element.extensions?.privacy?.enabled) || undefined}
          onWheel={keepScrollableWheel}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            if (multiSelected) {
              onStartMove(event, element);
              return;
            }
            onSelect(element, event.shiftKey);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            onStartEdit(element);
          }}
        >
          {editing ? (
            <div className="taskmap-text-block__editor">
              <textarea
                ref={textareaRef}
                className="taskmap-scrollbar-hidden taskmap-text-block__textarea"
                value={draft}
                spellCheck={false}
                onChange={(event) => onDraftChange(event.target.value)}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onBlur={() => onSave(element.id)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") onCancel();
                }}
              />
            </div>
          ) : (
            <div
              ref={contentRef}
              data-text-block-content
              className="markdown-content taskmap-scrollbar-hidden taskmap-text-block__markdown"
            >
              <Suspense
                fallback={<div className="taskmap-text-block__fallback">{element.text}</div>}
              >
                <MarkdownContent>{element.text}</MarkdownContent>
              </Suspense>
            </div>
          )}
        </div>
        <button
          className="taskmap-text-block__resize"
          onPointerDown={(event) => {
            event.currentTarget.blur();
            onStartResize(event, element);
          }}
          title="Resize text block"
        >
          <IconArrowDownRight size={18} stroke={2} />
        </button>
        <div
          className={`selection-overlay taskmap-text-block__selection${
            selected ? " selection-overlay-active" : ""
          }`}
        />
      </div>
    </article>
  );
}

export const TextBlockRenderer = memo(TextBlockRendererComponent);
