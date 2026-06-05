import {
  IconArrowDownRight,
  IconBox,
  IconCheck,
  IconCopy,
  IconDotsVertical,
  IconPencil,
  IconPlus,
  IconRotateClockwise,
  IconSettings,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { PointerEvent, WheelEvent, useEffect, useRef, useState } from "react";

const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 3000;
const MIN_WIDTH = 220;
const MIN_HEIGHT = 140;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.05;
const MINIMAP_MAX_SIZE = 176;
const CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT;
const MINIMAP_WIDTH =
  CANVAS_ASPECT >= 1 ? MINIMAP_MAX_SIZE : Math.max(72, Math.round(MINIMAP_MAX_SIZE * CANVAS_ASPECT));
const MINIMAP_HEIGHT =
  CANVAS_ASPECT >= 1 ? Math.max(72, Math.round(MINIMAP_MAX_SIZE / CANVAS_ASPECT)) : MINIMAP_MAX_SIZE;
const ACCENT_PRESETS = [
  { swatch: "#008b9a", accent: "#005763" },
  { swatch: "#2f80ed", accent: "#2d5f87" },
  { swatch: "#4f46e5", accent: "#314d91" },
  { swatch: "#8b5cf6", accent: "#5b3f86" },
  { swatch: "#d946ef", accent: "#7a3d61" },
  { swatch: "#ef4444", accent: "#81473d" },
  { swatch: "#f59e0b", accent: "#6f5c2b" },
  { swatch: "#22c55e", accent: "#3f6b3c" },
];
const DEFAULT_CONTAINER_ACCENT = ACCENT_PRESETS[0].accent;
const MENU_ITEM_CLASS =
  "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-white/88 transition-colors hover:bg-white/[0.10] hover:text-white";
const MENU_DIVIDER_CLASS = "my-1 h-px bg-white/[0.18]";

type ContainerElement = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: string;
};

type ContainerMenuState = {
  id: string;
  left: number;
  top: number;
};

type CopiedContainer = Pick<ContainerElement, "name" | "width" | "height" | "accent">;

