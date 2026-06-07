import {
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconCheck,
  IconDotsVertical,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MENU_DIVIDER_CLASS, MENU_ITEM_CLASS } from "../constants";
import { TaskCanvas } from "../types";
import { useClampedFixedPosition } from "../useClampedFixedPosition";

type CanvasDraft = Pick<TaskCanvas, "name" | "width" | "height">;

type CanvasManagerProps = {
  canvases: TaskCanvas[];
  activeCanvasId: string;
  closing: boolean;
  viewportWidth: number;
  viewportHeight: number;
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
  rowHeight: number;
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
  closing,
  viewportWidth,
  viewportHeight,
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

  const closeModal = () => {
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
  };

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
    if (!menu) {
      return;
    }

    const closeMenu = (event: PointerEvent) => {
      if (
        !(event.target as HTMLElement | null)?.closest("[data-context-menu], [data-canvas-menu-trigger]")
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
  }, [modalMode]);

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
  const orderedCanvases = canvases;

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

    orderedCanvases.forEach((canvas) => {
      const node = cardRefs.current[canvas.id];
      if (!node) {
        return;
      }

      const previousRect = firstRects[canvas.id];
      const nextRect = node.getBoundingClientRect();

      if (!previousRect || canvas.id === draggingId) {
        return;
      }

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }

      cardAnimationsRef.current[canvas.id]?.cancel();
      const animation = node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: 190,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        },
      );
      cardAnimationsRef.current[canvas.id] = animation;
      animation.onfinish = () => {
        delete cardAnimationsRef.current[canvas.id];
      };
      animation.oncancel = () => {
        delete cardAnimationsRef.current[canvas.id];
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
    const targetId = movingDown
      ? drag.orderIds[currentIndex + 1]
      : drag.orderIds[currentIndex - 1];
    if (!targetId) {
      return;
    }

    const target = drag.layout.find((row) => row.id === targetId);
    if (!target) {
      return;
    }

    const targetMidpoint = target.top + target.height / 2;
    const crossedTrigger = movingDown
      ? anchorY > targetMidpoint
      : anchorY < targetMidpoint;
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
      rowHeight: rect.height,
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
    <div
      className={`fixed left-4 top-16 z-30 flex max-h-[calc(100vh-5rem)] w-[290px] flex-col rounded-xl border border-white/[0.15] bg-[#1b1b1e]/94 p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-md ${
        closing ? "side-panel-exit pointer-events-none" : "side-panel-enter"
      }`}
      onPointerDownCapture={(event) => {
        if (
          menu &&
          !(event.target as HTMLElement | null)?.closest("[data-context-menu], [data-canvas-menu-trigger]")
        ) {
          setMenu(null);
        }
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-white/48">Canvas browser</div>
        <button
          data-new-canvas-trigger
          className="grid h-8 w-8 place-items-center rounded-md text-white/72 transition-colors hover:bg-white/[0.10] hover:text-white"
          onClick={openCreate}
          title="Create canvas"
        >
          <IconPlus size={19} stroke={2} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          className="canvas-browser-scroll min-h-0 h-full space-y-2 overflow-y-auto"
        >
          {orderedCanvases.map((canvas) => {
          const active = canvas.id === activeCanvasId;
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
          const visibleHeight = previewViewport.height / safeZoom;
          const visibleLeft = -canvas.pan.x / safeZoom;
          const visibleTop = -canvas.pan.y / safeZoom;
          const previewScale = previewWidth / visibleWidth;

          return (
            <div
              key={canvas.id}
              data-bar-id={canvas.id}
              data-canvas-card-id={canvas.id}
              ref={(node) => {
                cardRefs.current[canvas.id] = node;
              }}
              className={`relative flex w-full touch-none select-none gap-3 overflow-clip rounded-lg border p-1.5 text-left transition-[border-color,background-color,opacity,transform] duration-200 ease-out [overflow-clip-margin:100vw] ${
                active
                  ? "border-[#2dd8c8]/70 bg-[#15161a] shadow-[0_0_0_1px_rgba(45,216,200,0.32)]"
                  : "border-white/[0.10] bg-[#15161a] hover:bg-[#1d1e24]"
              } ${dragging ? "scale-[0.985] opacity-20" : ""}`}
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
              <div className="grid h-[64px] w-[96px] shrink-0 place-items-center">
                <div
                  className="relative overflow-hidden rounded-[4px] border border-white/[0.18] bg-[#121317]"
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
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col py-0.5">
                <div className="flex min-w-0 items-start justify-between gap-2 pt-2">
                  <div className="min-w-0">
                    {editingId === canvas.id ? (
                      <input
                        ref={nameInputRef}
                        className="h-7 w-full min-w-0 cursor-text rounded-md border border-white/[0.14] bg-black/[0.20] px-2 text-sm font-semibold text-white outline-none selection:bg-white/25 focus:border-white/35"
                        value={draft.name}
                        spellCheck={false}
                        onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            saveInlineEdit();
                          }

                          if (event.key === "Escape") {
                            cancelInlineEdit();
                          }
                        }}
                      />
                    ) : (
                      <div className="line-clamp-2 break-words text-sm font-semibold leading-4 text-white">
                        {canvas.name}
                      </div>
                    )}
                  </div>
                  <div className="relative shrink-0">
                    {editingId === canvas.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          className="grid h-7 w-7 place-items-center rounded-md text-white/62 hover:bg-white/[0.10] hover:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            saveInlineEdit();
                          }}
                          title="Save canvas"
                        >
                          <IconCheck size={16} stroke={2} />
                        </button>
                        <button
                          className="grid h-7 w-7 place-items-center rounded-md text-white/52 hover:bg-white/[0.10] hover:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            cancelInlineEdit();
                          }}
                          title="Cancel"
                        >
                          <IconX size={16} stroke={2} />
                        </button>
                      </div>
                    ) : (
                      <button
                        data-canvas-menu-trigger
                        className="grid h-7 w-7 place-items-center rounded-md text-white/52 hover:bg-white/[0.10] hover:text-white"
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
                    )}
                  </div>
                </div>
                {editingId === canvas.id ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="flex h-7 items-center gap-1.5">
                      <IconArrowsHorizontal size={15} stroke={2} className="shrink-0 text-white/42" />
                      <input
                        className="h-full min-w-0 flex-1 cursor-text rounded-md border border-white/[0.12] bg-black/[0.18] px-2 text-xs text-white outline-none [appearance:textfield] focus:border-white/35 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        type="number"
                        min={600}
                        max={10000}
                        step={100}
                        value={draft.width}
                        spellCheck={false}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, width: Number(event.target.value) }))
                        }
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            saveInlineEdit();
                          }
                        }}
                        title="Canvas width"
                      />
                    </label>
                    <label className="flex h-7 items-center gap-1.5">
                      <IconArrowsVertical size={15} stroke={2} className="shrink-0 text-white/42" />
                      <input
                        className="h-full min-w-0 flex-1 cursor-text rounded-md border border-white/[0.12] bg-black/[0.18] px-2 text-xs text-white outline-none [appearance:textfield] focus:border-white/35 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        type="number"
                        min={600}
                        max={10000}
                        step={100}
                        value={draft.height}
                        spellCheck={false}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, height: Number(event.target.value) }))
                        }
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            saveInlineEdit();
                          }
                        }}
                        title="Canvas height"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          );
          })}
        </div>
      </div>

      {menu &&
        createPortal(
        <div
          ref={menuRef}
          data-context-menu
          className="context-menu-panel context-menu-enter fixed z-40 w-36 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)]"
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
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-35"
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
          className={`context-menu-panel fixed left-[318px] top-16 z-40 w-[300px] rounded-xl border border-white/[0.15] bg-[#1b1b1e]/94 p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-md ${
            createMenuClosing ? "side-panel-exit pointer-events-none" : "side-panel-enter"
          }`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">
                New canvas
              </h2>
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
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
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
        </div>
        ,
          document.body,
        )}
    </div>
  );
}
