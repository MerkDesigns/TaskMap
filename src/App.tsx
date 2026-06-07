import { PointerEvent, WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check as checkForUpdate, Update } from "@tauri-apps/plugin-updater";
import { IconRotateClockwise } from "@tabler/icons-react";
import { CanvasManager } from "./components/CanvasManager";
import {
  CanvasContextMenu,
  ContainerContentContextMenu,
  ContainerContextMenu,
  TextCardContextMenu,
} from "./components/ContextMenus";
import { ContainerNode } from "./components/ContainerNode";
import { FloatingToolbar } from "./components/FloatingToolbar";
import { Minimap } from "./components/Minimap";
import { ClearCanvasModal, SettingsModal } from "./components/Modals";
import { TextCardNode } from "./components/TextCardNode";
import { ToastStack } from "./components/ToastStack";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ALIGN_SNAP_DISTANCE,
  DEFAULT_CONTAINER_ACCENT,
  DEFAULT_TEXT_CARD_ACCENT,
  MIN_HEIGHT,
  MIN_WIDTH,
  MINIMAP_MAX_SIZE,
  ZOOM_STEP,
} from "./constants";
import { clamp, quantizeZoom } from "./canvasMath";
import {
  AppData,
  AppUpdateInfo,
  CanvasGridStyle,
  ContainerElement,
  ContainerMenuState,
  CopiedCanvasItem,
  DragState,
  TaskCanvas,
  TextCardElement,
  ToastMessage,
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

type UpdateCheckSource = "startup" | "manual";

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
  textCards: [],
  pan: DEFAULT_PAN,
  zoom: 1,
};
const CANVAS_MANAGER_ANIMATION_MS = 160;
const CONTAINER_HEADER_HEIGHT = 48;
const CONTAINER_TEXT_CARD_PADDING = 17;
const CONTAINER_TEXT_CARD_ROW_HEIGHT = 43;
const CONTAINER_TEXT_CARD_GAP = 8;
const HISTORY_LIMIT = 60;
const HISTORY_DEBOUNCE_MS = 300;

const getWindowPreviewViewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const minimapTimeoutRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<Update | null>(null);
  const autoUpdateCheckRef = useRef(false);
  const textCardDropPreviewRef = useRef<{ containerId: string; index: number } | null>(null);
  const textCardDragCenterYRef = useRef<number | null>(null);
  const historyRef = useRef<AppData[]>([]);
  const historyIndexRef = useRef(-1);
  const historyTimeoutRef = useRef<number | null>(null);
  const applyingHistoryRef = useRef(false);
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
  const [containerContentMenu, setContainerContentMenu] =
    useState<{ containerId: string; clientX: number; clientY: number } | null>(null);
  const [closingContainerContentMenu, setClosingContainerContentMenu] =
    useState<{ containerId: string; clientX: number; clientY: number } | null>(null);
  const [textCardMenu, setTextCardMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const [closingTextCardMenu, setClosingTextCardMenu] =
    useState<{ id: string; left: number; top: number } | null>(null);
  const [canvasMenu, setCanvasMenu] = useState<{ clientX: number; clientY: number } | null>(null);
  const [closingCanvasMenu, setClosingCanvasMenu] = useState<{ clientX: number; clientY: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [editingTextCardId, setEditingTextCardId] = useState<string | null>(null);
  const [textCardDraft, setTextCardDraft] = useState("");
  const [copiedItem, setCopiedItem] = useState<CopiedCanvasItem | null>(null);
  const [canvasGridStyle, setCanvasGridStyle] = useState<CanvasGridStyle>("dots");
  const [canvasGridOpacity, setCanvasGridOpacity] =
    useState<Record<CanvasGridStyle, number>>(DEFAULT_GRID_OPACITY);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdateInfo | null>(null);
  const [appVersion, setAppVersion] = useState("0.0.0");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [canvasManagerOpen, setCanvasManagerOpen] = useState(false);
  const [canvasManagerClosing, setCanvasManagerClosing] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [enteringIds, setEnteringIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [enteringTextCardIds, setEnteringTextCardIds] = useState<string[]>([]);
  const [deletingTextCardIds, setDeletingTextCardIds] = useState<string[]>([]);
  const [pulsingTextCardIds, setPulsingTextCardIds] = useState<string[]>([]);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [activeCanvas, setActiveCanvas] = useState<TaskCanvas>(DEFAULT_CANVAS);
  const [canvases, setCanvases] = useState<TaskCanvas[]>([DEFAULT_CANVAS]);
  const [elements, setElements] = useState<ContainerElement[]>(DEFAULT_ELEMENTS);
  const [textCards, setTextCards] = useState<TextCardElement[]>([]);
  const [textCardDropPreview, setTextCardDropPreview] =
    useState<{ containerId: string; index: number } | null>(null);
  const [textCardDetachedContainerId, setTextCardDetachedContainerId] = useState<string | null>(null);
  const [settlingTextCardId, setSettlingTextCardId] = useState<string | null>(null);
  const [containerScrollOffsets, setContainerScrollOffsets] = useState<Record<string, number>>({});
  const [dragState, setDragState] = useState<DragState | null>(null);
  const containersById = useMemo(
    () => new Map(elements.map((element) => [element.id, element])),
    [elements],
  );
  const textCardsById = useMemo(
    () => new Map(textCards.map((card) => [card.id, card])),
    [textCards],
  );
  const orderedTextCardsByContainerId = useMemo(() => {
    const grouped = new Map<string, TextCardElement[]>();

    textCards.forEach((card) => {
      if (!card.containerId) {
        return;
      }

      const containerCards = grouped.get(card.containerId) ?? [];
      containerCards.push(card);
      grouped.set(card.containerId, containerCards);
    });

    grouped.forEach((containerCards) => {
      containerCards.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    });

    return grouped;
  }, [textCards]);
  const looseTextCards = useMemo(
    () => textCards.filter((card) => !card.containerId),
    [textCards],
  );
  const renderedLooseTextCards = useMemo(() => {
    const extraCards: TextCardElement[] = [];

    if (dragState?.type === "text-card-move") {
      const draggedCard = textCardsById.get(dragState.id);
      if (draggedCard?.containerId) {
        extraCards.push(draggedCard);
      }
    }

    if (settlingTextCardId) {
      const settlingCard = textCardsById.get(settlingTextCardId);
      if (
        settlingCard?.containerId &&
        !extraCards.some((card) => card.id === settlingCard.id)
      ) {
        extraCards.push(settlingCard);
      }
    }

    return extraCards.length ? [...looseTextCards, ...extraCards] : looseTextCards;
  }, [dragState, looseTextCards, settlingTextCardId, textCardsById]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)),
    );
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 260);
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, "id"> & { duration?: number }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const nextToast = {
        id,
        tone: toast.tone,
        title: toast.title,
        message: toast.message,
        exiting: false,
      };

      setToasts((current) => [nextToast, ...current].slice(0, 4));
      window.setTimeout(() => dismissToast(id), toast.duration ?? 4800);
    },
    [dismissToast],
  );

  const persistAppData = async (data: AppData) => {
    await invoke("save_app_data", { data });
  };

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch((error) => {
        console.error("Failed to read app version", error);
      });
  }, []);

  const normalizeAppData = (data: AppData | LegacyAppData): AppData => {
    if (Array.isArray(data.canvases) && data.activeCanvasId) {
      return {
        ...(data as AppData),
        canvases: (data as AppData).canvases.map((canvas) => ({
          ...canvas,
          textCards: canvas.textCards ?? [],
          previewViewport: canvas.previewViewport ?? getWindowPreviewViewport(),
        })),
      };
    }

    const legacy = data as LegacyAppData;

    return {
      activeCanvasId: DEFAULT_CANVAS.id,
      canvases: [
        {
          ...DEFAULT_CANVAS,
          containers: legacy.containers ?? DEFAULT_ELEMENTS,
          textCards: [],
          pan: legacy.pan ?? DEFAULT_PAN,
          zoom: legacy.zoom ?? 1,
          previewViewport: getWindowPreviewViewport(),
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
    textCards,
    pan,
    zoom,
    previewViewport: {
      width: stageRef.current?.clientWidth ?? window.innerWidth,
      height: stageRef.current?.clientHeight ?? window.innerHeight,
    },
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

  const cloneAppData = (data: AppData): AppData => JSON.parse(JSON.stringify(data));

  const omitCameraFromHistory = (data: AppData): AppData => ({
    ...data,
    canvases: data.canvases.map((canvas) => ({
      ...canvas,
      pan: { x: 0, y: 0 },
      zoom: 1,
      previewViewport: undefined,
    })),
  });

  const updateHistoryState = () => {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    });
  };

  const pushHistorySnapshot = (data: AppData) => {
    const snapshot = omitCameraFromHistory(cloneAppData(data));
    const previous = historyRef.current[historyIndexRef.current];

    if (previous && JSON.stringify(previous) === JSON.stringify(snapshot)) {
      return;
    }

    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(snapshot);

    if (nextHistory.length > HISTORY_LIMIT) {
      nextHistory.shift();
    }

    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    updateHistoryState();
  };

  const scheduleHistorySnapshot = (data: AppData) => {
    if (!appDataLoadedRef.current || applyingHistoryRef.current) {
      return;
    }

    if (historyTimeoutRef.current) {
      window.clearTimeout(historyTimeoutRef.current);
    }

    historyTimeoutRef.current = window.setTimeout(() => {
      historyTimeoutRef.current = null;
      pushHistorySnapshot(data);
    }, HISTORY_DEBOUNCE_MS);
  };

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
          setTextCards(selectedCanvas.textCards);
          setPan(selectedCanvas.pan);
          setZoom(selectedCanvas.zoom);
          setCanvasGridStyle(normalized.canvasGridStyle);
          setCanvasGridOpacity(normalized.canvasGridOpacity);
          historyRef.current = [omitCameraFromHistory(cloneAppData(normalized))];
          historyIndexRef.current = 0;
          updateHistoryState();
        } else {
          const initialData = omitCameraFromHistory(cloneAppData(latestAppDataRef.current));
          historyRef.current = [initialData];
          historyIndexRef.current = 0;
          updateHistoryState();
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
    const data = getCurrentAppData();
    latestAppDataRef.current = data;
    scheduleHistorySnapshot(data);
  }, [activeCanvas, canvasGridOpacity, canvasGridStyle, canvases, elements, pan, textCards, zoom]);

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
    textCards,
    zoom,
  ]);

  useEffect(() => {
    return () => {
      if (minimapTimeoutRef.current) {
        window.clearTimeout(minimapTimeoutRef.current);
      }
      if (historyTimeoutRef.current) {
        window.clearTimeout(historyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const htmlSpellCheck = document.documentElement.getAttribute("spellcheck");
    const bodySpellCheck = document.body.getAttribute("spellcheck");

    document.documentElement.setAttribute("spellcheck", "false");
    document.body.setAttribute("spellcheck", "false");

    return () => {
      if (htmlSpellCheck === null) {
        document.documentElement.removeAttribute("spellcheck");
      } else {
        document.documentElement.setAttribute("spellcheck", htmlSpellCheck);
      }

      if (bodySpellCheck === null) {
        document.body.removeAttribute("spellcheck");
      } else {
        document.body.setAttribute("spellcheck", bodySpellCheck);
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
    setContainerContentMenu((current) => {
      if (current) {
        setClosingContainerContentMenu(current);
        window.setTimeout(() => setClosingContainerContentMenu(null), 110);
      }

      return null;
    });
    setTextCardMenu((current) => {
      if (current) {
        setClosingTextCardMenu(current);
        window.setTimeout(() => setClosingTextCardMenu(null), 110);
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

  const updateTextCardDropPreview = (preview: { containerId: string; index: number } | null) => {
    textCardDropPreviewRef.current = preview;
    setTextCardDropPreview(preview);
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

  const getContainerContentHeight = (containerId: string) => {
    const cardCount = orderedTextCardsByContainerId.get(containerId)?.length ?? 0;

    if (cardCount === 0) {
      return CONTAINER_TEXT_CARD_PADDING * 2;
    }

    return (
      CONTAINER_TEXT_CARD_PADDING * 2 +
      cardCount * CONTAINER_TEXT_CARD_ROW_HEIGHT +
      (cardCount - 1) * CONTAINER_TEXT_CARD_GAP
    );
  };

  const getContainerMaxScroll = (container: ContainerElement) =>
    Math.max(0, getContainerContentHeight(container.id) - (container.height - CONTAINER_HEADER_HEIGHT));

  const getContainerScrollOffset = (container: ContainerElement) =>
    clamp(containerScrollOffsets[container.id] ?? 0, 0, getContainerMaxScroll(container));

  const handleContainerWheel = (event: WheelEvent<HTMLElement>, container: ContainerElement) => {
    const maxScroll = getContainerMaxScroll(container);

    if (maxScroll <= 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setContainerScrollOffsets((current) => ({
      ...current,
      [container.id]: clamp((current[container.id] ?? 0) + event.deltaY, 0, maxScroll),
    }));
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

  const getOrderedContainerTextCards = (containerId: string, cards = textCards) =>
    cards === textCards
      ? orderedTextCardsByContainerId.get(containerId) ?? []
      : cards
          .filter((card) => card.containerId === containerId)
          .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

  const getTextCardStackPosition = (card: TextCardElement, cards = textCards) => {
    const container = card.containerId ? containersById.get(card.containerId) : null;
    if (!container) {
      return { x: card.x, y: card.y };
    }

    const orderedCards = getOrderedContainerTextCards(container.id, cards);
    const index = Math.max(
      orderedCards.findIndex((currentCard) => currentCard.id === card.id),
      0,
    );

    return {
      x: container.x + CONTAINER_TEXT_CARD_PADDING,
      y:
        container.y +
        CONTAINER_HEADER_HEIGHT +
        CONTAINER_TEXT_CARD_PADDING +
        index * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP) -
        getContainerScrollOffset(container),
    };
  };

  const toContainerRelativePosition = (
    position: { x: number; y: number; width?: number; height?: number; maxWidth?: number; text?: string },
    container: ContainerElement,
  ) => ({
    ...position,
    x: position.x - container.x,
    y: position.y - container.y,
  });

  const getTextCardRenderPosition = (card: TextCardElement) => {
    if (!card.containerId) {
      return undefined;
    }

    const draggingTextCard = dragState?.type === "text-card-move" && dragState.id === card.id;
    if (draggingTextCard) {
      return { x: card.x, y: card.y };
    }

    const container = containersById.get(card.containerId);
    if (!container) {
      return { x: card.x, y: card.y };
    }

    const draggedId = dragState?.type === "text-card-move" ? dragState.id : null;
    const previewingThisContainer = textCardDropPreview?.containerId === container.id;
    const detachedFromThisContainer = textCardDetachedContainerId === container.id;
    const orderedCards = getOrderedContainerTextCards(container.id).filter(
      (currentCard) =>
        !(previewingThisContainer || detachedFromThisContainer) || currentCard.id !== draggedId,
    );
    let index = Math.max(
      orderedCards.findIndex((currentCard) => currentCard.id === card.id),
      0,
    );

    if (previewingThisContainer && index >= textCardDropPreview.index) {
      index += 1;
    }

    return {
      x: container.x + CONTAINER_TEXT_CARD_PADDING,
      y:
        container.y +
        CONTAINER_HEADER_HEIGHT +
        CONTAINER_TEXT_CARD_PADDING +
        index * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP) -
        getContainerScrollOffset(container),
    };
  };

  const getTextCardDropContainer = (point: { x: number; y: number }) => {
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index];
      const bodyTop = element.y + CONTAINER_HEADER_HEIGHT;
      if (
        point.x >= element.x &&
        point.x <= element.x + element.width &&
        point.y >= bodyTop &&
        point.y <= element.y + element.height
      ) {
        return element;
      }
    }

    return null;
  };

  const getTextCardDropIndex = (
    container: ContainerElement,
    point: { x: number; y: number },
    cards: TextCardElement[],
    draggingId: string,
    currentIndex?: number,
  ) => {
    const orderedCards = cards
      .filter((card) => card.containerId === container.id)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    const stackTop =
      container.y +
      CONTAINER_HEADER_HEIGHT +
      CONTAINER_TEXT_CARD_PADDING -
      getContainerScrollOffset(container);
    const slotHeight = CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP;

    if (currentIndex !== undefined) {
      const cardsWithoutDragged = orderedCards.filter((card) => card.id !== draggingId);
      const previousCard = cardsWithoutDragged[currentIndex - 1];
      const nextCard = cardsWithoutDragged[currentIndex];

      if (previousCard) {
        const previousMidpoint =
          stackTop + (currentIndex - 1) * slotHeight + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2;
        if (point.y < previousMidpoint) {
          return currentIndex - 1;
        }
      }

      if (nextCard) {
        const nextMidpoint =
          stackTop + (currentIndex + 1) * slotHeight + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2;
        if (point.y > nextMidpoint) {
          return currentIndex + 1;
        }
      }

      return currentIndex;
    }

    let insertionIndex = 0;

    for (let index = 0; index < orderedCards.length; index += 1) {
      if (orderedCards[index].id === draggingId) {
        continue;
      }

      const midpoint = stackTop + index * slotHeight + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2;
      if (point.y < midpoint) {
        return insertionIndex;
      }

      insertionIndex += 1;
    }

    return insertionIndex;
  };

  const getDirectionalTextCardDropIndex = (
    container: ContainerElement,
    centerY: number,
    cards: TextCardElement[],
    draggingId: string,
    currentIndex: number,
  ) => {
    const previousCenterY = textCardDragCenterYRef.current ?? centerY;
    const cardsWithoutDragged = cards
      .filter((card) => card.containerId === container.id && card.id !== draggingId)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    const stackTop =
      container.y +
      CONTAINER_HEADER_HEIGHT +
      CONTAINER_TEXT_CARD_PADDING -
      getContainerScrollOffset(container);
    const slotHeight = CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP;
    let nextIndex = currentIndex;

    if (centerY > previousCenterY + 0.5 && currentIndex < cardsWithoutDragged.length) {
      const nextMidpoint =
        stackTop + (currentIndex + 1) * slotHeight + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2;
      if (centerY > nextMidpoint) {
        nextIndex = currentIndex + 1;
      }
    }

    if (centerY < previousCenterY - 0.5 && currentIndex > 0) {
      const previousMidpoint =
        stackTop + (currentIndex - 1) * slotHeight + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2;
      if (centerY < previousMidpoint) {
        nextIndex = currentIndex - 1;
      }
    }

    textCardDragCenterYRef.current = centerY;
    return nextIndex;
  };

  const getTextCardDropPreviewPosition = () => {
    if (!textCardDropPreview) {
      return null;
    }

    const container = containersById.get(textCardDropPreview.containerId);
    const textCardDragState = dragState?.type === "text-card-move" ? dragState : null;
    const draggedCard = textCardDragState ? textCardsById.get(textCardDragState.id) : null;
    if (!container || !textCardDragState || !draggedCard) {
      return null;
    }

    return {
      x: container.x + CONTAINER_TEXT_CARD_PADDING,
      y:
        container.y +
        CONTAINER_HEADER_HEIGHT +
        CONTAINER_TEXT_CARD_PADDING +
        textCardDropPreview.index * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP) -
        getContainerScrollOffset(container),
      width: Math.min(textCardDragState.width, container.width - CONTAINER_TEXT_CARD_PADDING * 2),
      height: textCardDragState.height,
    };
  };

  const normalizeTextCardOrders = (cards: TextCardElement[]) => {
    const nextCards = cards.map((card) => ({ ...card }));
    const containerIds = Array.from(
      new Set(nextCards.map((card) => card.containerId).filter((id): id is string => Boolean(id))),
    );

    containerIds.forEach((containerId) => {
      nextCards
        .filter((card) => card.containerId === containerId)
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
        .forEach((card, index) => {
          card.order = index;
        });
    });

    return nextCards;
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

  const animateTextCardIn = (id: string) => {
    setEnteringTextCardIds((current) => [...current, id]);
    window.setTimeout(() => {
      setEnteringTextCardIds((current) => current.filter((enteringId) => enteringId !== id));
    }, 180);
  };

  const pulseTextCard = (id: string) => {
    setPulsingTextCardIds((current) => [...current.filter((pulsingId) => pulsingId !== id), id]);
    window.setTimeout(() => {
      setPulsingTextCardIds((current) => current.filter((pulsingId) => pulsingId !== id));
    }, 260);
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

  const removeTextCards = (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    setDeletingTextCardIds((current) => Array.from(new Set([...current, ...ids])));
    setEditingTextCardId((current) => (current && ids.includes(current) ? null : current));
    setTextCardMenu((current) => (current && ids.includes(current.id) ? null : current));
    setSelectedIds((current) => current.filter((selectedId) => !ids.includes(selectedId)));
    window.setTimeout(() => {
      setTextCards((current) => normalizeTextCardOrders(current.filter((card) => !ids.includes(card.id))));
      setDeletingTextCardIds((current) => current.filter((deletingId) => !ids.includes(deletingId)));
      setEnteringTextCardIds((current) => current.filter((enteringId) => !ids.includes(enteringId)));
      setPulsingTextCardIds((current) => current.filter((pulsingId) => !ids.includes(pulsingId)));
    }, 150);
  };


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (event.key === "Tab" && !isEditingText && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();

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
        return;
      }

      if (
        event.key !== "Delete" ||
        isEditingText
      ) {
        return;
      }

      event.preventDefault();
      removeContainers(selectedIds.filter((id) => containersById.has(id)));
      removeTextCards(
        selectedIds.filter((id) => {
          const card = textCardsById.get(id);
          return Boolean(card && !card.containerId);
        }),
      );
      closeContextMenus();
      setRenamingId(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canvasManagerClosing, canvasManagerOpen, containersById, selectedIds, textCardsById]);

  const getLooseTextCardSelectionBounds = (card: TextCardElement) => {
    const estimatedTextWidth = Math.max(44, Math.min(520, card.text.length * 9 + 48));

    return {
      left: card.x,
      top: card.y,
      width: estimatedTextWidth,
      height: CONTAINER_TEXT_CARD_ROW_HEIGHT,
    };
  };

  const rectsOverlap = (
    left: { left: number; top: number; width: number; height: number },
    right: { left: number; top: number; width: number; height: number },
  ) =>
    left.left < right.left + right.width &&
    left.left + left.width > right.left &&
    left.top < right.top + right.height &&
    left.top + left.height > right.top;

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
    ? [
        ...elements
          .filter((element) =>
            rectsOverlap(selectionBounds, {
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
            }),
          )
          .map((element) => element.id),
        ...textCards
          .filter((card) => !card.containerId && rectsOverlap(selectionBounds, getLooseTextCardSelectionBounds(card)))
          .map((card) => card.id),
      ]
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

  const getTextCardAlignmentTargets = (activeId: string, axis: "x" | "y") => [
    ...elements.flatMap((element) =>
      axis === "x"
        ? [
            { value: element.x, kind: "start" as const },
            { value: element.x + element.width, kind: "end" as const },
          ]
        : [
            { value: element.y, kind: "start" as const },
            { value: element.y + element.height, kind: "end" as const },
          ],
    ),
    ...textCards
      .filter((card) => card.id !== activeId && !card.containerId)
      .flatMap((card) => {
        const bounds = getLooseTextCardSelectionBounds(card);
        return axis === "x"
          ? [
              { value: bounds.left, kind: "start" as const },
              { value: bounds.left + bounds.width, kind: "end" as const },
            ]
          : [
              { value: bounds.top, kind: "start" as const },
              { value: bounds.top + bounds.height, kind: "end" as const },
            ];
      }),
  ];

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

  const snapMovedTextCard = (
    activeId: string,
    width: number,
    height: number,
    nextX: number,
    nextY: number,
    pointer: { x: number; y: number },
  ) => {
    const xSnap = findSnapOffset(
      [
        { value: nextX, kind: "start" },
        { value: nextX + width, kind: "end" },
      ],
      getTextCardAlignmentTargets(activeId, "x"),
    );
    const ySnap = findSnapOffset(
      [
        { value: nextY, kind: "start" },
        { value: nextY + height, kind: "end" },
      ],
      getTextCardAlignmentTargets(activeId, "y"),
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
    setEditingTextCardId(null);
    setRenameDraft(nextElement.name);
    setRenamingId(id);
  };

  const createTextCard = (clientX: number, clientY: number) => {
    const point = canvasPointFromEvent({ clientX, clientY });
    const id = `text-card-${Date.now()}`;
    const card: TextCardElement = {
      id,
      text: "Text card",
      x: clamp(point.x, 0, canvasWidth),
      y: clamp(point.y, 0, canvasHeight),
      accent: DEFAULT_TEXT_CARD_ACCENT,
    };

    setTextCards((current) => [...current, card]);
    animateTextCardIn(id);
    setEditingTextCardId(id);
    setTextCardDraft(card.text);
    setSelectedIds([]);
    closeContextMenus();
    setRenamingId(null);
  };

  const createTextCardInContainer = (containerId: string, clientX: number, clientY: number) => {
    const container = containersById.get(containerId);
    if (!container) {
      return;
    }

    const point = canvasPointFromEvent({ clientX, clientY });
    const id = `text-card-${Date.now()}`;
    const order = getTextCardDropIndex(container, point, textCards, id);
    const card: TextCardElement = {
      id,
      text: "Text card",
      x: container.x + CONTAINER_TEXT_CARD_PADDING,
      y:
        container.y +
        CONTAINER_HEADER_HEIGHT +
        CONTAINER_TEXT_CARD_PADDING +
        order * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP),
      accent: DEFAULT_TEXT_CARD_ACCENT,
      containerId,
      order,
    };
    const cardsOutsideContainer = textCards.filter((currentCard) => currentCard.containerId !== containerId);
    const containerCards = getOrderedContainerTextCards(containerId);
    containerCards.splice(order, 0, card);

    setTextCards(
      normalizeTextCardOrders([
        ...cardsOutsideContainer,
        ...containerCards.map((currentCard, index) => ({ ...currentCard, order: index })),
      ]),
    );
    animateTextCardIn(id);
    setEditingTextCardId(id);
    setTextCardDraft(card.text);
    setSelectedIds([]);
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

  const openContainerContentMenu = (event: React.MouseEvent<HTMLElement>, element: ContainerElement) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedIds([element.id]);
    closeContextMenus();
    setRenamingId(null);
    setClosingContainerContentMenu(null);
    setContainerContentMenu({
      containerId: element.id,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  const suppressContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const handleMainPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (renamingId && !target?.closest("[data-container-rename-input]")) {
      saveRename(renamingId);
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
    if (editingTextCardId) {
      saveTextCardEdit(editingTextCardId);
    }
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
      const activeElement = containersById.get(dragState.id);
      const activeTextCardStart = dragState.textCardStartPositions.find(
        (position) => position.id === dragState.id,
      );
      const activePosition = activeStart ?? activeTextCardStart;
      const activeWidth = activeElement?.width ?? dragState.activeWidth;
      const activeHeight = activeElement?.height ?? dragState.activeHeight;

      if (!activePosition) {
        return;
      }

      const nextX = clamp(activePosition.x + worldDeltaX, 0, canvasWidth - activeWidth);
      const nextY = clamp(activePosition.y + worldDeltaY, 0, canvasHeight - activeHeight);
      const snapped = event.shiftKey
        ? activeElement
          ? snapMovedContainer(activeElement, elements, nextX, nextY, pointerPoint)
          : snapMovedTextCard(dragState.id, activeWidth, activeHeight, nextX, nextY, pointerPoint)
        : { x: nextX, y: nextY, guides: [] };
      const appliedDeltaX = clamp(snapped.x, 0, canvasWidth - activeWidth) - activePosition.x;
      const appliedDeltaY = clamp(snapped.y, 0, canvasHeight - activeHeight) - activePosition.y;
      nextGuides = snapped.guides;
      const startPositionsById = new Map(
        dragState.startPositions.map((position) => [position.id, position]),
      );
      const textCardStartPositionsById = new Map(
        dragState.textCardStartPositions.map((position) => [position.id, position]),
      );

      setElements(
        elements.map((element) => {
          const startPosition = startPositionsById.get(element.id);
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
      setTextCards(
        textCards.map((card) => {
          const startPosition = textCardStartPositionsById.get(card.id);
          if (!startPosition) {
            return card;
          }

          return {
            ...card,
            x: clamp(startPosition.x + appliedDeltaX, 0, canvasWidth),
            y: clamp(startPosition.y + appliedDeltaY, 0, canvasHeight),
          };
        }),
      );
      setSnapGuides(event.shiftKey ? nextGuides : []);
      return;
    }

    if (dragState.type === "text-card-move") {
      const dropContainer = getTextCardDropContainer(pointerPoint);
      const draggedCenterPoint = {
        ...pointerPoint,
        y: pointerPoint.y - dragState.pointerOffsetY + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2,
      };
      const currentPreview = textCardDropPreviewRef.current;
      const dropIndex = dropContainer
        ? currentPreview?.containerId === dropContainer.id
          ? getDirectionalTextCardDropIndex(
              dropContainer,
              draggedCenterPoint.y,
              textCards,
              dragState.id,
              currentPreview.index,
            )
          : getTextCardDropIndex(dropContainer, draggedCenterPoint, textCards, dragState.id)
        : null;

      if (!dropContainer || currentPreview?.containerId !== dropContainer.id) {
        textCardDragCenterYRef.current = draggedCenterPoint.y;
      }

      if (dragState.snapping !== event.shiftKey) {
        setDragState({ ...dragState, snapping: event.shiftKey });
      }

      const nextX = clamp(dragState.startX + worldDeltaX, 0, canvasWidth);
      const nextY = clamp(dragState.startY + worldDeltaY, 0, canvasHeight);
      const snapped = event.shiftKey
        ? snapMovedTextCard(dragState.id, dragState.width, dragState.height, nextX, nextY, pointerPoint)
        : { x: nextX, y: nextY, guides: [] };

      setTextCardDetachedContainerId(
        dragState.startContainerId && dropContainer?.id !== dragState.startContainerId
          ? dragState.startContainerId
          : null,
      );
      updateTextCardDropPreview(
        dropContainer && dropIndex !== null
          ? { containerId: dropContainer.id, index: dropIndex }
          : null,
      );
      setTextCards((current) => {
        const draggedCard = current.find((card) => card.id === dragState.id);
        if (!draggedCard) {
          return current;
        }

        return current.map((card) =>
          card.id === dragState.id
            ? {
                ...card,
                x: clamp(snapped.x, 0, canvasWidth),
                y: clamp(snapped.y, 0, canvasHeight),
              }
            : card,
        );
      });
      setSnapGuides(event.shiftKey ? snapped.guides : []);
      return;
    }

    let resizedContainerScrollId: string | null = null;
    let resizedContainerMaxScroll = 0;

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
        const width = clamp(snapped.width, MIN_WIDTH, canvasWidth - element.x);
        const height = clamp(snapped.height, MIN_HEIGHT, canvasHeight - element.y);
        const resizedElement = {
          ...element,
          width,
          height,
        };
        resizedContainerScrollId = resizedElement.id;
        resizedContainerMaxScroll = getContainerMaxScroll(resizedElement);

        return resizedElement;
      }),
    );
    if (resizedContainerScrollId) {
      const containerId = resizedContainerScrollId;
      const maxScroll = resizedContainerMaxScroll;
      setContainerScrollOffsets((current) => ({
        ...current,
        [containerId]: clamp(current[containerId] ?? 0, 0, maxScroll),
      }));
    }
    setSnapGuides(event.shiftKey ? nextGuides : []);
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    if (dragState.type === "text-card-move") {
      const droppedTextCardId = dragState.id;
      const endPoint = canvasPointFromEvent(event);
      const dropContainer = getTextCardDropContainer(endPoint);
      const draggedCenterPoint = {
        ...endPoint,
        y: endPoint.y - dragState.pointerOffsetY + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2,
      };
      const currentPreview = textCardDropPreviewRef.current;

      setTextCards((current) => {
        const draggedCard = current.find((card) => card.id === dragState.id);
        if (!draggedCard) {
          return current;
        }

        if (!dropContainer) {
          return normalizeTextCardOrders(
            current.map((card) =>
              card.id === dragState.id
                ? {
                    ...card,
                    containerId: undefined,
                    order: undefined,
                  }
                : card,
            ),
          );
        }

        const dropIndex =
          currentPreview?.containerId === dropContainer.id
            ? currentPreview.index
            : getTextCardDropIndex(dropContainer, draggedCenterPoint, current, dragState.id);
        const withoutDraggedCard = current
          .filter((card) => card.id !== dragState.id)
          .map((card) => ({ ...card }));
        const targetCards = withoutDraggedCard
          .filter((card) => card.containerId === dropContainer.id)
          .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

        targetCards.splice(dropIndex, 0, {
          ...draggedCard,
          containerId: dropContainer.id,
          order: dropIndex,
        });

        return normalizeTextCardOrders([
          ...withoutDraggedCard.filter((card) => card.containerId !== dropContainer.id),
          ...targetCards.map((card, index) => ({
            ...card,
            containerId: dropContainer.id,
            order: index,
          })),
        ]);
      });
      updateTextCardDropPreview(null);
      setTextCardDetachedContainerId(null);
      textCardDragCenterYRef.current = null;
      setSettlingTextCardId(droppedTextCardId);
      window.setTimeout(() => {
        setSettlingTextCardId((current) => (current === droppedTextCardId ? null : current));
      }, 120);
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
          : [
              ...elements
                .filter((element) =>
                  rectsOverlap(
                    { left, top, width: right - left, height: bottom - top },
                    {
                      left: element.x,
                      top: element.y,
                      width: element.width,
                      height: element.height,
                    },
                  ),
                )
                .map((element) => element.id),
              ...textCards
                .filter((card) =>
                  !card.containerId &&
                  rectsOverlap(
                    { left, top, width: right - left, height: bottom - top },
                    getLooseTextCardSelectionBounds(card),
                  ),
                )
                .map((card) => card.id),
            ],
      );
    }

    setDragState(null);
    updateTextCardDropPreview(null);
    setTextCardDetachedContainerId(null);
    textCardDragCenterYRef.current = null;
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
    const movingContainerIds = movingIds.filter((id) => containersById.has(id));
    const movingTextCardIds = movingIds.filter((id) => {
      const card = textCardsById.get(id);
      return Boolean(card && !card.containerId);
    });
    if (!selectedIds.includes(element.id)) {
      selectContainer(element);
    }
    closeContextMenus();
    setRenamingId(null);
    setDragState({
      type: "move",
      pointerId: event.pointerId,
      id: element.id,
      ids: movingContainerIds,
      activeWidth: element.width,
      activeHeight: element.height,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositions: elements
        .filter((currentElement) => movingContainerIds.includes(currentElement.id))
        .map((currentElement) => ({
          id: currentElement.id,
          x: currentElement.x,
          y: currentElement.y,
        })),
      textCardStartPositions: textCards
        .filter((card) => movingTextCardIds.includes(card.id) && !card.containerId)
        .map((card) => ({
          id: card.id,
          x: card.x,
          y: card.y,
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

  const startTextCardMove = (event: PointerEvent<HTMLElement>, card: TextCardElement) => {
    if (event.button !== 0 || editingTextCardId === card.id) {
      return;
    }

    event.stopPropagation();
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );

    if (!card.containerId && selectedIds.length > 1 && selectedIds.includes(card.id)) {
      const movingIds = selectedIds.includes(card.id) ? selectedIds : [card.id];
      const movingContainerIds = movingIds.filter((id) => containersById.has(id));
      const movingTextCardIds = movingIds.filter((id) => {
        const currentCard = textCardsById.get(id);
        return Boolean(currentCard && !currentCard.containerId);
      });
      const cardRect = event.currentTarget.getBoundingClientRect();

      if (!selectedIds.includes(card.id)) {
        setSelectedIds([card.id]);
      }

      closeContextMenus();
      setRenamingId(null);
      setEditingTextCardId(null);
      setDragState({
        type: "move",
        pointerId: event.pointerId,
        id: card.id,
        ids: movingContainerIds,
        activeWidth: cardRect.width / zoom,
        activeHeight: cardRect.height / zoom,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPositions: elements
          .filter((element) => movingContainerIds.includes(element.id))
          .map((element) => ({
            id: element.id,
            x: element.x,
            y: element.y,
          })),
        textCardStartPositions: textCards
          .filter((currentCard) => movingTextCardIds.includes(currentCard.id) && !currentCard.containerId)
          .map((currentCard) => ({
            id: currentCard.id,
            x: currentCard.x,
            y: currentCard.y,
          })),
      });
      return;
    }

    closeContextMenus();
    setRenamingId(null);
    setEditingTextCardId(null);
    setSelectedIds([]);
    const startPosition = getTextCardStackPosition(card);
    setTextCards((current) =>
      current.map((currentCard) =>
        currentCard.id === card.id
          ? {
              ...currentCard,
              x: startPosition.x,
              y: startPosition.y,
            }
          : currentCard,
      ),
    );
    const pointerPoint = canvasPointFromEvent(event);
    const pointerOffsetY = pointerPoint.y - startPosition.y;
    const cardRect = event.currentTarget.getBoundingClientRect();
    textCardDragCenterYRef.current =
      pointerPoint.y - pointerOffsetY + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2;
    setDragState({
      type: "text-card-move",
      pointerId: event.pointerId,
      id: card.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: startPosition.x,
      startY: startPosition.y,
      startContainerId: card.containerId,
      pointerOffsetY,
      width: cardRect.width / zoom,
      height: cardRect.height / zoom,
      snapping: false,
    });
  };

  const openTextCardMenu = (event: React.MouseEvent<HTMLElement>, card: TextCardElement) => {
    event.preventDefault();
    event.stopPropagation();
    closeContextMenus();
    setRenamingId(null);
    setEditingTextCardId(null);
    setClosingTextCardMenu(null);
    setTextCardMenu({
      id: card.id,
      left: event.clientX + 8,
      top: event.clientY + 8,
    });
  };

  const startTextCardEdit = (card: TextCardElement) => {
    setTextCardDraft(card.text);
    setEditingTextCardId(card.id);
    closeContextMenus();
  };

  const saveTextCardEdit = (id: string) => {
    const nextText = textCardDraft.trim();
    if (nextText) {
      setTextCards((current) =>
        current.map((card) => (card.id === id ? { ...card, text: nextText } : card)),
      );
    }
    setEditingTextCardId(null);
    setTextCardDraft("");
    pulseTextCard(id);
  };

  const cancelTextCardEdit = () => {
    if (editingTextCardId) {
      pulseTextCard(editingTextCardId);
    }
    setEditingTextCardId(null);
    setTextCardDraft("");
  };

  const updateTextCardAccent = (id: string, accent: string) => {
    setTextCards((current) =>
      current.map((card) => (card.id === id ? { ...card, accent } : card)),
    );
  };

  const normalizeTextCardLink = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const url = new URL(withProtocol);
      return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  };

  const updateTextCardLink = (id: string, link: string) => {
    const normalizedLink = normalizeTextCardLink(link);
    setTextCards((current) =>
      current.map((card) =>
        card.id === id
          ? {
              ...card,
              link: normalizedLink,
            }
          : card,
      ),
    );
  };

  const deleteTextCard = (id: string) => {
    removeTextCards([id]);
    closeContextMenus();
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
    setCopiedItem({
      type: "container",
      item: {
        name: element.name,
        width: element.width,
        height: element.height,
        accent: element.accent,
        textCards: getOrderedContainerTextCards(element.id).map((card) => ({
          text: card.text,
          accent: card.accent,
          link: card.link,
          order: card.order,
        })),
      },
    });
    closeContextMenus();
  };

  const copyTextCard = (card: TextCardElement) => {
    setCopiedItem({
      type: "text-card",
      item: {
        text: card.text,
        accent: card.accent,
        link: card.link,
      },
    });
    closeContextMenus();
  };

  const pasteCopiedItem = (clientX: number, clientY: number) => {
    if (!copiedItem) {
      return;
    }

    const point = canvasPointFromEvent({ clientX, clientY });

    if (copiedItem.type === "container") {
      const copiedContainer = copiedItem.item;
      const id = `container-${Date.now()}`;
      const duplicate = {
        ...copiedContainer,
        id,
        name: `${copiedContainer.name} copy`,
        x: clamp(point.x - copiedContainer.width / 2, 0, canvasWidth - copiedContainer.width),
        y: clamp(point.y - 28, 0, canvasHeight - copiedContainer.height),
      };

      setElements((current) => [...current, duplicate]);
      const pastedTextCards = copiedContainer.textCards.map((card, index) => ({
        id: `text-card-${Date.now()}-${index}`,
        text: card.text,
        x: duplicate.x + CONTAINER_TEXT_CARD_PADDING,
        y:
          duplicate.y +
          CONTAINER_HEADER_HEIGHT +
          CONTAINER_TEXT_CARD_PADDING +
          index * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP),
        accent: card.accent,
        link: card.link,
        containerId: id,
        order: card.order ?? index,
      }));

      setTextCards((current) => [...current, ...pastedTextCards]);
      pastedTextCards.forEach((card) => animateTextCardIn(card.id));
      setSelectedIds([id]);
      animateContainerIn(id);
    } else {
      const id = `text-card-${Date.now()}`;
      const duplicate = {
        ...copiedItem.item,
        id,
        x: point.x,
        y: point.y,
      };

      setTextCards((current) => [...current, duplicate]);
      animateTextCardIn(id);
      setSelectedIds([]);
    }

    setCopiedItem(null);
    closeContextMenus();
    setRenamingId(null);
  };

  const requestClearCanvas = () => {
    closeContextMenus();
    setClearModalOpen(true);
  };

  const clearCanvas = () => {
    removeContainers(elements.map((element) => element.id));
    removeTextCards(textCards.map((card) => card.id));
    closeContextMenus();
    setRenamingId(null);
    setEditingTextCardId(null);
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

  const applyAppData = (data: AppData, recordHistory = true, preserveCamera = false) => {
    applyingHistoryRef.current = !recordHistory;
    if (historyTimeoutRef.current) {
      window.clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }

    const normalized = normalizeAppData(data);
    const selectedCanvas =
      normalized.canvases.find((canvas) => canvas.id === normalized.activeCanvasId) ??
      normalized.canvases[0] ??
      DEFAULT_CANVAS;

    setCanvases(normalized.canvases.length ? normalized.canvases : [DEFAULT_CANVAS]);
    setActiveCanvas(selectedCanvas);
    setElements(selectedCanvas.containers);
    setTextCards(selectedCanvas.textCards);
    setPan(preserveCamera ? pan : selectedCanvas.pan);
    setZoom(preserveCamera ? zoom : selectedCanvas.zoom);
    setCanvasGridStyle(normalized.canvasGridStyle);
    setCanvasGridOpacity(normalized.canvasGridOpacity);
    setSelectedIds([]);
    setRenamingId(null);
    setEditingTextCardId(null);
    setCopiedItem(null);
    closeContextMenus();

    if (recordHistory) {
      pushHistorySnapshot(normalized);
    } else {
      window.setTimeout(() => {
        applyingHistoryRef.current = false;
      }, 0);
    }
  };

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) {
      return;
    }

    historyIndexRef.current -= 1;
    applyAppData(cloneAppData(historyRef.current[historyIndexRef.current]), false, true);
    updateHistoryState();
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) {
      return;
    }

    historyIndexRef.current += 1;
    applyAppData(cloneAppData(historyRef.current[historyIndexRef.current]), false, true);
    updateHistoryState();
  }, []);

  useEffect(() => {
    const handleHistoryKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (isEditingText || (!event.ctrlKey && !event.metaKey) || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }

      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleHistoryKeyDown);
    return () => window.removeEventListener("keydown", handleHistoryKeyDown);
  }, [redo, undo]);

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

  const checkForAppUpdate = async (source: UpdateCheckSource = "manual") => {
    try {
      const update = await checkForUpdate();
      pendingUpdateRef.current = update;

      if (!update) {
        setAvailableUpdate(null);

        if (source === "manual") {
          showToast({
            tone: "success",
            title: "TaskMap is up to date",
            message: "You are already running the newest version.",
          });
        }

        return null;
      }

      const info = {
        version: update.version,
        currentVersion: update.currentVersion,
        date: update.date,
        body: update.body,
      };

      setAvailableUpdate(info);
      showToast({
        tone: "info",
        title: "Update available",
        message: `TaskMap ${info.version} is ready to download.`,
        duration: source === "startup" ? 7200 : 5200,
      });

      return info;
    } catch (error) {
      if (source === "manual") {
        showToast({
          tone: "error",
          title: "Update check failed",
          message: error instanceof Error ? error.message : String(error),
          duration: 7000,
        });
      }

      throw error;
    }
  };

  const installAppUpdate = async () => {
    let update = pendingUpdateRef.current;

    if (!update) {
      update = await checkForUpdate();
      pendingUpdateRef.current = update;
    }

    if (!update) {
      setAvailableUpdate(null);
      showToast({
        tone: "warning",
        title: "No update to install",
        message: "Check for updates again before installing.",
      });
      return;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    try {
      showToast({
        tone: "info",
        title: "Installing update",
        message: "Saving your data before downloading the update.",
        duration: 3600,
      });

      await persistAppData(getCurrentAppData());
      await update.downloadAndInstall();
      showToast({
        tone: "success",
        title: "Update installed",
        message: "Restarting TaskMap to finish applying it.",
        duration: 2400,
      });
      await relaunch();
    } catch (error) {
      showToast({
        tone: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : String(error),
        duration: 7000,
      });
      throw error;
    }
  };

  useEffect(() => {
    if (!appDataLoaded || autoUpdateCheckRef.current) {
      return;
    }

    autoUpdateCheckRef.current = true;

    checkForAppUpdate("startup").catch((error) => {
      console.error("Automatic update check failed", error);
    });
  }, [appDataLoaded]);

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
      textCards: [],
      pan: DEFAULT_PAN,
      zoom: 1,
      previewViewport: {
        width: stageRef.current?.clientWidth ?? window.innerWidth,
        height: stageRef.current?.clientHeight ?? window.innerHeight,
      },
    };

    setCanvases([...currentCanvases, canvas]);
    setActiveCanvas(canvas);
    setElements([]);
    setTextCards([]);
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
    setTextCards(nextCanvas.textCards);
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
      setTextCards((current) =>
        current.map((card) => ({
          ...card,
          x: clamp(card.x, 0, width),
          y: clamp(card.y, 0, height),
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
      setTextCards(nextActiveCanvas.textCards);
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
    ? containersById.get(containerMenu.id)
    : null;
  const closingContextMenuElement = closingContainerMenu
    ? containersById.get(closingContainerMenu.id)
    : null;
  const textCardContextElement = textCardMenu
    ? textCardsById.get(textCardMenu.id)
    : null;
  const closingTextCardContextElement = closingTextCardMenu
    ? textCardsById.get(closingTextCardMenu.id)
    : null;
  const textCardDropPreviewPosition = getTextCardDropPreviewPosition();
  const dotGridOpacityScale = clamp((zoom - 0.55) / 0.45, 0, 1);

  return (
    <main
      data-theme="taskmap"
      spellCheck={false}
      className="h-full w-full bg-[color:var(--void-bg)] text-white"
      onContextMenu={suppressContextMenu}
      onPointerDownCapture={handleMainPointerDownCapture}
    >
      <div className="h-full">
        <section className="relative h-full overflow-hidden">
          <FloatingToolbar
            canRedo={historyState.canRedo}
            canUndo={historyState.canUndo}
            onRedo={redo}
            onToggleCanvases={toggleCanvasManager}
            onUndo={undo}
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
              {elements.map((element) => {
                const containedCards = (
                  orderedTextCardsByContainerId.get(element.id) ?? []
                ).filter(
                  (card) =>
                    !(dragState?.type === "text-card-move" && dragState.id === card.id) &&
                    card.id !== settlingTextCardId,
                );
                const relativeDropPreview =
                  textCardDropPreview?.containerId === element.id && textCardDropPreviewPosition
                    ? toContainerRelativePosition(textCardDropPreviewPosition, element)
                    : null;
                const scrollOffset = getContainerScrollOffset(element);
                const containerMultiSelected = selectedIds.length > 1 && selectedIds.includes(element.id);

                return (
                  <ContainerNode
                    key={element.id}
                    element={element}
                    selected={outlinedIds.includes(element.id)}
                    multiSelected={containerMultiSelected}
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
                    onOpenContentMenu={openContainerContentMenu}
                    onWheelContent={handleContainerWheel}
                  >
                    {relativeDropPreview && (
                      <div
                        className="pointer-events-none absolute z-20 hidden"
                        style={{
                          left: relativeDropPreview.x,
                          top: relativeDropPreview.y,
                          width: relativeDropPreview.width,
                          height: relativeDropPreview.height,
                        }}
                      />
                    )}
                    {containedCards.map((card) => {
                      const position = {
                        ...toContainerRelativePosition(getTextCardRenderPosition(card) ?? card, element),
                        maxWidth: Math.max(120, element.width - CONTAINER_TEXT_CARD_PADDING * 2),
                      };

                      return (
                        <TextCardNode
                          key={card.id}
                          card={card}
                          editing={editingTextCardId === card.id}
                          draft={textCardDraft}
                          position={position}
                          entering={enteringTextCardIds.includes(card.id)}
                          deleting={deletingTextCardIds.includes(card.id)}
                          pulsing={pulsingTextCardIds.includes(card.id)}
                          moving={dragState?.type === "move" && selectedIds.includes(card.id)}
                          settling={settlingTextCardId === card.id}
                          selected={outlinedIds.includes(card.id)}
                          interactionDisabled={containerMultiSelected}
                          linksDisabled={selectedIds.length > 1}
                          onDraftChange={setTextCardDraft}
                          onSave={saveTextCardEdit}
                          onCancel={cancelTextCardEdit}
                          onStartMove={startTextCardMove}
                          onOpenMenu={openTextCardMenu}
                        />
                      );
                    })}
                  </ContainerNode>
                );
              })}
              {renderedLooseTextCards.map((card) => {
                const draggingTextCard = dragState?.type === "text-card-move" && dragState.id === card.id;
                const textCardSnapping = dragState?.type === "text-card-move" && dragState.snapping;
                const settlingTextCard = settlingTextCardId === card.id;
                const position = draggingTextCard
                  ? { x: card.x, y: card.y }
                  : settlingTextCard && card.containerId
                    ? getTextCardRenderPosition(card)
                    : undefined;

                return (
                  <TextCardNode
                    key={card.id}
                    card={card}
                    editing={editingTextCardId === card.id}
                    draft={textCardDraft}
                    position={position}
                    entering={enteringTextCardIds.includes(card.id)}
                    deleting={deletingTextCardIds.includes(card.id)}
                    pulsing={pulsingTextCardIds.includes(card.id)}
                    dragging={draggingTextCard && !textCardSnapping}
                    moving={dragState?.type === "move" && selectedIds.includes(card.id)}
                    settling={settlingTextCardId === card.id}
                    selected={outlinedIds.includes(card.id)}
                    linksDisabled={selectedIds.length > 1}
                    onDraftChange={setTextCardDraft}
                    onSave={saveTextCardEdit}
                    onCancel={cancelTextCardEdit}
                    onStartMove={startTextCardMove}
                    onOpenMenu={openTextCardMenu}
                  />
                );
              })}
              {selectionBounds && (
                <div
                  className="pointer-events-none absolute z-30 rounded-md border border-dashed border-white/45 bg-white/[0.08] shadow-[0_0_0_1px_rgba(0,0,0,0.22)]"
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

          {containerContentMenu && (
            <ContainerContentContextMenu
              key={`${containerContentMenu.containerId}-${containerContentMenu.clientX}-${containerContentMenu.clientY}`}
              menu={containerContentMenu}
              closing={false}
              onCreateTextCard={createTextCardInContainer}
            />
          )}

          {closingContainerContentMenu && (
            <ContainerContentContextMenu
              key={`closing-${closingContainerContentMenu.containerId}-${closingContainerContentMenu.clientX}-${closingContainerContentMenu.clientY}`}
              menu={closingContainerContentMenu}
              closing
              onCreateTextCard={createTextCardInContainer}
            />
          )}

          {textCardMenu && textCardContextElement && (
            <TextCardContextMenu
              key={`${textCardMenu.id}-${textCardMenu.left}-${textCardMenu.top}`}
              menu={textCardMenu}
              card={textCardContextElement}
              closing={false}
              onStartEdit={startTextCardEdit}
              onUpdateAccent={updateTextCardAccent}
              onUpdateLink={updateTextCardLink}
              onCopy={copyTextCard}
              onDelete={deleteTextCard}
            />
          )}

          {closingTextCardMenu && closingTextCardContextElement && (
            <TextCardContextMenu
              key={`closing-${closingTextCardMenu.id}-${closingTextCardMenu.left}-${closingTextCardMenu.top}`}
              menu={closingTextCardMenu}
              card={closingTextCardContextElement}
              closing
              onStartEdit={startTextCardEdit}
              onUpdateAccent={updateTextCardAccent}
              onUpdateLink={updateTextCardLink}
              onCopy={copyTextCard}
              onDelete={deleteTextCard}
            />
          )}

          {canvasMenu && (
            <CanvasContextMenu
              key={`${canvasMenu.clientX}-${canvasMenu.clientY}`}
              menu={canvasMenu}
              hasCopiedItem={Boolean(copiedItem)}
              closing={false}
              onPaste={pasteCopiedItem}
              onCreate={createContainer}
              onCreateTextCard={createTextCard}
              onClear={requestClearCanvas}
            />
          )}

          {closingCanvasMenu && (
            <CanvasContextMenu
              key={`closing-${closingCanvasMenu.clientX}-${closingCanvasMenu.clientY}`}
              menu={closingCanvasMenu}
              hasCopiedItem={Boolean(copiedItem)}
              closing
              onPaste={pasteCopiedItem}
              onCreate={createContainer}
              onCreateTextCard={createTextCard}
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
              availableUpdate={availableUpdate}
              appVersion={appVersion}
              onCheckForUpdate={checkForAppUpdate}
              onInstallUpdate={installAppUpdate}
              onClose={() => setSettingsOpen(false)}
            />
          )}

          {storageError && (
            <div className="fixed bottom-4 right-4 z-50 max-w-[420px] rounded-lg border border-red-300/25 bg-[#281b1d]/95 p-3 text-sm text-red-100 shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
              <div className="mb-1 font-semibold">Storage error</div>
              <div className="text-red-100/75">{storageError}</div>
              {(storageError.includes("database key no longer matches") ||
                storageError.includes("no database key was found")) && (
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

          <ToastStack toasts={toasts} onDismiss={dismissToast} />

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
