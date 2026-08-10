import {
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconCheck,
  IconDotsVertical,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconPencil,
  IconPlus,
  IconStack2,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  CONTEXT_MENU_PANEL_CLASS,
  MENU_DANGER_ITEM_CLASS,
  MENU_DIVIDER_CLASS,
  MENU_ITEM_CLASS,
} from "../constants";
import { TaskCanvas } from "../types";
import { WorkspacePanelHeader, WorkspaceSidePanel } from "../ui/patterns/workspace";
import { IconButton, ToggleButton } from "../ui/primitives/Button";
import { ScrollArea } from "../ui/primitives/Layout";
import { Counter } from "../ui/primitives/Status";
import { useClampedFixedPosition } from "../useClampedFixedPosition";

type CanvasDraft = Pick<TaskCanvas, "name" | "width" | "height">;

type CanvasManagerProps = {
  canvases: TaskCanvas[];
  activeCanvasId: string;
  cycleHighlightCanvasId?: string | null;
  closing: boolean;
  embedded?: boolean;
  minimalView: boolean;
  viewportWidth: number;
  viewportHeight: number;
  onMinimalViewChange: (minimalView: boolean) => void;
  onCreateCanvas: (draft: CanvasDraft) => void;
  onSelectCanvas: (id: string) => void;
  onUpdateCanvas: (id: string, updates: CanvasDraft) => void;
  onDeleteCanvas: (id: string) => void;
  onReorderCanvases: (orderedIds: string[]) => void;
};

type DragLayoutRow = {
  id: string;
  top: number;
  height: number;
};

type PreviewViewportSize = {
  width: number;
  height: number;
};

type CanvasDragState = {
  id: string;
  pointerId: number;
  startY: number;
  currentY: number;
  lastAnchorY: number;
  offsetY: number;
  active: boolean;
  orderIds: string[];
  layout: DragLayoutRow[];
  sourceNode: HTMLDivElement;
  cloneNode: HTMLElement;
  rafId: number | null;
  cleanup: (() => void) | null;
};

const DEFAULT_DRAFT: CanvasDraft = {
  name: "",
  width: 3000,
  height: 3000,
};

function clampDraftSize(value: number) {
  if (!Number.isFinite(value)) {
    return 3000;
  }

  return Math.min(Math.max(Math.round(value), 600), 10000);
}