type DragState =
  | {
      type: "pan";
      pointerId: number;
      startClientX: number;
      startClientY: number;
      startPanX: number;
      startPanY: number;
    }
  | {
      type: "move";
      pointerId: number;
      id: string;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
    }
  | {
      type: "resize";
      pointerId: number;
      id: string;
      startClientX: number;
      startClientY: number;
      startWidth: number;
      startHeight: number;
    };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function quantizeZoom(value: number) {
  return clamp(Math.round(value / ZOOM_STEP) * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
}

function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const minimapTimeoutRef = useRef<number | null>(null);
  const [pan, setPan] = useState({ x: -520, y: -420 });
  const [zoom, setZoom] = useState(1);
  const [minimapVisible, setMinimapVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [containerMenu, setContainerMenu] = useState<ContainerMenuState | null>(null);
  const [canvasMenu, setCanvasMenu] = useState<{ clientX: number; clientY: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [copiedContainer, setCopiedContainer] = useState<CopiedContainer | null>(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [elements, setElements] = useState<ContainerElement[]>([
    {
      id: "container-1",
      name: "Container 1",
      x: 520,
      y: 460,
      width: 380,
      height: 260,
      accent: DEFAULT_CONTAINER_ACCENT,
    },
  ]);
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    return () => {
      if (minimapTimeoutRef.current) {
        window.clearTimeout(minimapTimeoutRef.current);
      }
    };
  }, []);

  const showMinimap = () => {
    setMinimapVisible(true);

    if (minimapTimeoutRef.current) {
      window.clearTimeout(minimapTimeoutRef.current);
    }

    minimapTimeoutRef.current = window.setTimeout(() => {
      setMinimapVisible(false);
    }, 2200);
  };

  const canvasPointFromEvent = (event: { clientX: number; clientY: number }) => {
    const worldRect = worldRef.current?.getBoundingClientRect();
    if (!worldRect) {
      return { x: 0, y: 0 };
    }

    return {
      x: clamp((event.clientX - worldRect.left) / zoom, 0, CANVAS_WIDTH),
      y: clamp((event.clientY - worldRect.top) / zoom, 0, CANVAS_HEIGHT),
    };
  };

  const createContainer = (clientX: number, clientY: number) => {
    const point = canvasPointFromEvent({ clientX, clientY });
    const width = 360;
    const height = 240;
    const nextNumber = elements.length + 1;
    const id = `container-${Date.now()}`;
    const nextElement: ContainerElement = {
      id,
      name: `Container ${nextNumber}`,
      x: clamp(point.x - width / 2, 0, CANVAS_WIDTH - width),
      y: clamp(point.y - 28, 0, CANVAS_HEIGHT - height),
      width,
      height,
      accent: DEFAULT_CONTAINER_ACCENT,
    };

    setElements((current) => [...current, nextElement]);
    setSelectedId(id);
    setContainerMenu(null);
    setRenamingId(null);
    setCanvasMenu(null);
  };

  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (event.target !== worldRef.current) {
      return;
    }

    setSelectedId(null);
    setContainerMenu(null);
    setRenamingId(null);
    setCanvasMenu({ clientX: event.clientX, clientY: event.clientY });
  };

  const suppressContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(null);
    setContainerMenu(null);
    setRenamingId(null);
    setCanvasMenu(null);
    showMinimap();
    setDragState({
      type: "pan",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;

    if (dragState.type === "pan") {
      showMinimap();
      setPan({
        x: dragState.startPanX + deltaX,
        y: dragState.startPanY + deltaY,
      });
      return;
    }

    setElements((current) =>
      current.map((element) => {
        if (element.id !== dragState.id) {
          return element;
        }

        if (dragState.type === "move") {
          return {
            ...element,
            x: clamp(dragState.startX + deltaX, 0, CANVAS_WIDTH - element.width),
            y: clamp(dragState.startY + deltaY, 0, CANVAS_HEIGHT - element.height),
          };
        }

        return {
          ...element,
          width: clamp(dragState.startWidth + deltaX, MIN_WIDTH, CANVAS_WIDTH - element.x),
          height: clamp(dragState.startHeight + deltaY, MIN_HEIGHT, CANVAS_HEIGHT - element.y),
        };
      }),
    );
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    setDragState(null);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setCanvasMenu(null);
    setContainerMenu(null);
    setRenamingId(null);
    showMinimap();

    const direction = event.deltaY < 0 ? 1 : -1;
    const nextZoom = quantizeZoom(zoom + direction * ZOOM_STEP);
    const canvasX = (event.clientX - pan.x) / zoom;
    const canvasY = (event.clientY - pan.y) / zoom;

    setZoom(nextZoom);
    setPan({
      x: event.clientX - canvasX * nextZoom,
      y: event.clientY - canvasY * nextZoom,
    });
  };

  const startMove = (event: PointerEvent<HTMLDivElement>, element: ContainerElement) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    setSelectedId(element.id);
    setContainerMenu(null);
    setRenamingId(null);
    setCanvasMenu(null);
    setDragState({
      type: "move",
      pointerId: event.pointerId,
      id: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: element.x,
      startY: element.y,
    });
  };

  const startResize = (event: PointerEvent<HTMLButtonElement>, element: ContainerElement) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    setSelectedId(element.id);
    setContainerMenu(null);
    setRenamingId(null);
    setCanvasMenu(null);
    setDragState({
      type: "resize",
      pointerId: event.pointerId,
      id: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: element.width,
      startHeight: element.height,
    });
  };

  const toggleMenu = (event: React.MouseEvent<HTMLButtonElement>, element: ContainerElement) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setSelectedId(element.id);
    setRenamingId(null);
    setCanvasMenu(null);
    setRenameDraft(element.name);
    setContainerMenu((current) =>
      current?.id === element.id
        ? null
        : {
            id: element.id,
            left: rect.right + 8,
            top: rect.top,
          },
    );
  };

  const startRename = (element: ContainerElement) => {
    setRenameDraft(element.name);
    setRenamingId(element.id);
    setContainerMenu(null);
  };

  const saveRename = (id: string) => {
    const nextName = renameDraft.trim();
    if (!nextName) {
      return;
    }

    setElements((current) =>
      current.map((element) => (element.id === id ? { ...element, name: nextName } : element)),
    );
    setRenamingId(null);
    setContainerMenu(null);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const deleteContainer = (id: string) => {
    setElements((current) => current.filter((element) => element.id !== id));
    setSelectedId((current) => (current === id ? null : current));
    setContainerMenu(null);
    setRenamingId(null);
    setCanvasMenu(null);
  };

  const copyContainer = (element: ContainerElement) => {
    setCopiedContainer({
      name: element.name,
      width: element.width,
      height: element.height,
      accent: element.accent,
    });
    setContainerMenu(null);
  };

  const pasteContainer = (clientX: number, clientY: number) => {
    if (!copiedContainer) {
      return;
    }

    const point = canvasPointFromEvent({ clientX, clientY });
    const id = `container-${Date.now()}`;
    const duplicate = {
      ...copiedContainer,
      id,
      name: `${copiedContainer.name} copy`,
      x: clamp(point.x - copiedContainer.width / 2, 0, CANVAS_WIDTH - copiedContainer.width),
      y: clamp(point.y - 28, 0, CANVAS_HEIGHT - copiedContainer.height),
    };

    setElements((current) => [...current, duplicate]);
    setSelectedId(id);
    setCanvasMenu(null);
    setRenamingId(null);
  };

  const requestClearCanvas = () => {
    setCanvasMenu(null);
    setClearModalOpen(true);
  };

  const clearCanvas = () => {
    setElements([]);
    setSelectedId(null);
    setContainerMenu(null);
    setCanvasMenu(null);
    setRenamingId(null);
    setClearModalOpen(false);
  };

  const updateContainerAccent = (id: string, accent: string) => {
    setElements((current) =>
      current.map((element) =>
        element.id === id
          ? {
              ...element,
              accent,
            }
          : element,
      ),
    );
  };

  const resetZoom = () => {
    const stageWidth = stageRef.current?.clientWidth ?? window.innerWidth;
    const stageHeight = stageRef.current?.clientHeight ?? window.innerHeight;
    const centerX = (stageWidth / 2 - pan.x) / zoom;
    const centerY = (stageHeight / 2 - pan.y) / zoom;

    setZoom(1);
    setPan({
      x: stageWidth / 2 - centerX,
      y: stageHeight / 2 - centerY,
    });
    showMinimap();
  };

  const stageWidth = stageRef.current?.clientWidth ?? window.innerWidth;
  const stageHeight = stageRef.current?.clientHeight ?? window.innerHeight;
  const visibleWorldLeft = -pan.x / zoom;
  const visibleWorldTop = -pan.y / zoom;
  const minimapViewportWidth = clamp((stageWidth / zoom / CANVAS_WIDTH) * MINIMAP_WIDTH, 8, MINIMAP_WIDTH);
  const minimapViewportHeight = clamp((stageHeight / zoom / CANVAS_HEIGHT) * MINIMAP_HEIGHT, 8, MINIMAP_HEIGHT);
  const minimapViewport = {
    x: (visibleWorldLeft / CANVAS_WIDTH) * MINIMAP_WIDTH,
    y: (visibleWorldTop / CANVAS_HEIGHT) * MINIMAP_HEIGHT,
    width: minimapViewportWidth,
    height: minimapViewportHeight,
  };

  return (
    <main data-theme="taskmap" className="h-full w-full bg-[color:var(--void-bg)] text-white" onContextMenu={suppressContextMenu}>
      <div className="h-full">
        <section className="relative h-full overflow-hidden">
          <div className="fixed left-4 top-4 z-20 flex h-10 items-center rounded-xl border border-white/[0.15] bg-[#1b1b1e]/88 px-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.38)] backdrop-blur-md">
            <button
              className="grid h-7 w-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <IconSettings size={18} stroke={2} />
            </button>
          </div>
          <div
            ref={stageRef}
            data-stage
            className={`absolute inset-0 overflow-hidden ${
              dragState?.type === "pan" || dragState?.type === "move" ? "cursor-grabbing" : "cursor-default"
            }`}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
            onWheel={handleWheel}
            onAuxClick={(event) => event.preventDefault()}
          >
            <div
              ref={worldRef}
              className="canvas-grid absolute rounded-[24px] border border-white/[0.15] shadow-premium"
              style={{
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
              onContextMenu={handleCanvasContextMenu}
            >
              {elements.map((element) => {
                const selected = element.id === selectedId;

                return (
                  <article
                    key={element.id}
                    className="absolute overflow-hidden rounded-xl border-2 border-[color:var(--container-chrome)] shadow-xl transition-shadow"
                    style={{
                      left: element.x,
                      top: element.y,
                      width: element.width,
                      height: element.height,
                      backgroundColor: element.accent,
                      borderColor: element.accent,
                      boxShadow: selected
                        ? `0 0 0 1px color-mix(in srgb, ${element.accent} 34%, transparent), 0 18px 42px rgba(0, 0, 0, 0.42)`
                        : "0 18px 42px rgba(0, 0, 0, 0.42)",
                    }}
                    onPointerDown={(event) => {
                      if (event.button !== 1) {
                        event.stopPropagation();
                      }

                      if (event.button === 0) {
                        setSelectedId(element.id);
                      }
                    }}
                  >
                    <div
                      className={`flex h-12 items-center justify-between px-4 text-white ${
                        dragState?.type === "move" && dragState.id === element.id
                          ? "cursor-grabbing"
                          : "cursor-grab"
                      }`}
                      style={{ backgroundColor: element.accent }}
                      onPointerDown={(event) => startMove(event, element)}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <IconBox size={19} stroke={2} className="shrink-0 text-white/80" />
                        {renamingId === element.id ? (
                          <input
                            className="h-8 min-w-0 flex-1 appearance-none rounded-md border border-white/20 bg-black/[0.18] px-2 text-[16px] font-semibold text-white outline-none selection:bg-white/20 focus:border-white/45"
                            value={renameDraft}
                            autoFocus
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onFocus={(event) => event.target.select()}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onBlur={() => saveRename(element.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                saveRename(element.id);
                              }

                              if (event.key === "Escape") {
                                cancelRename();
                              }
                            }}
                          />
                        ) : (
                          <span className="truncate text-[16px] font-semibold">{element.name}</span>
                        )}
                      </div>
                      <button
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
                        onClick={(event) => toggleMenu(event, element)}
                        onPointerDown={(event) => event.stopPropagation()}
                        title="Container menu"
                      >
                        <IconDotsVertical size={18} stroke={2} />
                      </button>
                    </div>

                    <div className="h-[calc(100%-48px)] bg-[color:var(--container-bg)]" />

                    <button
                      className="absolute bottom-1.5 right-1.5 grid h-7 w-7 cursor-nwse-resize place-items-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white/80 active:bg-white/15 active:text-white"
                      onPointerDown={(event) => startResize(event, element)}
                      title="Resize container"
                    >
                      <IconArrowDownRight size={18} stroke={2} />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
          {containerMenu &&
            elements
              .filter((element) => element.id === containerMenu.id)
              .map((element) => (
                <div
                  key={element.id}
                  className="fixed z-30 w-56 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)]"
                  style={{ left: containerMenu.left, top: containerMenu.top }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button className={MENU_ITEM_CLASS} onClick={() => startRename(element)}>
                    <IconPencil size={17} stroke={2} />
                    <span>Edit Container</span>
                  </button>
                  <div className={MENU_DIVIDER_CLASS} />
                  <div className="px-2 pb-2 pt-1.5">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/48">
                      Color
                    </div>
                    <div className="grid grid-cols-8 gap-1.5">
                      {ACCENT_PRESETS.map((preset) => (
                        <button
                          key={preset.accent}
                          className="relative h-5 rounded-md transition hover:ring-2 hover:ring-white/12"
                          style={{ backgroundColor: preset.swatch }}
                          onClick={() => updateContainerAccent(element.id, preset.accent)}
                          title="Container accent color"
                        >
                          {element.accent === preset.accent && (
                            <span className="absolute inset-x-1.5 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={MENU_DIVIDER_CLASS} />
                  <button className={MENU_ITEM_CLASS} onClick={() => copyContainer(element)}>
                    <IconCopy size={17} stroke={2} />
                    <span>Copy</span>
                  </button>
                  <div className={MENU_DIVIDER_CLASS} />
                  <button
                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300"
                    onClick={() => deleteContainer(element.id)}
                  >
                    <IconTrash size={17} stroke={2} />
                    <span>Remove</span>
                  </button>
                </div>
              ))}
          {canvasMenu && (
            <div
              className="fixed z-30 w-52 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)]"
              style={{ left: canvasMenu.clientX + 8, top: canvasMenu.clientY + 8 }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              {copiedContainer && (
                <>
                  <button
                    className={MENU_ITEM_CLASS}
                    onClick={() => pasteContainer(canvasMenu.clientX, canvasMenu.clientY)}
                  >
                    <IconCopy size={17} stroke={2} />
                    <span>Paste</span>
                  </button>
                  <div className={MENU_DIVIDER_CLASS} />
                </>
              )}
              <button
                className={MENU_ITEM_CLASS}
                onClick={() => createContainer(canvasMenu.clientX, canvasMenu.clientY)}
              >
                <IconPlus size={17} stroke={2} />
                <span>Create container</span>
              </button>
              <div className={MENU_DIVIDER_CLASS} />
              <button
                className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300"
                onClick={requestClearCanvas}
              >
                <IconTrash size={17} stroke={2} />
                <span>Clear canvas</span>
              </button>
            </div>
          )}
          {clearModalOpen && (
            <div className="fixed inset-0 z-40 grid place-items-center bg-black/45">
              <div className="w-[360px] rounded-xl border border-white/[0.15] bg-[#202023] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
                <div className="mb-3 flex items-center gap-2">
                  <IconTrash size={20} stroke={2} className="text-red-300" />
                  <h2 className="text-[16px] font-semibold">Clear canvas?</h2>
                </div>
                <p className="mb-5 text-sm leading-5 text-white/65">
                  This will remove all containers from the canvas.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-white/75 hover:bg-white/[0.10] hover:text-white"
                    onClick={() => setClearModalOpen(false)}
                  >
                    <IconX size={17} stroke={2} />
                    <span>Cancel</span>
                  </button>
                  <button
                    className="flex h-9 items-center gap-2 rounded-md bg-red-500/18 px-3 text-sm text-red-200 hover:bg-red-500/25"
                    onClick={clearCanvas}
                  >
                    <IconRotateClockwise size={17} stroke={2} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          {settingsOpen && (
            <div className="fixed inset-0 z-40 grid place-items-center bg-black/35">
              <div className="w-[420px] rounded-xl border border-white/[0.15] bg-[#1b1b1e]/94 p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-md">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconSettings size={20} stroke={2} className="text-white/75" />
                    <h2 className="text-[16px] font-semibold">Settings</h2>
                  </div>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-md text-white/60 hover:bg-white/[0.10] hover:text-white"
                    onClick={() => setSettingsOpen(false)}
                    title="Close settings"
                  >
                    <IconX size={17} stroke={2} />
                  </button>
                </div>
                <div className="rounded-lg border border-white/[0.10] bg-white/[0.03] p-4 text-sm text-white/60">
                  Settings will appear here.
                </div>
              </div>
            </div>
          )}
          <div
            className={`fixed bottom-4 left-4 z-20 rounded-md border border-white/10 bg-[#15171c]/58 p-2 shadow-[0_12px_34px_rgba(0,0,0,0.32)] backdrop-blur-md transition-opacity duration-500 ${
              minimapVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="mb-1 flex items-center gap-2 pl-1 text-[11px] font-medium text-white/70">
              <span>{Math.round(zoom * 100)}%</span>
              <button
                className="pointer-events-auto rounded px-1 text-white/35 hover:bg-white/[0.10] hover:text-white/75"
                onClick={resetZoom}
                title="Reset zoom"
              >
                ↩
              </button>
              <span className="text-white/32">↩</span>
            </div>
            <div
              className="pointer-events-none relative overflow-hidden rounded-md"
              style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
            >
              {elements.map((element) => (
                <div
                  key={element.id}
                  className="absolute rounded-[2px] border"
                  style={{
                    left: (element.x / CANVAS_WIDTH) * MINIMAP_WIDTH,
                    top: (element.y / CANVAS_HEIGHT) * MINIMAP_HEIGHT,
                    width: Math.max((element.width / CANVAS_WIDTH) * MINIMAP_WIDTH, 4),
                    height: Math.max((element.height / CANVAS_HEIGHT) * MINIMAP_HEIGHT, 4),
                    borderColor: element.accent,
                    backgroundColor: `${element.accent}26`,
                  }}
                />
              ))}
              <div
                className="absolute rounded-[2px] border border-[#c8dae8]/85 bg-[#7aa2c8]/10"
                style={{
                  left: minimapViewport.x,
                  top: minimapViewport.y,
                  width: minimapViewport.width,
                  height: minimapViewport.height,
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
