import {
  IconArrowDownRight,
  IconBold,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconEye,
  IconEyeOff,
  IconItalic,
  IconLock,
  IconLockOpen,
  IconNotes,
  IconUnderline,
} from "@tabler/icons-react";
import { MouseEvent, PointerEvent, WheelEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FormatMarker, isTextFormatActive, renderFormattedText, toggleTextFormat } from "../textFormatting";
import { DragState, TextBlockElement } from "../types";

function getDisplayedTextOffset(root: HTMLElement, clientX: number, clientY: number) {
  const documentWithCaret = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const caret =
    documentWithCaret.caretPositionFromPoint?.(clientX, clientY) ??
    (() => {
      const range = documentWithCaret.caretRangeFromPoint?.(clientX, clientY);
      return range ? { offsetNode: range.startContainer, offset: range.startOffset } : null;
    })();

  if (!caret || !root.contains(caret.offsetNode)) {
    return null;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node = walker.nextNode();

  while (node) {
    if (node === caret.offsetNode) {
      return offset + caret.offset;
    }

    offset += node.textContent?.length ?? 0;
    node = walker.nextNode();
  }

  return offset;
}

function rawIndexFromDisplayedOffset(text: string, targetOffset: number) {
  const formattedPartPattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g;
  let displayedOffset = 0;
  let rawIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = formattedPartPattern.exec(text))) {
    const plainText = text.slice(rawIndex, match.index);
    if (targetOffset <= displayedOffset + plainText.length) {
      return rawIndex + targetOffset - displayedOffset;
    }

    displayedOffset += plainText.length;

    const part = match[0];
    const markerLength = part.startsWith("**") || part.startsWith("__") ? 2 : 1;
    const contentLength = part.length - markerLength * 2;

    if (targetOffset <= displayedOffset + contentLength) {
      return match.index + markerLength + targetOffset - displayedOffset;
    }

    displayedOffset += contentLength;
    rawIndex = match.index + part.length;
  }

  const remainingText = text.slice(rawIndex);
  if (targetOffset <= displayedOffset + remainingText.length) {
    return rawIndex + targetOffset - displayedOffset;
  }

  return text.length;
}

function getFormatButtonClass(active: boolean) {
  return `grid h-7 w-7 place-items-center rounded-md transition-colors ${
    active
      ? "bg-white/[0.16] text-white ring-1 ring-white/20"
      : "text-white/75 hover:bg-white/[0.10] hover:text-white"
  }`;
}

type TextBlockNodeProps = {
  element: TextBlockElement;
  selected: boolean;
  multiSelected: boolean;
  entering: boolean;
  deleting: boolean;
  pulsing: boolean;
  dragState: DragState | null;
  editing: boolean;
  draft: string;
  renaming: boolean;
  renameDraft: string;
  onDraftChange: (value: string) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onRenameDraftChange: (value: string) => void;
  onSaveRename: (id: string) => void;
  onCancelRename: () => void;
  onStartEdit: (element: TextBlockElement, caretPosition?: number) => void;
  onSelect: (element: TextBlockElement) => void;
  onStartMove: (event: PointerEvent<HTMLElement>, element: TextBlockElement) => void;
  onStartResize: (event: PointerEvent<HTMLButtonElement>, element: TextBlockElement) => void;
  onToggleMenu: (event: MouseEvent<HTMLButtonElement>, element: TextBlockElement) => void;
  onTogglePrivacy: (id: string) => void;
  onToggleLock: (id: string) => void;
};

