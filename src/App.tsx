import { PointerEvent, WheelEvent, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IconRotateClockwise } from "@tabler/icons-react";
import { CanvasManager } from "./components/CanvasManager";
import { CanvasContextMenu, ContainerContextMenu } from "./components/ContextMenus";
import { ContainerNode } from "./components/ContainerNode";
import { FloatingToolbar } from "./components/FloatingToolbar";
import { Minimap } from "./components/Minimap";
import { ClearCanvasModal, SettingsModal } from "./components/Modals";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ALIGN_SNAP_DISTANCE,
  DEFAULT_CONTAINER_ACCENT,
  MIN_HEIGHT,
  MIN_WIDTH,
  MINIMAP_MAX_SIZE,
  ZOOM_STEP,
} from "./constants";
import { clamp, quantizeZoom } from "./canvasMath";
import {
  AppData,
  CanvasGridStyle,
  ContainerElement,
  ContainerMenuState,
  CopiedContainer,
  DragState,
  TaskCanvas,
} from "./types";

type SnapGuide = {
  axis: "x" | "y";
  position: number;
  pointerPosition: number;
};

type LegacyAppData = Partial<AppData> & {
  containers?: ContainerElement[];
  pan?: { x: number; y: number };
  zoom?: number;
};

const DEFAULT_PAN = { x: -520, y: -420 };
const DEFAULT_GRID_OPACITY: Record<CanvasGridStyle, number> = {
  dots: 50,
  lines: 15,
};
const DEFAULT_ELEMENTS: ContainerElement[] = [
  {
    id: "container-1",
    name: "Container 1",
    x: 520,
    y: 460,
    width: 380,
    height: 260,
    accent: DEFAULT_CONTAINER_ACCENT,
  },
];
const DEFAULT_CANVAS: TaskCanvas = {
  id: "canvas-1",
  name: "Canvas 1",
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  containers: DEFAULT_ELEMENTS,
  pan: DEFAULT_PAN,
  zoom: 1,
};
const CANVAS_MANAGER_ANIMATION_MS = 160;

