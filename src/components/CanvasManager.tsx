import {
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconCheck,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  CONTEXT_MENU_PANEL_CLASS,
  MENU_DANGER_ITEM_CLASS,
  MENU_DIVIDER_CLASS,
  MENU_ITEM_CLASS,
} from "../constants";
import { TaskCanvas } from "../types";
import { CanvasBrowserCard, CanvasPreview, WorkspaceSidePanel } from "../ui/patterns/workspace";
import { useMaterialSurfaceGeometryInvalidation } from "../ui/materials/MaterialSurfaceRegistration";
import { SharedSmallGlassPlane } from "../ui/materials/SharedSmallGlassPlane";
import { useReducedMotion } from "../ui/motion/reducedMotionPreference";
import { CanvasBrowserRuntime } from "../ui/patterns/workspace/CanvasBrowserRuntime";
import { CANVAS_BROWSER_LAYOUT } from "../ui/patterns/workspace/canvasBrowserLayout";
import { Button, IconButton, ToggleButton } from "../ui/primitives/Button";
import { Field } from "../ui/primitives/Field";
import { TextField } from "../ui/primitives/FormControls";
import { useClampedFixedPosition } from "../useClampedFixedPosition";
import "../ui/patterns/workspace/CanvasBrowser.css";

type CanvasDraft = Pick<TaskCanvas, "name" | "width" | "height">;

type CanvasManagerProps = {
  active?: boolean;
  canvases: TaskCanvas[];
  activeCanvasId: string;
  cycleHighlightCanvasId?: string | null;
  cardRadius?: number;
  closing: boolean;
  embedded?: boolean;
  sharedPanel?: boolean;
  minimalView: boolean;
  panelRadius?: number;
  viewportWidth: number;
  viewportHeight: number;
  onMinimalViewChange: (minimalView: boolean) => void;
  onCreateCanvas: (draft: CanvasDraft) => void;
  onSelectCanvas: (id: string) => void;
  onUpdateCanvas: (id: string, updates: CanvasDraft) => void;
  onDeleteCanvas: (id: string) => void;
  onReorderCanvases: (orderedIds: string[]) => void;
};

