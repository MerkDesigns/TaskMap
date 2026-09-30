import {
  IconCheck,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconDotsVertical,
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
  useRef,
  useState,
  type CSSProperties,
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
import type { CanvasInteractionController } from "../app/interactions/canvasInteractionTypes";
import {
  canvasPreviewProjection,
  presentCanvasPreview,
  previewHeaderHeight,
  previewItemStyle,
  PREVIEW_HEADER_ATTRIBUTE,
  PREVIEW_WORLD_ATTRIBUTE,
} from "./canvasPreviewProjection";
import { ModalPresence } from "../ui/patterns/overlays";
import { CanvasCreateDialog } from "./CanvasCreateDialog";
import { CanvasDraftFields, type CanvasDraft } from "./CanvasDraftFields";
import { CanvasBrowserCard, CanvasPreview, WorkspaceSidePanel } from "../ui/patterns/workspace";
import { SharedSmallGlassPlane } from "../ui/materials/SharedSmallGlassPlane";
import { GlassListFrame } from "../ui/patterns/workspace/GlassListFrame";
import { useReducedMotion } from "../ui/motion/reducedMotionPreference";
import { CanvasBrowserRuntime } from "../ui/patterns/workspace/CanvasBrowserRuntime";
import { CANVAS_BROWSER_LAYOUT } from "../ui/patterns/workspace/canvasBrowserLayout";
import { Button, IconButton, ToggleButton } from "../ui/primitives/Button";
import { useClampedFixedPosition } from "../useClampedFixedPosition";
import "../ui/patterns/workspace/CanvasBrowser.css";
import { useSettledPanelWork } from "../ui/patterns/workspace/useSettledPanelWork";

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
  previewGap?: number;
  smallGlassBlur?: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Live camera source; the active card's preview follows pan/zoom frames without rerendering. */
  controller?: CanvasInteractionController;
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
  previewGap = CANVAS_BROWSER_LAYOUT.previewInset,
  smallGlassBlur,
  viewportWidth,
  viewportHeight,
  controller,
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
  const dragSmallGlassPlaneRef = useRef<HTMLDivElement | null>(null);
  const browserRuntimeRef = useRef<CanvasBrowserRuntime<string> | null>(null);
  const canvasesRef = useRef(canvases);
  canvasesRef.current = canvases;
  const reorderCommitRef = useRef(onReorderCanvases);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSession, setCreateSession] = useState(0);
  const [createDraft, setCreateDraft] = useState<CanvasDraft>(DEFAULT_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const [draft, setDraft] = useState<CanvasDraft>(DEFAULT_DRAFT);
  const reducedMotion = useReducedMotion();
  const workActive = useSettledPanelWork(active);

  useLayoutEffect(() => {
    if (active) return;
    setMenu(null);
    setCreateOpen(false);
    setEditingId(null);
  }, [active]);
  const menuPosition = useClampedFixedPosition(menuRef, {
    left: menu?.left ?? 0,
    top: menu?.top ?? 0,
  });

  const openCreate = () => {
    setEditingId(null);
    setCreateDraft({ name: `Canvas ${canvases.length + 1}`, width: 3000, height: 3000 });
    setCreateSession((session) => session + 1);
    setCreateOpen(true);
  };
  const closeCreate = useCallback(() => setCreateOpen(false), []);

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

  const submitCreate = (nextDraft: CanvasDraft) => {
    onCreateCanvas({
      name: nextDraft.name.trim() || "Untitled canvas",
      width: clampDraftSize(nextDraft.width),
      height: clampDraftSize(nextDraft.height),
    });
    setCreateOpen(false);
  };

  const orderedIds = useStableCanvasOrder(canvases);
  const previewWidth =
    (CANVAS_BROWSER_LAYOUT.cardHeight - previewGap * 2) * CANVAS_BROWSER_LAYOUT.previewAspectRatio;

  useLayoutEffect(() => {
    if (!controller || !workActive || minimalView) return;
    let previous = controller.getSnapshot().viewport;
    return controller.subscribe(() => {
      const viewport = controller.getSnapshot().viewport;
      if (viewport === previous) return;
      previous = viewport;
      const preview =
        cardRefs.current[activeCanvasId]?.querySelector<HTMLElement>(".taskmap-canvas-preview");
      const size = previewViewportSizesRef.current[activeCanvasId];
      if (!preview || !size) return;
      presentCanvasPreview(preview, canvasPreviewProjection(viewport, previewWidth, size.width));
    });
  }, [activeCanvasId, controller, minimalView, previewWidth, workActive]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const viewport = viewportRef.current;
    const cardsLayer = cardsLayerRef.current;
    if (!workActive || !panel || !viewport || !cardsLayer) return;

    const runtime = new CanvasBrowserRuntime<string>({
      panel,
      viewport,
      cardsLayer,
      sharedSmallGlassPlane: sharedSmallGlassPlaneRef.current,
      dragSmallGlassPlane: dragSmallGlassPlaneRef.current,
      commitOrder: (order) => reorderCommitRef.current([...order]),
      reducedMotion,
    });
    browserRuntimeRef.current = runtime;
    return () => {
      runtime.destroy();
      if (browserRuntimeRef.current === runtime) browserRuntimeRef.current = null;
    };
  }, [reducedMotion, workActive]);

  useLayoutEffect(() => {
    reorderCommitRef.current = onReorderCanvases;
  }, [onReorderCanvases]);

  useLayoutEffect(() => {
    const runtime = browserRuntimeRef.current;
    if (!runtime || !workActive) return;
    runtime.setCommitOrder((order) => reorderCommitRef.current([...order]));
    runtime.setReducedMotion(reducedMotion);
    canvasesRef.current.forEach((canvas) => {
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
  }, [editingId, minimalView, orderedIds, reducedMotion, workActive]);

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
      style={{ "--taskmap-canvas-preview-gap": `${previewGap}px` } as CSSProperties}
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

      <GlassListFrame
        ref={viewportRef}
        className="taskmap-canvas-browser__viewport"
        data-canvas-browser-viewport
        planeRef={sharedSmallGlassPlaneRef}
        materialEnabled={!embedded}
        batchId="canvas-browser-small"
        blurPx={smallGlassBlur}
      >
        {!embedded && (
          <SharedSmallGlassPlane
            ref={dragSmallGlassPlaneRef}
            batchId="canvas-browser-small-drag"
            blurPx={smallGlassBlur}
            kind="small-drag"
            className="taskmap-shared-small-glass-plane--canvas-drag"
          />
        )}
        <div ref={cardsLayerRef} className="taskmap-canvas-browser__cards-layer" />
      </GlassListFrame>

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
        // The active canvas follows the live camera; stored cameras lag until a document commit.
        const projection = canvasPreviewProjection(
          active && controller ? controller.getSnapshot().viewport : canvas,
          previewWidth,
          previewViewport.width,
        );

        if (editingId === canvas.id) {
          return createPortal(
            <CanvasBrowserCard
              embedded={embedded}
              geometryActive={workActive}
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

              <CanvasDraftFields
                draft={draft}
                nameRef={nameInputRef}
                onChange={setDraft}
                onSubmit={saveInlineEdit}
                onCancel={cancelInlineEdit}
              />

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
              geometryActive={workActive}
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
              <IconButton
                variant="ghost"
                size="compact"
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
                icon={<IconDotsVertical size={16} stroke={2} />}
              />
            </CanvasBrowserCard>,
            cardHost,
            canvas.id,
          );
        }

        return createPortal(
          <CanvasBrowserCard
            embedded={embedded}
            geometryActive={workActive}
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
              {workActive &&
                canvas.containers.map((container) => (
                  <div
                    key={container.id}
                    data-canvas-preview-container={container.id}
                    className="absolute overflow-hidden rounded-[1px] border"
                    {...{
                      [PREVIEW_WORLD_ATTRIBUTE]: `${container.x} ${container.y} ${container.width} ${container.height}`,
                    }}
                    style={{
                      ...previewItemStyle(
                        projection,
                        container.x,
                        container.y,
                        container.width,
                        container.height,
                      ),
                      zIndex: 20 + (container.layer ?? 0),
                      borderColor: container.accent,
                      backgroundColor: "#1b1b1e",
                    }}
                  >
                    <div
                      className="absolute inset-x-0 top-0"
                      {...{ [PREVIEW_HEADER_ATTRIBUTE]: 48 }}
                      style={{
                        height: previewHeaderHeight(projection, 48),
                        backgroundColor: container.accent,
                      }}
                    />
                  </div>
                ))}
              {workActive &&
                canvas.textBlocks.map((element) => (
                  <div
                    key={element.id}
                    data-canvas-preview-text-block={element.id}
                    className="absolute overflow-hidden rounded-[1px] border"
                    {...{
                      [PREVIEW_WORLD_ATTRIBUTE]: `${element.x} ${element.y} ${element.width} ${element.height}`,
                    }}
                    style={{
                      ...previewItemStyle(
                        projection,
                        element.x,
                        element.y,
                        element.width,
                        element.height,
                      ),
                      zIndex: 20 + (element.layer ?? 0),
                      borderColor: element.accent,
                      backgroundColor: "#1b1b1e",
                    }}
                  >
                    <div
                      className="absolute inset-x-0 top-0"
                      {...{ [PREVIEW_HEADER_ATTRIBUTE]: 40 }}
                      style={{
                        height: previewHeaderHeight(projection, 40),
                        backgroundColor: element.accent,
                      }}
                    />
                  </div>
                ))}
              {workActive &&
                (canvas.images ?? []).map((image) => (
                  <div
                    key={image.id}
                    data-canvas-preview-image={image.id}
                    className="absolute overflow-hidden rounded-[1px] border"
                    {...{
                      [PREVIEW_WORLD_ATTRIBUTE]: `${image.x} ${image.y} ${image.width} ${image.height}`,
                    }}
                    style={{
                      ...previewItemStyle(projection, image.x, image.y, image.width, image.height),
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
            <IconButton
              variant="ghost"
              size="compact"
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
              icon={<IconDotsVertical size={16} stroke={2} />}
            />
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

      {createPortal(
        <div className="taskmap-target-theme">
          <ModalPresence open={createOpen}>
            <CanvasCreateDialog
              key={createSession}
              initialDraft={createDraft}
              onCancel={closeCreate}
              onCreate={submitCreate}
            />
          </ModalPresence>
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
  readonly panelRef: RefObject<HTMLDivElement | null>;
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

function useStableCanvasOrder(canvases: readonly TaskCanvas[]): readonly string[] {
  const orderRef = useRef<readonly string[]>([]);
  const next = canvases.map((canvas) => canvas.id);
  if (
    next.length !== orderRef.current.length ||
    next.some((id, index) => id !== orderRef.current[index])
  ) {
    orderRef.current = next;
  }
  return orderRef.current;
}