export function CanvasManager({
  canvases,
  activeCanvasId,
  cycleHighlightCanvasId = null,
  closing,
  embedded = false,
  minimalView,
  viewportWidth,
  viewportHeight,
  onMinimalViewChange,
  onCreateCanvas,
  onSelectCanvas,
  onUpdateCanvas,
  onDeleteCanvas,
  onReorderCanvases,
}: CanvasManagerProps) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const reorderFirstRectsRef = useRef<Record<string, DOMRect> | null>(null);
  const cardAnimationsRef = useRef<Record<string, Animation>>({});
  const previewViewportSizesRef = useRef<Record<string, PreviewViewportSize>>({});
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<CanvasDragState | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const suppressClickRef = useRef(false);
  const [modalMode, setModalMode] = useState<"create" | null>(null);
  const [createMenuClosing, setCreateMenuClosing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CanvasDraft>(DEFAULT_DRAFT);
  const menuPosition = useClampedFixedPosition(menuRef, {
    left: menu?.left ?? 0,
    top: menu?.top ?? 0,
  });

  const openCreate = () => {
    if (modalMode === "create") {
      closeModal();
      return;
    }

    setEditingId(null);
    setCreateMenuClosing(false);
    setDraft({
      name: `Canvas ${canvases.length + 1}`,
      width: 3000,
      height: 3000,
    });
    setModalMode("create");
  };

  const openEdit = (canvas: TaskCanvas) => {
    setEditingId(canvas.id);
    setDraft({
      name: canvas.name,
      width: canvas.width,
      height: canvas.height,
    });
    setMenu(null);
    requestAnimationFrame(() => {
      cardRefs.current[canvas.id]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  const closeModal = useCallback(() => {
    if (!modalMode || createMenuClosing) {
      return;
    }

    setCreateMenuClosing(true);
    window.setTimeout(() => {
      setModalMode(null);
      setCreateMenuClosing(false);
      setEditingId(null);
      setDraft(DEFAULT_DRAFT);
    }, 120);
  }, [createMenuClosing, modalMode]);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
  }, [editingId]);

  useEffect(() => {
    if (!cycleHighlightCanvasId) {
      return;
    }

    requestAnimationFrame(() => {
      cardRefs.current[cycleHighlightCanvasId]?.scrollIntoView({ block: "nearest" });
    });
  }, [cycleHighlightCanvasId]);

  useEffect(() => {
    if (!menu) {
      return;
    }

    const closeMenu = (event: PointerEvent) => {
      if (
        !(event.target as HTMLElement | null)?.closest(
          "[data-context-menu], [data-canvas-menu-trigger]",
        )
      ) {
        setMenu(null);
      }
    };

    window.addEventListener("pointerdown", closeMenu, true);
    return () => window.removeEventListener("pointerdown", closeMenu, true);
  }, [menu]);

  useEffect(() => {
    if (!modalMode) {
      return;
    }

    const closeCreateMenu = (event: PointerEvent) => {
      if (
        !(event.target as HTMLElement | null)?.closest(
          "[data-new-canvas-menu], [data-new-canvas-trigger]",
        )
      ) {
        closeModal();
      }
    };

    window.addEventListener("pointerdown", closeCreateMenu, true);
    return () => window.removeEventListener("pointerdown", closeCreateMenu, true);
  }, [closeModal, modalMode]);

  const saveInlineEdit = () => {
    if (!editingId) {
      return;
    }

    onUpdateCanvas(editingId, {
      name: draft.name.trim() || "Untitled canvas",
      width: clampDraftSize(draft.width),
      height: clampDraftSize(draft.height),
    });
    setEditingId(null);
    setDraft(DEFAULT_DRAFT);
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setDraft(DEFAULT_DRAFT);
  };

  const submitModal = () => {
    const nextDraft = {
      name: draft.name.trim() || "Untitled canvas",
      width: clampDraftSize(draft.width),
      height: clampDraftSize(draft.height),
    };

    if (modalMode === "create") {
      onCreateCanvas(nextDraft);
      setModalMode(null);
      setCreateMenuClosing(false);
      setDraft(DEFAULT_DRAFT);
      return;
    }
  };

  const orderedIds = canvases.map((canvas) => canvas.id);
  const orderedIdsKey = orderedIds.join("|");

  const captureCardRects = () => {
    const rects: Record<string, DOMRect> = {};

    orderedIds.forEach((id) => {
      const node = cardRefs.current[id];
      if (node) {
        rects[id] = node.getBoundingClientRect();
      }
    });

    return rects;
  };

  const cancelCardAnimations = () => {
    Object.values(cardAnimationsRef.current).forEach((animation) => animation.cancel());
    cardAnimationsRef.current = {};
  };

  useLayoutEffect(() => {
    const firstRects = reorderFirstRectsRef.current;
    reorderFirstRectsRef.current = null;

    if (!firstRects) {
      rebuildDragLayout();
      return;
    }

    Object.keys(firstRects).forEach((id) => {
      const node = cardRefs.current[id];
      if (!node) {
        return;
      }

      const previousRect = firstRects[id];
      const nextRect = node.getBoundingClientRect();

      if (!previousRect || id === draggingId) {
        return;
      }

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }

      cardAnimationsRef.current[id]?.cancel();
      const animation = node.animate(
        [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: "translate(0, 0)" }],
        {
          duration: 190,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        },
      );
      cardAnimationsRef.current[id] = animation;
      animation.onfinish = () => {
        delete cardAnimationsRef.current[id];
      };
      animation.oncancel = () => {
        delete cardAnimationsRef.current[id];
      };
    });

    rebuildDragLayout();
  }, [draggingId, orderedIdsKey]);

  const rebuildDragLayout = () => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }

    drag.layout = drag.orderIds
      .map((id) => {
        const node = cardRefs.current[id];
        if (!node) {
          return null;
        }

        const rect = node.getBoundingClientRect();
        return {
          id,
          top: rect.top,
          height: rect.height,
        };
      })
      .filter((row): row is DragLayoutRow => Boolean(row));
  };

  const updateDragOrder = (anchorY: number) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }

    const deltaY = anchorY - drag.lastAnchorY;
    drag.lastAnchorY = anchorY;

    if (Math.abs(deltaY) < 0.5) {
      return;
    }

    const currentIndex = drag.orderIds.indexOf(drag.id);
    if (currentIndex === -1) {
      return;
    }

    const movingDown = deltaY > 0;
    const targetId = movingDown ? drag.orderIds[currentIndex + 1] : drag.orderIds[currentIndex - 1];
    if (!targetId) {
      return;
    }

    const target = drag.layout.find((row) => row.id === targetId);
    if (!target) {
      return;
    }

    const targetMidpoint = target.top + target.height / 2;
    const crossedTrigger = movingDown ? anchorY > targetMidpoint : anchorY < targetMidpoint;
    if (!crossedTrigger) {
      return;
    }

    const nextIds = drag.orderIds.filter((id) => id !== drag.id);
    const targetIndex = nextIds.indexOf(targetId);
    if (targetIndex === -1) {
      return;
    }

    nextIds.splice(movingDown ? targetIndex + 1 : targetIndex, 0, drag.id);

    if (drag.orderIds.join("|") === nextIds.join("|")) {
      return;
    }

    reorderFirstRectsRef.current = captureCardRects();
    cancelCardAnimations();
    drag.orderIds = nextIds;
    onReorderCanvases(nextIds);
    requestAnimationFrame(rebuildDragLayout);
  };

  useLayoutEffect(() => {
    rebuildDragLayout();
  }, [orderedIdsKey]);

  const finishDrag = () => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }

    if (drag.rafId !== null) {
      cancelAnimationFrame(drag.rafId);
    }

    try {
      drag.sourceNode.releasePointerCapture(drag.pointerId);
    } catch {
      // Pointer capture is best-effort; document listeners still clean up the drag.
    }

    drag.cleanup?.();
    drag.cloneNode.remove();
    drag.sourceNode.style.opacity = "";
    dragRef.current = null;
    setDraggingId(null);
  };

  const runDragFrame = () => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }

    drag.rafId = null;

    const distanceY = Math.abs(drag.currentY - drag.startY);
    if (!drag.active && distanceY <= 6) {
      return;
    }

    if (!drag.active) {
      drag.active = true;
      suppressClickRef.current = true;
      setDraggingId(drag.id);
    }

    const cloneTop = drag.currentY - drag.offsetY;
    drag.cloneNode.style.top = `${cloneTop}px`;
    updateDragOrder(drag.currentY);
  };

  const handleDragPointerMove = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    event.preventDefault();
    drag.currentY = event.clientY;

    if (drag.rafId === null) {
      drag.rafId = requestAnimationFrame(runDragFrame);
    }
  };

  const handleDragPointerEnd = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    event.preventDefault();
    finishDrag();
  };

  const startCanvasDrag = (event: ReactPointerEvent<HTMLDivElement>, canvas: TaskCanvas) => {
    if (
      editingId === canvas.id ||
      event.button !== 0 ||
      (event.target as HTMLElement | null)?.closest("button,input,[data-context-menu]")
    ) {
      return;
    }

    event.preventDefault();
    setEditingId(null);
    setMenu(null);
    suppressClickRef.current = false;

    const sourceNode = event.currentTarget;
    const rect = sourceNode.getBoundingClientRect();
    const cloneNode = sourceNode.cloneNode(true) as HTMLElement;
    cloneNode.removeAttribute("data-canvas-card-id");
    cloneNode.removeAttribute("data-bar-id");
    cloneNode.style.position = "fixed";
    cloneNode.style.left = `${rect.left}px`;
    cloneNode.style.top = `${rect.top}px`;
    cloneNode.style.width = `${rect.width}px`;
    cloneNode.style.height = `${rect.height}px`;
    cloneNode.style.zIndex = "9999";
    cloneNode.style.pointerEvents = "none";
    cloneNode.style.transition = "none";
    cloneNode.style.boxShadow = "0 18px 48px rgba(0, 0, 0, 0.52)";
    cloneNode.style.opacity = "0.96";
    document.body.appendChild(cloneNode);

    const orderIds = canvases.map((currentCanvas) => currentCanvas.id);
    const layout = orderIds
      .map((id) => {
        const node = cardRefs.current[id];
        if (!node) {
          return null;
        }

        const nodeRect = node.getBoundingClientRect();
        return {
          id,
          top: nodeRect.top,
          height: nodeRect.height,
        };
      })
      .filter((row): row is DragLayoutRow => Boolean(row));

    sourceNode.style.opacity = "0";

    try {
      sourceNode.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; document listeners handle the reliable path.
    }

    const cleanup = () => {
      document.removeEventListener("pointermove", handleDragPointerMove);
      document.removeEventListener("pointerup", handleDragPointerEnd);
      document.removeEventListener("pointercancel", handleDragPointerEnd);
      sourceNode.removeEventListener("pointermove", handleDragPointerMove);
      sourceNode.removeEventListener("pointerup", handleDragPointerEnd);
      sourceNode.removeEventListener("pointercancel", handleDragPointerEnd);
    };

    dragRef.current = {
      id: canvas.id,
      pointerId: event.pointerId,
      startY: event.clientY,
      currentY: event.clientY,
      lastAnchorY: event.clientY,
      offsetY: event.clientY - rect.top,
      active: false,
      orderIds,
      layout,
      sourceNode,
      cloneNode,
      rafId: null,
      cleanup,
    };

    document.addEventListener("pointermove", handleDragPointerMove);
    document.addEventListener("pointerup", handleDragPointerEnd);
    document.addEventListener("pointercancel", handleDragPointerEnd);
    sourceNode.addEventListener("pointermove", handleDragPointerMove);
    sourceNode.addEventListener("pointerup", handleDragPointerEnd);
    sourceNode.addEventListener("pointercancel", handleDragPointerEnd);
  };

  return (
    <CanvasManagerShell
      embedded={embedded}
      closing={closing}
      onPointerDownCapture={(event) => {
        if (
          menu &&
          !(event.target as HTMLElement | null)?.closest(
            "[data-context-menu], [data-canvas-menu-trigger]",
          )
        ) {
          setMenu(null);
        }
      }}
    >
      <WorkspacePanelHeader
        icon={<IconStack2 size={17} stroke={2} />}
        title="Canvases"
        meta={<Counter aria-label={`${canvases.length} canvases`}>{canvases.length}</Counter>}
        actions={
          <>
            <ToggleButton
              variant="ghost"
              size="compact"
              className="taskmap-workspace-panel-header__icon-toggle"
              pressed={minimalView}
              onClick={() => onMinimalViewChange(!minimalView)}
              title={minimalView ? "Show previews" : "Minimal view"}
              aria-label={minimalView ? "Show previews" : "Minimal view"}
            >
              <span aria-hidden="true">
                {minimalView ? (
                  <IconLayoutSidebarLeftExpand size={19} stroke={2} />
                ) : (
                  <IconLayoutSidebarLeftCollapse size={19} stroke={2} />
                )}
              </span>
            </ToggleButton>
            <IconButton
              data-new-canvas-trigger
              variant="ghost"
              size="compact"
              onClick={openCreate}
              title="Create canvas"
              aria-label="Create canvas"
              icon={<IconPlus size={19} stroke={2} />}
            />
          </>
        }
      />

      <ScrollArea ref={listRef} hiddenScrollbar className="min-h-0 flex-1 space-y-2.5 pr-0.5">
        {canvases.map((canvas) => {
          const active = canvas.id === activeCanvasId;
          const cycleHighlighted = canvas.id === cycleHighlightCanvasId;
          previewViewportSizesRef.current[canvas.id] ??= canvas.previewViewport ?? {
            width: viewportWidth,
            height: viewportHeight,
          };

          if (active) {
            previewViewportSizesRef.current[canvas.id] = {
              width: viewportWidth,
              height: viewportHeight,
            };
          }

          const previewViewport = previewViewportSizesRef.current[canvas.id];
          const dragging = draggingId === canvas.id;
          const previewWidth = 96;
          const previewHeight = 64;
          const safeZoom = Number.isFinite(canvas.zoom) && canvas.zoom > 0 ? canvas.zoom : 1;
          const visibleWidth = previewViewport.width / safeZoom;
          const visibleLeft = -canvas.pan.x / safeZoom;
          const visibleTop = -canvas.pan.y / safeZoom;
          const previewScale = previewWidth / visibleWidth;

          if (editingId === canvas.id) {
            return (
              <div
                key={canvas.id}
                data-canvas-card-id={canvas.id}
                ref={(node) => {
                  cardRefs.current[canvas.id] = node;
                }}
                className={`relative flex w-full select-none flex-col gap-3 rounded-xl border border-[#2dd8c8]/40 bg-[#1c1d22] p-3 text-left ${
                  cycleHighlighted ? "shadow-[inset_0_0_0_2px_rgba(45,216,200,0.85)]" : ""
                }`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                  <IconPencil size={14} stroke={2} />
                  <span>Edit canvas</span>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-white/50">Name</span>
                  <input
                    ref={nameInputRef}
                    className="h-9 w-full min-w-0 cursor-text rounded-md border border-white/[0.12] bg-black/[0.22] px-2.5 text-sm font-medium text-white outline-none selection:bg-white/25 focus:border-[#2dd8c8]/60"
                    value={draft.name}
                    spellCheck={false}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        saveInlineEdit();
                      }

                      if (event.key === "Escape") {
                        cancelInlineEdit();
                      }
                    }}
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-white/50">
                      <IconArrowsHorizontal size={13} stroke={2} />
                      Width
                    </span>
                    <input
                      className="h-9 w-full min-w-0 cursor-text rounded-md border border-white/[0.12] bg-black/[0.22] px-2.5 text-sm text-white outline-none [appearance:textfield] focus:border-[#2dd8c8]/60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      type="number"
                      min={600}
                      max={10000}
                      step={100}
                      value={draft.width}
                      spellCheck={false}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, width: Number(event.target.value) }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          saveInlineEdit();
                        }
                      }}
                      title="Canvas width"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-white/50">
                      <IconArrowsVertical size={13} stroke={2} />
                      Height
                    </span>
                    <input
                      className="h-9 w-full min-w-0 cursor-text rounded-md border border-white/[0.12] bg-black/[0.22] px-2.5 text-sm text-white outline-none [appearance:textfield] focus:border-[#2dd8c8]/60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      type="number"
                      min={600}
                      max={10000}
                      step={100}
                      value={draft.height}
                      spellCheck={false}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          height: Number(event.target.value),
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          saveInlineEdit();
                        }
                      }}
                      title="Canvas height"
                    />
                  </label>
                </div>

                <div className="mt-0.5 flex justify-end gap-2">
                  <button
                    className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-white/65 transition-colors hover:bg-white/[0.10] hover:text-white"
                    onClick={cancelInlineEdit}
                  >
                    <IconX size={15} stroke={2} />
                    <span>Cancel</span>
                  </button>
                  <button
                    className="flex h-8 items-center gap-1.5 rounded-md bg-white/[0.12] px-2.5 text-[13px] text-white transition-colors hover:bg-white/[0.18]"
                    onClick={saveInlineEdit}
                  >
                    <IconCheck size={15} stroke={2} />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            );
          }

          if (minimalView) {
            return (
              <div
                key={`${canvas.id}-minimal`}
                data-bar-id={canvas.id}
                data-canvas-card-id={canvas.id}
                ref={(node) => {
                  cardRefs.current[canvas.id] = node;
                }}
                className={`left-panel-card group relative flex h-10 w-full touch-none select-none items-center gap-2 overflow-clip rounded-lg border pl-3 pr-2 text-left transition-[border-color,background-color,box-shadow,opacity,transform] duration-200 ease-out [overflow-clip-margin:100vw] ${
                  active
                    ? "border-white/[0.16] bg-[#1c1d22]"
                    : "border-white/[0.08] bg-[#15161a] hover:border-white/[0.12] hover:bg-[#1d1e24]"
                } ${cycleHighlighted ? "shadow-[inset_0_0_0_2px_rgba(45,216,200,0.85)]" : ""} ${
                  dragging ? "scale-[0.985] opacity-20" : ""
                }`}
                onPointerDown={(event) => startCanvasDrag(event, canvas)}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }

                  if (!editingId) {
                    onSelectCanvas(canvas.id);
                  }
                }}
              >
                <span
                  className={`pointer-events-none absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#2dd8c8] transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-white">{canvas.name}</div>
                </div>
                <div className="relative shrink-0">
                  <button
                    data-canvas-menu-trigger
                    className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/[0.10] hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenu((current) =>
                        current?.id === canvas.id
                          ? null
                          : { id: canvas.id, left: event.clientX + 8, top: event.clientY + 8 },
                      );
                    }}
                    title="Canvas menu"
                  >
                    <IconDotsVertical size={16} stroke={2} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`${canvas.id}-full`}
              data-bar-id={canvas.id}
              data-canvas-card-id={canvas.id}
              ref={(node) => {
                cardRefs.current[canvas.id] = node;
              }}
              className={`left-panel-card group relative flex w-full touch-none select-none gap-3 overflow-clip rounded-xl border p-2 pl-3 text-left transition-[border-color,background-color,box-shadow,opacity,transform] duration-200 ease-out [overflow-clip-margin:100vw] ${
                active
                  ? "border-white/[0.16] bg-[#1c1d22]"
                  : "border-white/[0.08] bg-[#15161a] hover:border-white/[0.12] hover:bg-[#1d1e24]"
              } ${cycleHighlighted ? "shadow-[inset_0_0_0_2px_rgba(45,216,200,0.85)]" : ""} ${
                dragging ? "scale-[0.985] opacity-20" : ""
              }`}
              onPointerDown={(event) => startCanvasDrag(event, canvas)}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }

                if (!editingId) {
                  onSelectCanvas(canvas.id);
                }
              }}
            >
              <span
                className={`pointer-events-none absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-full bg-[#2dd8c8] transition-opacity duration-200 ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <div className="shrink-0">
                <div
                  className={`relative overflow-hidden rounded-md border bg-[#101116] transition-colors ${
                    active ? "border-white/[0.22]" : "border-white/[0.10]"
                  }`}
                  style={{ width: previewWidth, height: previewHeight }}
                >
                  {canvas.containers.map((container) => (
                    <div
                      key={container.id}
                      className="absolute overflow-hidden rounded-[1px] border"
                      style={{
                        left: (container.x - visibleLeft) * previewScale,
                        top: (container.y - visibleTop) * previewScale,
                        width: Math.max(container.width * previewScale, 3),
                        height: Math.max(container.height * previewScale, 3),
                        zIndex: 20 + (container.layer ?? 0),
                        borderColor: container.accent,
                        backgroundColor: "#1b1b1e",
                      }}
                    >
                      <div
                        className="absolute inset-x-0 top-0"
                        style={{
                          height: Math.max(2, 48 * previewScale),
                          backgroundColor: container.accent,
                        }}
                      />
                    </div>
                  ))}
                  {canvas.textBlocks.map((element) => (
                    <div
                      key={element.id}
                      className="absolute overflow-hidden rounded-[1px] border"
                      style={{
                        left: (element.x - visibleLeft) * previewScale,
                        top: (element.y - visibleTop) * previewScale,
                        width: Math.max(element.width * previewScale, 3),
                        height: Math.max(element.height * previewScale, 3),
                        zIndex: 20 + (element.layer ?? 0),
                        borderColor: element.accent,
                        backgroundColor: "#1b1b1e",
                      }}
                    >
                      <div
                        className="absolute inset-x-0 top-0"
                        style={{
                          height: Math.max(2, 40 * previewScale),
                          backgroundColor: element.accent,
                        }}
                      />
                    </div>
                  ))}
                  {(canvas.images ?? []).map((image) => (
                    <div
                      key={image.id}
                      className="absolute overflow-hidden rounded-[1px] border"
                      style={{
                        left: (image.x - visibleLeft) * previewScale,
                        top: (image.y - visibleTop) * previewScale,
                        width: Math.max(image.width * previewScale, 3),
                        height: Math.max(image.height * previewScale, 3),
                        zIndex: 20 + (image.layer ?? 0),
                        borderColor: image.accent,
                        backgroundColor: image.background === false ? "transparent" : "#1b1b1e",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-0.5">
                <div className="min-w-0">
                  <div className="line-clamp-2 break-words text-base font-semibold leading-snug text-white">
                    {canvas.name}
                  </div>
                  <div className="mt-1 text-[11px] tabular-nums text-white/40">
                    {canvas.width} × {canvas.height}
                  </div>
                </div>
                <button
                  data-canvas-menu-trigger
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/[0.10] hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenu((current) =>
                      current?.id === canvas.id
                        ? null
                        : { id: canvas.id, left: event.clientX + 8, top: event.clientY + 8 },
                    );
                  }}
                  title="Canvas menu"
                >
                  <IconDotsVertical size={16} stroke={2} />
                </button>
              </div>
            </div>
          );
        })}
      </ScrollArea>

      {menu &&
        createPortal(
          <div
            ref={menuRef}
            data-context-menu
            className={`${CONTEXT_MENU_PANEL_CLASS} context-menu-enter z-40`}
            style={menuPosition}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => {
                const canvas = canvases.find((current) => current.id === menu.id);
                if (canvas) {
                  openEdit(canvas);
                }
              }}
            >
              <IconPencil size={17} stroke={2} />
              <span>Edit</span>
            </button>
            <div className={MENU_DIVIDER_CLASS} />
            <button
              className={`${MENU_DANGER_ITEM_CLASS} disabled:cursor-not-allowed disabled:opacity-35`}
              onClick={() => {
                setMenu(null);
                onDeleteCanvas(menu.id);
              }}
              disabled={canvases.length <= 1}
            >
              <IconTrash size={17} stroke={2} />
              <span>Delete</span>
            </button>
          </div>,
          document.body,
        )}

      {modalMode &&
        createPortal(
          <div
            data-new-canvas-menu
            className={`frosted-glass context-menu-panel fixed left-[318px] top-16 z-40 w-[300px] rounded-xl border border-white/[0.15] bg-[#1b1b1e]/94 p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-sm ${
              createMenuClosing ? "side-panel-exit pointer-events-none" : "side-panel-enter"
            }`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">New canvas</h2>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-white/60 hover:bg-white/[0.10] hover:text-white"
                onClick={closeModal}
                title="Close"
              >
                <IconX size={17} stroke={2} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                className="h-10 w-full rounded-md border border-white/[0.12] bg-black/[0.18] px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/35"
                value={draft.name}
                autoFocus
                spellCheck={false}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitModal();
                  }
                }}
                placeholder="Canvas name"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-10 rounded-md border border-white/[0.12] bg-black/[0.18] px-3 text-sm text-white outline-none [appearance:textfield] focus:border-white/35 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  type="number"
                  min={600}
                  max={10000}
                  step={100}
                  value={draft.width}
                  spellCheck={false}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, width: Number(event.target.value) }))
                  }
                  title="Canvas width"
                />
                <input
                  className="h-10 rounded-md border border-white/[0.12] bg-black/[0.18] px-3 text-sm text-white outline-none [appearance:textfield] focus:border-white/35 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  type="number"
                  min={600}
                  max={10000}
                  step={100}
                  value={draft.height}
                  spellCheck={false}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, height: Number(event.target.value) }))
                  }
                  title="Canvas height"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
                onClick={closeModal}
              >
                <IconX size={17} stroke={2} />
                <span>Cancel</span>
              </button>
              <button
                className="flex h-9 items-center gap-2 rounded-md bg-white/[0.12] px-3 text-sm text-white transition-colors hover:bg-white/[0.18]"
                onClick={submitModal}
              >
                <IconCheck size={17} stroke={2} />
                <span>Create</span>
              </button>
            </div>
          </div>,
          document.body,
        )}
    </CanvasManagerShell>
  );
}

interface CanvasManagerShellProps extends HTMLAttributes<HTMLDivElement> {
  readonly closing: boolean;
  readonly embedded: boolean;
}

function CanvasManagerShell({ closing, embedded, ...props }: CanvasManagerShellProps) {
  return embedded ? (
    <div {...props} className="flex h-full min-h-0 flex-col" />
  ) : (
    <WorkspaceSidePanel {...props} closing={closing} label="Canvases panel" />
  );
}