export function TextBlockNode({
  element,
  selected,
  multiSelected,
  entering,
  deleting,
  pulsing,
  dragState,
  editing,
  draft,
  renaming,
  renameDraft,
  onDraftChange,
  onSave,
  onCancel,
  onRenameDraftChange,
  onSaveRename,
  onCancelRename,
  onStartEdit,
  onSelect,
  onStartMove,
  onStartResize,
  onToggleMenu,
  onTogglePrivacy,
  onToggleLock,
}: TextBlockNodeProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pendingCaretPositionRef = useRef<number | null>(null);
  const pendingScrollTopRef = useRef(0);
  const [formatMenu, setFormatMenu] = useState<{
    left: number;
    top: number;
    start: number;
    end: number;
  } | null>(null);

  useEffect(() => {
    if (!editing) {
      return;
    }

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      textarea?.focus();

      if (textarea && pendingCaretPositionRef.current !== null) {
        const caretPosition = pendingCaretPositionRef.current;
        textarea.scrollTop = pendingScrollTopRef.current;
        textarea.setSelectionRange(caretPosition, caretPosition);
        pendingCaretPositionRef.current = null;
      }
    });
  }, [editing]);

  const handleTextBlockWheel = (event: WheelEvent<HTMLElement>) => {
    // While editing, keep the wheel for scrolling the textarea. Otherwise let it
    // bubble to the canvas so zooming works with the pointer over a text block.
    if (editing) {
      event.stopPropagation();
    }
  };

  const updateFormatMenu = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    if (start === end) {
      setFormatMenu(null);
      return;
    }

    const rect = textarea.getBoundingClientRect();
    setFormatMenu({
      left: rect.left + rect.width / 2,
      top: rect.top - 38,
      start,
      end,
    });
  };

  const updateFormatMenuAfterSelection = () => {
    window.setTimeout(updateFormatMenu, 0);
  };

  const applyFormat = (marker: FormatMarker) => {
    if (!formatMenu) {
      return;
    }

    const formatted = toggleTextFormat(draft, formatMenu.start, formatMenu.end, marker);
    const nextDraft = formatted.text;
    const selectionStart = formatted.start;
    const selectionEnd = formatted.end;

    onDraftChange(nextDraft);
    setFormatMenu((current) =>
      current ? { ...current, start: selectionStart, end: selectionEnd } : current,
    );
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const handleFormatPointerDown = (event: PointerEvent<HTMLButtonElement>, marker: FormatMarker) => {
    event.preventDefault();
    event.stopPropagation();
    applyFormat(marker);
  };

  const isFormatActive = (marker: FormatMarker) =>
    formatMenu ? isTextFormatActive(draft, formatMenu.start, formatMenu.end, marker) : false;
  const privacyEnabled = Boolean(element.extensions?.privacy?.enabled);
  const lockInstalled = Boolean(element.extensions?.lock);
  const lockEnabled = Boolean(element.extensions?.lock?.enabled);
  const [extensionButtonsVisible, setExtensionButtonsVisible] = useState(true);
  const headerExtensionButtonCount = (lockInstalled ? 1 : 0) + (element.extensions?.privacy ? 1 : 0);
  const collapsibleExtensions = headerExtensionButtonCount > 1;

  return (
    <article
      className={`absolute z-20 overflow-visible rounded-xl border-2 border-[color:var(--container-chrome)] shadow-xl ${
        entering ? "container-enter" : ""
      } ${deleting ? "container-exit pointer-events-none" : ""} ${pulsing ? "text-card-pulse" : ""}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        backgroundColor: element.accent,
        borderColor: element.accent,
        boxShadow: "0 18px 42px rgba(0, 0, 0, 0.42)",
      }}
      onPointerDown={(event) => {
        if (event.button !== 1) {
          event.stopPropagation();
        }

        if (event.button === 0 && multiSelected) {
          onStartMove(event, element);
          return;
        }

        if (event.button === 0) {
          onSelect(element);
        }
      }}
    >
      <div
        className="pointer-events-none absolute -inset-[6px] rounded-[15px] border-2 border-[#2dd8c8]/75 transition-opacity duration-100 ease-out"
        style={{
          opacity: selected ? 1 : 0,
          boxShadow: "0 0 14px rgba(45, 216, 200, 0.10)",
        }}
      />
      <div className="relative h-full overflow-hidden rounded-[10px]">
        <div
          className={`relative z-30 flex h-10 items-center justify-between px-3 text-white ${
            dragState?.type === "move" && dragState.ids.includes(element.id)
              ? "cursor-grabbing"
              : "cursor-grab"
          }`}
          style={{ backgroundColor: element.accent }}
          onPointerDown={(event) => onStartMove(event, element)}
        >
          <div className="flex min-w-0 items-center gap-2">
            <IconNotes size={18} stroke={2} className="shrink-0 text-white/80" />
            {renaming ? (
              <input
                data-container-rename-input
                className="h-7 min-w-0 flex-1 appearance-none rounded-md border border-white/20 bg-black/[0.18] px-2 text-[14px] font-semibold text-white outline-none selection:bg-white/20 focus:border-white/45"
                value={renameDraft}
                autoFocus
                spellCheck={false}
                onChange={(event) => onRenameDraftChange(event.target.value)}
                onFocus={(event) => event.target.select()}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onBlur={() => onSaveRename(element.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSaveRename(element.id);
                  }

                  if (event.key === "Escape") {
                    onCancelRename();
                  }
                }}
              />
            ) : (
              <span className="truncate text-[14px] font-semibold text-white/86">{element.name}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {collapsibleExtensions && (
              <button
                className="grid h-8 w-6 place-items-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
                onClick={(event) => {
                  event.stopPropagation();
                  setExtensionButtonsVisible((current) => !current);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                title={extensionButtonsVisible ? "Hide extension buttons" : "Show extension buttons"}
              >
                {extensionButtonsVisible ? (
                  <IconChevronRight size={18} stroke={2} />
                ) : (
                  <IconChevronLeft size={18} stroke={2} />
                )}
              </button>
            )}
            <div
              className={`flex items-center gap-1 overflow-hidden transition-[max-width,opacity,transform] duration-150 ease-out ${
                !collapsibleExtensions || extensionButtonsVisible
                  ? "max-w-[76px] translate-x-0 opacity-100"
                  : "pointer-events-none max-w-0 translate-x-2 opacity-0"
              }`}
            >
              {lockInstalled && (
                <button
                  className={`grid h-8 w-8 place-items-center rounded-md transition-colors hover:bg-white/10 hover:text-white active:bg-white/15 ${
                    lockEnabled ? "bg-white/10 text-white" : "text-white/70"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleLock(element.id);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title={lockEnabled ? "Unlock" : "Lock"}
                >
                  {lockEnabled ? <IconLock size={18} stroke={2} /> : <IconLockOpen size={18} stroke={2} />}
                </button>
              )}
              {element.extensions?.privacy && (
                <button
                  className={`grid h-8 w-8 place-items-center rounded-md transition-colors hover:bg-white/10 hover:text-white active:bg-white/15 ${
                    privacyEnabled ? "bg-white/10 text-white" : "text-white/70"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onTogglePrivacy(element.id);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title={privacyEnabled ? "Show content" : "Hide content"}
                >
                  {privacyEnabled ? <IconEyeOff size={18} stroke={2} /> : <IconEye size={18} stroke={2} />}
                </button>
              )}
            </div>
            <button
              className="grid h-8 w-8 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
              onClick={(event) => onToggleMenu(event, element)}
              onPointerDown={(event) => event.stopPropagation()}
              title="Text block menu"
            >
              <IconDotsVertical size={18} stroke={2} />
            </button>
          </div>
        </div>

        <div
          className={`h-[calc(100%-40px)] bg-[color:var(--container-bg)] transition-[filter] ${
            privacyEnabled ? "select-none blur-[5px]" : ""
          } ${
            multiSelected
              ? dragState?.type === "move" && dragState.ids.includes(element.id)
                ? "cursor-grabbing"
                : "cursor-grab"
              : ""
          }`}
          onWheel={handleTextBlockWheel}
          onPointerDown={(event) => {
            if (event.button !== 0 || multiSelected) {
              return;
            }

            event.stopPropagation();
            const displayOffset = getDisplayedTextOffset(event.currentTarget, event.clientX, event.clientY);
            const caretPosition = rawIndexFromDisplayedOffset(element.text, displayOffset ?? element.text.length);
            pendingCaretPositionRef.current = caretPosition;
            pendingScrollTopRef.current = contentRef.current?.scrollTop ?? 0;
            onStartEdit(element, caretPosition);
          }}
        >
          {editing ? (
            <div className="relative h-full">
              {formatMenu &&
                createPortal(
                  <span
                    className="fixed z-[1000] flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-white/[0.14] bg-[#1b1b1e] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.42)]"
                    style={{ left: formatMenu.left, top: formatMenu.top }}
                    onPointerDown={(event) => event.preventDefault()}
                  >
                    <button
                      type="button"
                      className={getFormatButtonClass(isFormatActive("**"))}
                      aria-pressed={isFormatActive("**")}
                      onPointerDown={(event) => handleFormatPointerDown(event, "**")}
                      title="Bold"
                    >
                      <IconBold size={20} stroke={2} />
                    </button>
                    <button
                      type="button"
                      className={getFormatButtonClass(isFormatActive("*"))}
                      aria-pressed={isFormatActive("*")}
                      onPointerDown={(event) => handleFormatPointerDown(event, "*")}
                      title="Italic"
                    >
                      <IconItalic size={20} stroke={2} />
                    </button>
                    <button
                      type="button"
                      className={getFormatButtonClass(isFormatActive("__"))}
                      aria-pressed={isFormatActive("__")}
                      onPointerDown={(event) => handleFormatPointerDown(event, "__")}
                      title="Underline"
                    >
                      <IconUnderline size={20} stroke={2} />
                    </button>
                  </span>,
                  document.body,
                )}
              <textarea
                ref={textareaRef}
                className="hidden-scrollbar h-full w-full resize-none overflow-auto bg-transparent px-4 py-3 text-[16px] leading-6 text-white outline-none selection:bg-white/25"
                value={draft}
                spellCheck={false}
                onChange={(event) => onDraftChange(event.target.value)}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setFormatMenu(null);
                }}
                onPointerUp={updateFormatMenuAfterSelection}
                onClick={(event) => {
                  event.stopPropagation();
                  setFormatMenu(null);
                }}
                onBlur={() => {
                  setFormatMenu(null);
                  onSave(element.id);
                }}
                onKeyUp={updateFormatMenu}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    onCancel();
                  }
                }}
              />
            </div>
          ) : (
            <div
              ref={contentRef}
              className="hidden-scrollbar h-full overflow-auto whitespace-pre-wrap break-words px-4 py-3 text-[16px] leading-6 text-white/92"
            >
              {renderFormattedText(element.text)}
            </div>
          )}
        </div>

        <button
          className="absolute bottom-1.5 right-1.5 z-30 grid h-7 w-7 cursor-nwse-resize place-items-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white/80 active:bg-white/15 active:text-white focus:outline-none"
          onPointerDown={(event) => {
            event.currentTarget.blur();
            onStartResize(event, element);
          }}
          title="Resize text block"
        >
          <IconArrowDownRight size={18} stroke={2} />
        </button>
      </div>
    </article>
  );
}