function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const minimapTimeoutRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const latestAppDataRef = useRef<AppData>({
    activeCanvasId: DEFAULT_CANVAS.id,
    canvases: [DEFAULT_CANVAS],
    canvasGridStyle: "dots",
    canvasGridOpacity: DEFAULT_GRID_OPACITY,
  });
  const appDataLoadedRef = useRef(false);
  const [appDataLoaded, setAppDataLoaded] = useState(false);
  const [pan, setPan] = useState(DEFAULT_PAN);
  const [zoom, setZoom] = useState(1);
  const [minimapVisible, setMinimapVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [containerMenu, setContainerMenu] = useState<ContainerMenuState | null>(null);
  const [closingContainerMenu, setClosingContainerMenu] = useState<ContainerMenuState | null>(null);
  const [canvasMenu, setCanvasMenu] = useState<{ clientX: number; clientY: number } | null>(null);
  const [closingCanvasMenu, setClosingCanvasMenu] = useState<{ clientX: number; clientY: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [copiedContainer, setCopiedContainer] = useState<CopiedContainer | null>(null);
  const [canvasGridStyle, setCanvasGridStyle] = useState<CanvasGridStyle>("dots");
  const [canvasGridOpacity, setCanvasGridOpacity] =
    useState<Record<CanvasGridStyle, number>>(DEFAULT_GRID_OPACITY);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canvasManagerOpen, setCanvasManagerOpen] = useState(false);
  const [canvasManagerClosing, setCanvasManagerClosing] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [enteringIds, setEnteringIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [activeCanvas, setActiveCanvas] = useState<TaskCanvas>(DEFAULT_CANVAS);
  const [canvases, setCanvases] = useState<TaskCanvas[]>([DEFAULT_CANVAS]);
  const [elements, setElements] = useState<ContainerElement[]>(DEFAULT_ELEMENTS);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const persistAppData = async (data: AppData) => {
    await invoke("save_app_data", { data });
  };

  const normalizeAppData = (data: AppData | LegacyAppData): AppData => {
    if (Array.isArray(data.canvases) && data.activeCanvasId) {
      return data as AppData;
    }

    const legacy = data as LegacyAppData;

    return {
      activeCanvasId: DEFAULT_CANVAS.id,
      canvases: [
        {
          ...DEFAULT_CANVAS,
          containers: legacy.containers ?? DEFAULT_ELEMENTS,
          pan: legacy.pan ?? DEFAULT_PAN,
          zoom: legacy.zoom ?? 1,
        },
      ],
      canvasGridStyle: data.canvasGridStyle ?? "dots",
      canvasGridOpacity: data.canvasGridOpacity ?? DEFAULT_GRID_OPACITY,
    };
  };

  const clampCanvasSize = (value: number) => clamp(Number.isFinite(value) ? value : CANVAS_WIDTH, 600, 10000);

  const getActiveCanvasSnapshot = (): TaskCanvas => ({
    ...activeCanvas,
    containers: elements,
    pan,
    zoom,
  });

  const getPersistedCanvases = () => {
    const snapshot = getActiveCanvasSnapshot();
    return canvases.map((canvas) => (canvas.id === snapshot.id ? snapshot : canvas));
  };

  const getCurrentAppData = (): AppData => ({
    activeCanvasId: activeCanvas.id,
    canvases: getPersistedCanvases(),
    canvasGridStyle,
    canvasGridOpacity,
  });

  useEffect(() => {
    let active = true;

    invoke<AppData | null>("load_app_data")
      .then((data) => {
        if (!active) {
          return;
        }

        if (data) {
          const normalized = normalizeAppData(data);
          const selectedCanvas =
            normalized.canvases.find((canvas) => canvas.id === normalized.activeCanvasId) ??
            normalized.canvases[0] ??
            DEFAULT_CANVAS;

          latestAppDataRef.current = normalized;
          setCanvases(normalized.canvases.length ? normalized.canvases : [DEFAULT_CANVAS]);
          setActiveCanvas(selectedCanvas);
          setElements(selectedCanvas.containers);
          setPan(selectedCanvas.pan);
          setZoom(selectedCanvas.zoom);
          setCanvasGridStyle(normalized.canvasGridStyle);
          setCanvasGridOpacity(normalized.canvasGridOpacity);
        }

        setStorageError(null);
        setAppDataLoaded(true);
        appDataLoadedRef.current = true;
      })
      .catch((error) => {
        const message = `Failed to load app data: ${String(error)}`;
        setStorageError(message);
        console.error(message);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    latestAppDataRef.current = getCurrentAppData();
  }, [activeCanvas, canvasGridOpacity, canvasGridStyle, canvases, elements, pan, zoom]);

  useEffect(() => {
    if (!appDataLoaded) {
      return;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      persistAppData(latestAppDataRef.current)
        .then(() => {
          setStorageError(null);
        })
        .catch((error) => {
          const message = `Failed to save app data: ${String(error)}`;
          setStorageError(message);
          console.error(message);
        });
    }, 350);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    appDataLoaded,
    activeCanvas,
    canvasGridOpacity,
    canvasGridStyle,
    canvases,
    elements,
    pan,
    zoom,
  ]);

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    let closing = false;
    let unlisten: (() => void) | null = null;

    currentWindow
      .onCloseRequested(async (event) => {
        if (closing || !appDataLoadedRef.current) {
          return;
        }

        event.preventDefault();
        closing = true;

        if (saveTimeoutRef.current) {
          window.clearTimeout(saveTimeoutRef.current);
        }

        try {
          await persistAppData(latestAppDataRef.current);
        } catch (error) {
          console.error("Failed to save app data before close", error);
        } finally {
          await currentWindow.destroy();
        }
      })
      .then((nextUnlisten) => {
        unlisten = nextUnlisten;
      })
      .catch((error) => {
        console.error("Failed to attach close save handler", error);
      });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (minimapTimeoutRef.current) {
        window.clearTimeout(minimapTimeoutRef.current);
      }
    };
  }, []);

  const closeContextMenus = () => {
    setContainerMenu((current) => {
      if (current) {
        setClosingContainerMenu(current);
        window.setTimeout(() => setClosingContainerMenu(null), 110);
      }

      return null;
    });
    setCanvasMenu((current) => {
      if (current) {
        setClosingCanvasMenu(current);
        window.setTimeout(() => setClosingCanvasMenu(null), 110);
      }

      return null;
    });
  };

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
      x: clamp((event.clientX - worldRect.left) / zoom, 0, canvasWidth),
      y: clamp((event.clientY - worldRect.top) / zoom, 0, canvasHeight),
    };
  };

  const getVisibleWorldBounds = () => {
    const stageWidth = stageRef.current?.clientWidth ?? window.innerWidth;
    const stageHeight = stageRef.current?.clientHeight ?? window.innerHeight;

    return {
      left: -pan.x / zoom,
      top: -pan.y / zoom,
      right: (-pan.x + stageWidth) / zoom,
      bottom: (-pan.y + stageHeight) / zoom,
    };
  };

  const isElementVisible = (element: ContainerElement) => {
    const bounds = getVisibleWorldBounds();

    return (
      element.x < bounds.right &&
      element.x + element.width > bounds.left &&
      element.y < bounds.bottom &&
      element.y + element.height > bounds.top
    );
  };

  const moveContainerLayer = (
    id: string,
    direction: "back" | "backward" | "forward" | "front",
  ) => {
    setElements((current) => {
      const index = current.findIndex((element) => element.id === id);
      const target = current[index];
      if (!target) {
        return current;
      }

      const withoutTarget = current.filter((element) => element.id !== id);
      const nextIndex =
        direction === "back"
          ? 0
          : direction === "front"
            ? withoutTarget.length
            : direction === "backward"
              ? Math.max(0, index - 1)
              : Math.min(withoutTarget.length, index + 1);

      const nextElements = [...withoutTarget];
      nextElements.splice(nextIndex, 0, target);
      return nextElements;
    });
    setRenamingId(null);
  };

  const selectContainer = (element: ContainerElement) => {
    setSelectedIds([element.id]);
  };

  const animateContainerIn = (id: string) => {
    setEnteringIds((current) => [...current, id]);
    window.setTimeout(() => {
      setEnteringIds((current) => current.filter((enteringId) => enteringId !== id));
    }, 180);
  };

  const removeContainers = (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    setDeletingIds((current) => Array.from(new Set([...current, ...ids])));
    setSelectedIds((current) => current.filter((selectedId) => !ids.includes(selectedId)));
    window.setTimeout(() => {
      setElements((current) => current.filter((element) => !ids.includes(element.id)));
      setDeletingIds((current) => current.filter((deletingId) => !ids.includes(deletingId)));
      setEnteringIds((current) => current.filter((enteringId) => !ids.includes(enteringId)));
    }, 160);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== "Delete" ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      removeContainers(selectedIds);
      closeContextMenus();
      setRenamingId(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds]);

  const selectionBounds =
    dragState?.type === "select"
      ? {
          left: Math.min(dragState.startX, dragState.currentX),
          top: Math.min(dragState.startY, dragState.currentY),
          width: Math.abs(dragState.currentX - dragState.startX),
          height: Math.abs(dragState.currentY - dragState.startY),
        }
      : null;
  const selectionPreviewIds = selectionBounds
    ? elements
        .filter(
          (element) =>
            element.x < selectionBounds.left + selectionBounds.width &&
            element.x + element.width > selectionBounds.left &&
            element.y < selectionBounds.top + selectionBounds.height &&
            element.y + element.height > selectionBounds.top,
        )
        .map((element) => element.id)
    : [];
  const outlinedIds =
    dragState?.type === "select" ? selectionPreviewIds : selectedIds.length > 1 ? selectedIds : [];

  const findSnapOffset = (
    movingGuides: Array<{ value: number; kind: "start" | "end" }>,
    targetGuides: Array<{ value: number; kind: "start" | "end" }>,
  ) => {
    let bestOffset = 0;
    let bestDistance = ALIGN_SNAP_DISTANCE + 1;
    let guide: number | null = null;

    movingGuides.forEach((movingGuide) => {
      targetGuides.forEach((targetGuide) => {
        if (movingGuide.kind !== targetGuide.kind) {
          return;
        }

        const offset = targetGuide.value - movingGuide.value;
        const distance = Math.abs(offset);

        if (distance < bestDistance && distance <= ALIGN_SNAP_DISTANCE) {
          bestDistance = distance;
          bestOffset = offset;
          guide = targetGuide.value;
        }
      });
    });

    return { offset: bestOffset, guide };
  };

  const getAlignmentTargets = (current: ContainerElement[], activeId: string, axis: "x" | "y") =>
    current
      .filter((element) => element.id !== activeId && isElementVisible(element))
      .flatMap((element) =>
        axis === "x"
          ? [
              { value: element.x, kind: "start" as const },
              { value: element.x + element.width, kind: "end" as const },
            ]
          : [
              { value: element.y, kind: "start" as const },
              { value: element.y + element.height, kind: "end" as const },
            ],
      );

  const snapMovedContainer = (
    element: ContainerElement,
    current: ContainerElement[],
    nextX: number,
    nextY: number,
    pointer: { x: number; y: number },
  ) => {
    const xSnap = findSnapOffset(
      [
        { value: nextX, kind: "start" },
        { value: nextX + element.width, kind: "end" },
      ],
      getAlignmentTargets(current, element.id, "x"),
    );
    const ySnap = findSnapOffset(
      [
        { value: nextY, kind: "start" },
        { value: nextY + element.height, kind: "end" },
      ],
      getAlignmentTargets(current, element.id, "y"),
    );

    return {
      x: nextX + xSnap.offset,
      y: nextY + ySnap.offset,
      guides: [
        ...(xSnap.guide === null
          ? []
          : [{ axis: "x" as const, position: xSnap.guide, pointerPosition: pointer.y }]),
        ...(ySnap.guide === null
          ? []
          : [{ axis: "y" as const, position: ySnap.guide, pointerPosition: pointer.x }]),
      ],
    };
  };

  const snapResizedContainer = (
    element: ContainerElement,
    current: ContainerElement[],
    nextWidth: number,
    nextHeight: number,
    pointer: { x: number; y: number },
  ) => {
    const xSnap = findSnapOffset(
      [{ value: element.x + nextWidth, kind: "end" }],
      current
        .filter((target) => target.id !== element.id && isElementVisible(target))
        .map((target) => ({ value: target.x + target.width, kind: "end" as const })),
    );
    const ySnap = findSnapOffset(
      [{ value: element.y + nextHeight, kind: "end" }],
      current
        .filter((target) => target.id !== element.id && isElementVisible(target))
        .map((target) => ({ value: target.y + target.height, kind: "end" as const })),
    );

    return {
      width: nextWidth + xSnap.offset,
      height: nextHeight + ySnap.offset,
      guides: [
        ...(xSnap.guide === null
          ? []
          : [{ axis: "x" as const, position: xSnap.guide, pointerPosition: pointer.y }]),
        ...(ySnap.guide === null
          ? []
          : [{ axis: "y" as const, position: ySnap.guide, pointerPosition: pointer.x }]),
      ],
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
      x: clamp(point.x - width / 2, 0, canvasWidth - width),
      y: clamp(point.y - 28, 0, canvasHeight - height),
      width,
      height,
      accent: DEFAULT_CONTAINER_ACCENT,
    };

    setElements((current) => [...current, nextElement]);
    setSelectedIds([id]);
    animateContainerIn(id);
    closeContextMenus();
    setRenamingId(null);
  };

  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (event.target !== worldRef.current) {
      return;
    }

    setSelectedIds([]);
    closeContextMenus();
    setRenamingId(null);
    setClosingCanvasMenu(null);
    setCanvasMenu({ clientX: event.clientX, clientY: event.clientY });
  };

  const suppressContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const handleMainPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    if ((event.target as HTMLElement | null)?.closest("[data-context-menu]")) {
      return;
    }

    closeContextMenus();
  };

  const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedIds([]);
    closeContextMenus();
    setRenamingId(null);
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

  const handleWorldPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== worldRef.current) {
      return;
    }

    event.preventDefault();
    closeContextMenus();
    setRenamingId(null);
    const point = canvasPointFromEvent(event);
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    setDragState({
      type: "select",
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    if (dragState.type === "select") {
      setSnapGuides([]);
      const point = canvasPointFromEvent(event);
      setDragState({
        ...dragState,
        currentX: point.x,
        currentY: point.y,
      });
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;

    if (dragState.type === "pan") {
      setSnapGuides([]);
      showMinimap();
      setPan({
        x: dragState.startPanX + deltaX,
        y: dragState.startPanY + deltaY,
      });
      return;
    }

    const worldDeltaX = deltaX / zoom;
    const worldDeltaY = deltaY / zoom;
    const pointerPoint = canvasPointFromEvent(event);
    let nextGuides: SnapGuide[] = [];

    if (dragState.type === "move") {
      const activeStart = dragState.startPositions.find((position) => position.id === dragState.id);
      const activeElement = elements.find((element) => element.id === dragState.id);

      if (!activeStart || !activeElement) {
        return;
      }

      const nextX = clamp(activeStart.x + worldDeltaX, 0, canvasWidth - activeElement.width);
      const nextY = clamp(activeStart.y + worldDeltaY, 0, canvasHeight - activeElement.height);
      const snapped = event.shiftKey
        ? snapMovedContainer(activeElement, elements, nextX, nextY, pointerPoint)
        : { x: nextX, y: nextY, guides: [] };
      const appliedDeltaX = clamp(snapped.x, 0, canvasWidth - activeElement.width) - activeStart.x;
      const appliedDeltaY = clamp(snapped.y, 0, canvasHeight - activeElement.height) - activeStart.y;
      nextGuides = snapped.guides;

      setElements(
        elements.map((element) => {
          const startPosition = dragState.startPositions.find((position) => position.id === element.id);
          if (!startPosition) {
            return element;
          }

          return {
            ...element,
            x: clamp(startPosition.x + appliedDeltaX, 0, canvasWidth - element.width),
            y: clamp(startPosition.y + appliedDeltaY, 0, canvasHeight - element.height),
          };
        }),
      );
      setSnapGuides(event.shiftKey ? nextGuides : []);
      return;
    }

    setElements(
      elements.map((element) => {
        if (element.id !== dragState.id) {
          return element;
        }

        const nextWidth = clamp(dragState.startWidth + worldDeltaX, MIN_WIDTH, canvasWidth - element.x);
        const nextHeight = clamp(dragState.startHeight + worldDeltaY, MIN_HEIGHT, canvasHeight - element.y);
        const snapped = event.shiftKey
          ? snapResizedContainer(element, elements, nextWidth, nextHeight, pointerPoint)
          : { width: nextWidth, height: nextHeight, guides: [] };
        nextGuides = snapped.guides;

        return {
          ...element,
          width: clamp(snapped.width, MIN_WIDTH, canvasWidth - element.x),
          height: clamp(snapped.height, MIN_HEIGHT, canvasHeight - element.y),
        };
      }),
    );
    setSnapGuides(event.shiftKey ? nextGuides : []);
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    if (dragState.type === "select") {
      const endPoint = canvasPointFromEvent(event);
      const left = Math.min(dragState.startX, endPoint.x);
      const top = Math.min(dragState.startY, endPoint.y);
      const right = Math.max(dragState.startX, endPoint.x);
      const bottom = Math.max(dragState.startY, endPoint.y);
      const tinySelection = right - left < 4 && bottom - top < 4;

      setSelectedIds(
        tinySelection
          ? []
          : elements
              .filter(
                (element) =>
                  element.x < right &&
                  element.x + element.width > left &&
                  element.y < bottom &&
                  element.y + element.height > top,
              )
              .map((element) => element.id),
      );
    }

    setDragState(null);
    setSnapGuides([]);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    closeContextMenus();
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

  const startMove = (event: PointerEvent<HTMLElement>, element: ContainerElement) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    const movingIds = selectedIds.includes(element.id) ? selectedIds : [element.id];
    if (!selectedIds.includes(element.id)) {
      selectContainer(element);
    }
    closeContextMenus();
    setRenamingId(null);
    setDragState({
      type: "move",
      pointerId: event.pointerId,
      id: element.id,
      ids: movingIds,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositions: elements
        .filter((currentElement) => movingIds.includes(currentElement.id))
        .map((currentElement) => ({
          id: currentElement.id,
          x: currentElement.x,
          y: currentElement.y,
        })),
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
    selectContainer(element);
    closeContextMenus();
    setRenamingId(null);
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
    selectContainer(element);
    setRenamingId(null);
    setRenameDraft(element.name);

    if (containerMenu?.id === element.id) {
      closeContextMenus();
      return;
    }

    closeContextMenus();
    setClosingContainerMenu(null);
    setContainerMenu({
      id: element.id,
      left: rect.right + 8,
      top: rect.top,
    });
  };

  const startRename = (element: ContainerElement) => {
    setRenameDraft(element.name);
    setRenamingId(element.id);
    closeContextMenus();
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
    closeContextMenus();
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const deleteContainer = (id: string) => {
    removeContainers([id]);
    closeContextMenus();
    setRenamingId(null);
  };

  const copyContainer = (element: ContainerElement) => {
    setCopiedContainer({
      name: element.name,
      width: element.width,
      height: element.height,
      accent: element.accent,
    });
    closeContextMenus();
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
      x: clamp(point.x - copiedContainer.width / 2, 0, canvasWidth - copiedContainer.width),
      y: clamp(point.y - 28, 0, canvasHeight - copiedContainer.height),
    };

    setElements((current) => [...current, duplicate]);
    setSelectedIds([id]);
    animateContainerIn(id);
    closeContextMenus();
    setRenamingId(null);
  };

  const requestClearCanvas = () => {
    closeContextMenus();
    setClearModalOpen(true);
  };

  const clearCanvas = () => {
    removeContainers(elements.map((element) => element.id));
    closeContextMenus();
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

  const applyAppData = (data: AppData) => {
    const normalized = normalizeAppData(data);
    const selectedCanvas =
      normalized.canvases.find((canvas) => canvas.id === normalized.activeCanvasId) ??
      normalized.canvases[0] ??
      DEFAULT_CANVAS;

    setCanvases(normalized.canvases.length ? normalized.canvases : [DEFAULT_CANVAS]);
    setActiveCanvas(selectedCanvas);
    setElements(selectedCanvas.containers);
    setPan(selectedCanvas.pan);
    setZoom(selectedCanvas.zoom);
    setCanvasGridStyle(normalized.canvasGridStyle);
    setCanvasGridOpacity(normalized.canvasGridOpacity);
    setSelectedIds([]);
    setRenamingId(null);
    setCopiedContainer(null);
    closeContextMenus();
  };

  const exportData = async (password: string) => {
    const payload = await invoke<string>("export_app_data", {
      data: getCurrentAppData(),
      password,
    });
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `taskmap-export-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File, password: string) => {
    const payload = await file.text();
    const data = await invoke<AppData>("import_app_data", { payload, password });
    applyAppData(data);
    setStorageError(null);
  };

  const resetLocalDatabase = async () => {
    await invoke("reset_local_database");
    const data: AppData = {
      activeCanvasId: DEFAULT_CANVAS.id,
      canvases: [DEFAULT_CANVAS],
      canvasGridStyle: "dots",
      canvasGridOpacity: DEFAULT_GRID_OPACITY,
    };

    latestAppDataRef.current = data;
    applyAppData(data);
    setStorageError(null);
    setAppDataLoaded(true);
    appDataLoadedRef.current = true;
    await persistAppData(data);
  };

  const createCanvas = (draft: Pick<TaskCanvas, "name" | "width" | "height">) => {
    const currentCanvases = getPersistedCanvases();
    const width = clampCanvasSize(draft.width);
    const height = clampCanvasSize(draft.height);
    const canvas: TaskCanvas = {
      id: `canvas-${Date.now()}`,
      name: draft.name.trim() || "Untitled canvas",
      width,
      height,
      containers: [],
      pan: DEFAULT_PAN,
      zoom: 1,
    };

    setCanvases([...currentCanvases, canvas]);
    setActiveCanvas(canvas);
    setElements([]);
    setPan(canvas.pan);
    setZoom(canvas.zoom);
    setSelectedIds([]);
    setRenamingId(null);
    closeContextMenus();
  };

  const selectCanvas = (id: string) => {
    if (id === activeCanvas.id) {
      return;
    }

    const currentCanvases = getPersistedCanvases();
    const nextCanvas = currentCanvases.find((canvas) => canvas.id === id);
    if (!nextCanvas) {
      return;
    }

    setCanvases(currentCanvases);
    setActiveCanvas(nextCanvas);
    setElements(nextCanvas.containers);
    setPan(nextCanvas.pan);
    setZoom(nextCanvas.zoom);
    setSelectedIds([]);
    setRenamingId(null);
    closeContextMenus();
  };

  const updateCanvas = (id: string, updates: Pick<TaskCanvas, "name" | "width" | "height">) => {
    const width = clampCanvasSize(updates.width);
    const height = clampCanvasSize(updates.height);

    setCanvases((current) =>
      current.map((canvas) =>
        canvas.id === id
          ? {
              ...canvas,
              name: updates.name,
              width,
              height,
            }
          : canvas,
      ),
    );

    if (id === activeCanvas.id) {
      setActiveCanvas((current) => ({
        ...current,
        name: updates.name,
        width,
        height,
      }));
      setElements((current) =>
        current.map((element) => ({
          ...element,
          x: clamp(element.x, 0, Math.max(0, width - element.width)),
          y: clamp(element.y, 0, Math.max(0, height - element.height)),
          width: Math.min(element.width, width),
          height: Math.min(element.height, height),
        })),
      );
    }
  };

  const deleteCanvas = (id: string) => {
    const currentCanvases = getPersistedCanvases();
    if (currentCanvases.length <= 1) {
      return;
    }

    const nextCanvases = currentCanvases.filter((canvas) => canvas.id !== id);
    const nextActiveCanvas =
      id === activeCanvas.id ? nextCanvases[Math.max(currentCanvases.findIndex((canvas) => canvas.id === id) - 1, 0)] : activeCanvas;

    setCanvases(nextCanvases);

    if (nextActiveCanvas.id !== activeCanvas.id) {
      setActiveCanvas(nextActiveCanvas);
      setElements(nextActiveCanvas.containers);
      setPan(nextActiveCanvas.pan);
      setZoom(nextActiveCanvas.zoom);
      setSelectedIds([]);
      setRenamingId(null);
      closeContextMenus();
    }
  };

  const reorderCanvases = (orderedIds: string[]) => {
    const currentCanvases = getPersistedCanvases();
    const nextCanvases = orderedIds
      .map((id) => currentCanvases.find((canvas) => canvas.id === id))
      .filter((canvas): canvas is TaskCanvas => Boolean(canvas));
    const missingCanvases = currentCanvases.filter((canvas) => !orderedIds.includes(canvas.id));

    if (nextCanvases.length === 0) {
      return;
    }

    nextCanvases.push(...missingCanvases);
    setCanvases(nextCanvases);
  };

  const toggleCanvasManager = () => {
    if (canvasManagerOpen && !canvasManagerClosing) {
      setCanvasManagerClosing(true);
      window.setTimeout(() => {
        setCanvasManagerOpen(false);
        setCanvasManagerClosing(false);
      }, CANVAS_MANAGER_ANIMATION_MS);
      return;
    }

    setCanvasManagerOpen(true);
    setCanvasManagerClosing(false);
  };

  const stageWidth = stageRef.current?.clientWidth ?? window.innerWidth;
  const stageHeight = stageRef.current?.clientHeight ?? window.innerHeight;
  const canvasWidth = activeCanvas.width;
  const canvasHeight = activeCanvas.height;
  const canvasAspect = canvasWidth / canvasHeight;
  const minimapWidth =
    canvasAspect >= 1
      ? MINIMAP_MAX_SIZE
      : Math.max(72, Math.round(MINIMAP_MAX_SIZE * canvasAspect));
  const minimapHeight =
    canvasAspect >= 1
      ? Math.max(72, Math.round(MINIMAP_MAX_SIZE / canvasAspect))
      : MINIMAP_MAX_SIZE;
  const visibleWorldLeft = -pan.x / zoom;
  const visibleWorldTop = -pan.y / zoom;
  const minimapViewportWidth = clamp((stageWidth / zoom / canvasWidth) * minimapWidth, 8, minimapWidth);
  const minimapViewportHeight = clamp((stageHeight / zoom / canvasHeight) * minimapHeight, 8, minimapHeight);
  const minimapViewport = {
    x: (visibleWorldLeft / canvasWidth) * minimapWidth,
    y: (visibleWorldTop / canvasHeight) * minimapHeight,
    width: minimapViewportWidth,
    height: minimapViewportHeight,
  };
  const contextMenuElement = containerMenu
    ? elements.find((element) => element.id === containerMenu.id)
    : null;
  const closingContextMenuElement = closingContainerMenu
    ? elements.find((element) => element.id === closingContainerMenu.id)
    : null;
  const dotGridOpacityScale = clamp((zoom - 0.55) / 0.45, 0, 1);

  return (
    <main
      data-theme="taskmap"
      className="h-full w-full bg-[color:var(--void-bg)] text-white"
      onContextMenu={suppressContextMenu}
      onPointerDownCapture={handleMainPointerDownCapture}
    >
      <div className="h-full">
        <section className="relative h-full overflow-hidden">
          <FloatingToolbar
            onToggleCanvases={toggleCanvasManager}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          {canvasManagerOpen && (
            <CanvasManager
              canvases={getPersistedCanvases()}
              activeCanvasId={activeCanvas.id}
              closing={canvasManagerClosing}
              viewportWidth={stageWidth}
              viewportHeight={stageHeight}
              onCreateCanvas={createCanvas}
              onSelectCanvas={selectCanvas}
              onUpdateCanvas={updateCanvas}
              onDeleteCanvas={deleteCanvas}
              onReorderCanvases={reorderCanvases}
            />
          )}
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
              data-grid-style={canvasGridStyle}
              style={{
                "--canvas-grid-opacity": canvasGridOpacity[canvasGridStyle] / 100,
                "--canvas-dot-size": `${1.25 / zoom}px`,
                "--canvas-dot-opacity-scale": dotGridOpacityScale,
                width: canvasWidth,
                height: canvasHeight,
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                transformOrigin: "0 0",
              } as React.CSSProperties}
              onContextMenu={handleCanvasContextMenu}
              onPointerDown={handleWorldPointerDown}
            >
              {snapGuides.map((guide) => (
                <div
                  key={`${guide.axis}-${guide.position}`}
                  className="pointer-events-none absolute z-0"
                  style={
                    guide.axis === "x"
                      ? {
                          left: guide.position,
                          top: 0,
                          width: 2,
                          height: canvasHeight,
                          backgroundImage:
                            "repeating-linear-gradient(to bottom, rgba(45, 216, 200, 0.48) 0 6px, transparent 6px 13px)",
                          maskImage: `linear-gradient(to bottom, transparent 0, black ${Math.max(
                            guide.pointerPosition - 260,
                            0,
                          )}px, black ${Math.min(guide.pointerPosition + 260, canvasHeight)}px, transparent 100%)`,
                          WebkitMaskImage: `linear-gradient(to bottom, transparent 0, black ${Math.max(
                            guide.pointerPosition - 260,
                            0,
                          )}px, black ${Math.min(guide.pointerPosition + 260, canvasHeight)}px, transparent 100%)`,
                        }
                      : {
                          left: 0,
                          top: guide.position,
                          width: canvasWidth,
                          height: 2,
                          backgroundImage:
                            "repeating-linear-gradient(to right, rgba(45, 216, 200, 0.48) 0 6px, transparent 6px 13px)",
                          maskImage: `linear-gradient(to right, transparent 0, black ${Math.max(
                            guide.pointerPosition - 260,
                            0,
                          )}px, black ${Math.min(guide.pointerPosition + 260, canvasWidth)}px, transparent 100%)`,
                          WebkitMaskImage: `linear-gradient(to right, transparent 0, black ${Math.max(
                            guide.pointerPosition - 260,
                            0,
                          )}px, black ${Math.min(guide.pointerPosition + 260, canvasWidth)}px, transparent 100%)`,
                        }
                  }
                />
              ))}
              {elements.map((element) => (
                <ContainerNode
                  key={element.id}
                  element={element}
                  selected={outlinedIds.includes(element.id)}
                  multiSelected={selectedIds.length > 1 && selectedIds.includes(element.id)}
                  entering={enteringIds.includes(element.id)}
                  deleting={deletingIds.includes(element.id)}
                  dragState={dragState}
                  renaming={renamingId === element.id}
                  renameDraft={renameDraft}
                  onRenameDraftChange={setRenameDraft}
                  onSaveRename={saveRename}
                  onCancelRename={cancelRename}
                  onSelect={selectContainer}
                  onStartMove={startMove}
                  onStartResize={startResize}
                  onToggleMenu={toggleMenu}
                />
              ))}
              {selectionBounds && (
                <div
                  className="pointer-events-none absolute z-30 rounded-md border border-white/45 bg-white/[0.08] shadow-[0_0_0_1px_rgba(0,0,0,0.22)]"
                  style={{
                    left: selectionBounds.left,
                    top: selectionBounds.top,
                    width: selectionBounds.width,
                    height: selectionBounds.height,
                  }}
                />
              )}
            </div>
          </div>

          {containerMenu && contextMenuElement && (
            <ContainerContextMenu
              key={`${containerMenu.id}-${containerMenu.left}-${containerMenu.top}`}
              menu={containerMenu}
              element={contextMenuElement}
              closing={false}
              onStartRename={startRename}
              onUpdateAccent={updateContainerAccent}
              onCopy={copyContainer}
              onMoveLayer={moveContainerLayer}
              onDelete={deleteContainer}
            />
          )}

          {closingContainerMenu && closingContextMenuElement && (
            <ContainerContextMenu
              key={`closing-${closingContainerMenu.id}-${closingContainerMenu.left}-${closingContainerMenu.top}`}
              menu={closingContainerMenu}
              element={closingContextMenuElement}
              closing
              onStartRename={startRename}
              onUpdateAccent={updateContainerAccent}
              onCopy={copyContainer}
              onMoveLayer={moveContainerLayer}
              onDelete={deleteContainer}
            />
          )}

          {canvasMenu && (
            <CanvasContextMenu
              key={`${canvasMenu.clientX}-${canvasMenu.clientY}`}
              menu={canvasMenu}
              hasCopiedContainer={Boolean(copiedContainer)}
              closing={false}
              onPaste={pasteContainer}
              onCreate={createContainer}
              onClear={requestClearCanvas}
            />
          )}

          {closingCanvasMenu && (
            <CanvasContextMenu
              key={`closing-${closingCanvasMenu.clientX}-${closingCanvasMenu.clientY}`}
              menu={closingCanvasMenu}
              hasCopiedContainer={Boolean(copiedContainer)}
              closing
              onPaste={pasteContainer}
              onCreate={createContainer}
              onClear={requestClearCanvas}
            />
          )}

          {clearModalOpen && (
            <ClearCanvasModal onCancel={() => setClearModalOpen(false)} onConfirm={clearCanvas} />
          )}

          {settingsOpen && (
            <SettingsModal
              canvasGridStyle={canvasGridStyle}
              onCanvasGridStyleChange={setCanvasGridStyle}
              canvasGridOpacity={canvasGridOpacity[canvasGridStyle]}
              onCanvasGridOpacityChange={(opacity) =>
                setCanvasGridOpacity((current) => ({
                  ...current,
                  [canvasGridStyle]: opacity,
                }))
              }
              onExportData={exportData}
              onImportData={importData}
              onClose={() => setSettingsOpen(false)}
            />
          )}

          {storageError && (
            <div className="fixed bottom-4 right-4 z-50 max-w-[420px] rounded-lg border border-red-300/25 bg-[#281b1d]/95 p-3 text-sm text-red-100 shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
              <div className="mb-1 font-semibold">Storage error</div>
              <div className="text-red-100/75">{storageError}</div>
              {storageError.includes("database key no longer matches") && (
                <button
                  className="mt-3 flex h-9 items-center gap-2 rounded-md bg-red-300/14 px-3 text-sm text-red-100 transition-colors hover:bg-red-300/22"
                  onClick={() => {
                    resetLocalDatabase().catch((error) => {
                      const message = `Failed to reset local database: ${String(error)}`;
                      setStorageError(message);
                      console.error(message);
                    });
                  }}
                >
                  <IconRotateClockwise size={17} stroke={2} />
                  <span>Reset local data</span>
                </button>
              )}
            </div>
          )}

          <Minimap
            elements={elements}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            visible={minimapVisible}
            zoom={zoom}
            viewport={minimapViewport}
            onResetZoom={resetZoom}
          />
        </section>
      </div>
    </main>
  );
}

export default App;