type PreviewViewportSize = {
  width: number;
  height: number;
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
  active = true,
  canvases,
  activeCanvasId,
  cycleHighlightCanvasId = null,
  cardRadius,
  closing,
  embedded = false,
  sharedPanel = false,
  minimalView,
  panelRadius,
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
  const cardPortalHostsRef = useRef(new Map<string, HTMLDivElement>());
  const previewViewportSizesRef = useRef<Record<string, PreviewViewportSize>>({});
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cardsLayerRef = useRef<HTMLDivElement | null>(null);
  const sharedSmallGlassPlaneRef = useRef<HTMLDivElement | null>(null);
  const browserRuntimeRef = useRef<CanvasBrowserRuntime<string> | null>(null);
  const reorderCommitRef = useRef(onReorderCanvases);
  const [modalMode, setModalMode] = useState<"create" | null>(null);
  const [createMenuClosing, setCreateMenuClosing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const [draft, setDraft] = useState<CanvasDraft>(DEFAULT_DRAFT);
  const reducedMotion = useReducedMotion();
  const invalidateSurfaceGeometry = useMaterialSurfaceGeometryInvalidation();

  useLayoutEffect(() => {
    if (active) return;
    setMenu(null);
    setModalMode(null);
    setCreateMenuClosing(false);
    setEditingId(null);
  }, [active]);
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
      browserRuntimeRef.current?.scrollCardIntoView(canvas.id);
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
      browserRuntimeRef.current?.scrollCardIntoView(cycleHighlightCanvasId);
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

  const orderedIds = useMemo(() => canvases.map((canvas) => canvas.id), [canvases]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const viewport = viewportRef.current;
    const cardsLayer = cardsLayerRef.current;
    if (!panel || !viewport || !cardsLayer) return;

    const runtime = new CanvasBrowserRuntime<string>({
      panel,
      viewport,
      cardsLayer,
      sharedSmallGlassPlane: sharedSmallGlassPlaneRef.current,
      commitOrder: (order) => reorderCommitRef.current([...order]),
      invalidateMaterialGeometry: invalidateSurfaceGeometry,
      reducedMotion,
    });
    browserRuntimeRef.current = runtime;
    return () => {
      runtime.destroy();
      if (browserRuntimeRef.current === runtime) browserRuntimeRef.current = null;
    };
  }, [invalidateSurfaceGeometry, reducedMotion]);

  useLayoutEffect(() => {
    reorderCommitRef.current = onReorderCanvases;
    const runtime = browserRuntimeRef.current;
    if (!runtime) return;
    runtime.setCommitOrder((order) => reorderCommitRef.current([...order]));
    runtime.setReducedMotion(reducedMotion);
    canvases.forEach((canvas) => {
      const host = cardPortalHostsRef.current.get(canvas.id);
      const card = cardRefs.current[canvas.id];
      if (host && card) runtime.register(canvas.id, host, card);
    });
    runtime.reconcile(orderedIds);
    for (const [id, host] of cardPortalHostsRef.current) {
      if (!orderedIds.includes(id)) {
        host.remove();
        cardPortalHostsRef.current.delete(id);
        delete cardRefs.current[id];
      }
    }
  }, [canvases, editingId, minimalView, onReorderCanvases, orderedIds, reducedMotion]);

  const getCardPortalHost = (id: string) => {
    let host = cardPortalHostsRef.current.get(id);
    if (!host) {
      host = document.createElement("div");
      host.className = "taskmap-canvas-browser-card-host";
      host.dataset.canvasCardHostId = id;
      cardPortalHostsRef.current.set(id, host);
    }
    return host;
  };

  const startCanvasDrag = (event: ReactPointerEvent<HTMLDivElement>, canvas: TaskCanvas) => {
    if (
      editingId === canvas.id ||
      event.button !== 0 ||
      (event.target as HTMLElement | null)?.closest("button,input,[data-context-menu]")
    ) {
      return;
    }

    setEditingId(null);
    setMenu(null);
    browserRuntimeRef.current?.beginDrag(canvas.id, event.nativeEvent, event.currentTarget);
  };

  return (
    <CanvasManagerShell
      panelRef={panelRef}
      embedded={embedded}
      sharedPanel={sharedPanel}
      closing={closing}
      panelRadius={panelRadius}
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
      <header className="taskmap-canvas-browser__header">
        <div className="taskmap-canvas-browser__header-copy">
          <h2>Canvas Browser</h2>
          <span>{canvases.length} Canvas Cards</span>
        </div>
        <div className="taskmap-canvas-browser__header-end">
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
          <output
            className="taskmap-canvas-browser__header-count"
            aria-label={`${canvases.length} canvases`}
          >
            {canvases.length}
          </output>
        </div>
      </header>

      <div
        ref={viewportRef}
        className="taskmap-canvas-browser__viewport"
        data-canvas-browser-viewport
      >
        {!embedded && <SharedSmallGlassPlane ref={sharedSmallGlassPlaneRef} />}
        <div ref={cardsLayerRef} className="taskmap-canvas-browser__cards-layer" />
      </div>

      {canvases.map((canvas) => {
        const cardHost = getCardPortalHost(canvas.id);
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
        const previewWidth = CANVAS_BROWSER_LAYOUT.previewWidth;
        const safeZoom = Number.isFinite(canvas.zoom) && canvas.zoom > 0 ? canvas.zoom : 1;
        const visibleWidth = previewViewport.width / safeZoom;
        const visibleLeft = -canvas.pan.x / safeZoom;
        const visibleTop = -canvas.pan.y / safeZoom;
        const previewScale = previewWidth / visibleWidth;

        if (editingId === canvas.id) {
          return createPortal(
            <CanvasBrowserCard
              embedded={embedded}
              mode="editor"
              radius={cardRadius}
              active={active}
              cycleHighlighted={cycleHighlighted}
              data-canvas-card-id={canvas.id}
              ref={(node) => {
                cardRefs.current[canvas.id] = node;
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="taskmap-canvas-inline-editor__eyebrow">
                <IconPencil size={14} stroke={2} />
                <span>Edit canvas</span>
              </div>

              <Field label="Name">
                <TextField
                  ref={nameInputRef}
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
              </Field>

              <div className="taskmap-canvas-inline-editor__dimensions">
                <Field
                  label={
                    <span className="flex items-center gap-1">
                      <IconArrowsHorizontal size={13} stroke={2} />
                      Width
                    </span>
                  }
                >
                  <TextField
                    className="taskmap-canvas-inline-editor__number"
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
                </Field>
                <Field
                  label={
                    <span className="flex items-center gap-1">
                      <IconArrowsVertical size={13} stroke={2} />
                      Height
                    </span>
                  }
                >
                  <TextField
                    className="taskmap-canvas-inline-editor__number"
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
                </Field>
              </div>

              <div className="taskmap-canvas-inline-editor__actions">
                <Button
                  variant="ghost"
                  size="compact"
                  leadingIcon={<IconX size={15} stroke={2} />}
                  onClick={cancelInlineEdit}
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="compact"
                  leadingIcon={<IconCheck size={15} stroke={2} />}
                  onClick={saveInlineEdit}
                >
                  Save
                </Button>
              </div>
            </CanvasBrowserCard>,
            cardHost,
            canvas.id,
          );
        }

        if (minimalView) {
          return createPortal(
            <CanvasBrowserCard
              embedded={embedded}
              mode="minimal"
              active={active}
              cycleHighlighted={cycleHighlighted}
              data-bar-id={canvas.id}
              data-canvas-card-id={canvas.id}
              ref={(node) => {
                cardRefs.current[canvas.id] = node;
              }}
              onPointerDown={(event) => startCanvasDrag(event, canvas)}
              onClick={() => {
                if (browserRuntimeRef.current?.consumeSuppressedClick(canvas.id)) return;

                if (!editingId) {
                  onSelectCanvas(canvas.id);
                }
              }}
            >
              <span className="taskmap-canvas-browser-card__active-indicator" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-white">{canvas.name}</div>
              </div>
              <button
                type="button"
                data-canvas-menu-trigger
                className="taskmap-canvas-browser-card__options"
                aria-label="Canvas menu"
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
                <span className="taskmap-canvas-browser-card__options-dots" aria-hidden="true" />
              </button>
            </CanvasBrowserCard>,
            cardHost,
            canvas.id,
          );
        }

        return createPortal(
          <CanvasBrowserCard
            embedded={embedded}
            mode="full"
            radius={cardRadius}
            active={active}
            cycleHighlighted={cycleHighlighted}
            data-bar-id={canvas.id}
            data-canvas-card-id={canvas.id}
            ref={(node) => {
              cardRefs.current[canvas.id] = node;
            }}
            onPointerDown={(event) => startCanvasDrag(event, canvas)}
            onClick={() => {
              if (browserRuntimeRef.current?.consumeSuppressedClick(canvas.id)) return;

              if (!editingId) {
                onSelectCanvas(canvas.id);
              }
            }}
          >
            <span className="taskmap-canvas-browser-card__active-indicator" />
            <CanvasPreview>
              {canvas.containers.map((container) => (
                <div
                  key={container.id}
                  data-canvas-preview-container={container.id}
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
                  data-canvas-preview-text-block={element.id}
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
                  data-canvas-preview-image={image.id}
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
            </CanvasPreview>

            <div className="taskmap-canvas-browser-card__copy">
              <strong className="taskmap-canvas-browser-card__title">{canvas.name}</strong>
              <span className="taskmap-canvas-browser-card__subtitle">
                {canvas.width} × {canvas.height}
              </span>
            </div>
            <button
              type="button"
              data-canvas-menu-trigger
              className="taskmap-canvas-browser-card__options"
              aria-label="Canvas menu"
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
              <span className="taskmap-canvas-browser-card__options-dots" aria-hidden="true" />
            </button>
          </CanvasBrowserCard>,
          cardHost,
          canvas.id,
        );
      })}

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
  readonly panelRadius?: number;
  readonly panelRef: RefObject<HTMLDivElement>;
  readonly sharedPanel: boolean;
}

function CanvasManagerShell({
  className,
  closing,
  embedded,
  panelRadius,
  panelRef,
  sharedPanel,
  ...props
}: CanvasManagerShellProps) {
  const shellClassName = [
    "taskmap-canvas-browser",
    embedded
      ? "taskmap-canvas-browser--embedded"
      : sharedPanel
        ? "taskmap-canvas-browser--shared-panel"
        : "taskmap-canvas-browser--floating",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return embedded || sharedPanel ? (
    <div {...props} ref={panelRef} data-canvas-browser className={shellClassName} />
  ) : (
    <WorkspaceSidePanel
      {...props}
      ref={panelRef}
      closing={closing}
      label="Canvases panel"
      radius={panelRadius}
      data-canvas-browser
      className={shellClassName}
    />
  );
}
