import { CSSProperties, PointerEvent, WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  IconColorPicker,
  IconRotateClockwise,
} from "@tabler/icons-react";
import { CanvasManager } from "./components/CanvasManager";
import {
  CanvasContextMenu,
  ContainerContentContextMenu,
  ContainerContextMenu,
  ImageContextMenu,
  TextBlockContextMenu,
  TextCardContextMenu,
} from "./components/ContextMenus";
import { ContainerNode } from "./components/ContainerNode";
import {
  ExtensionsPanel,
  QuickExtensionsMenu,
  type ExtensionId,
} from "./components/ExtensionsPanel";
import { FloatingToolbar } from "./components/FloatingToolbar";
import { FrostedGlassTuner, FrostedGlassValues, LeftPanelCardValues } from "./components/FrostedGlassTuner";
import { ExtensionDropEffect } from "./components/ExtensionDropEffect";
import { ImageNode } from "./components/ImageNode";
import { Minimap } from "./components/Minimap";
import { ClearCanvasModal, SettingsModal, UpdateAvailableModal } from "./components/Modals";
import { TextCardNode } from "./components/TextCardNode";
import { TextBlockNode } from "./components/TextBlockNode";
import { ToastStack } from "./components/ToastStack";
import {
  CANVAS_WIDTH,
  ALIGN_SNAP_DISTANCE,
  ALL_ACCENT_PRESETS,
  DEFAULT_CONTAINER_ACCENT,
  DEFAULT_TEXT_CARD_ACCENT,
  MIN_HEIGHT,
  MIN_IMAGE_SIZE,
  MIN_WIDTH,
  MINIMAP_MAX_SIZE,
} from "./constants";
import { clamp, getWheelZoom, quantizeZoom } from "./canvasMath";
import {
  AppData,
  CanvasGridStyle,
  ContainerElement,
  ContainerMenuState,
  CopiedCanvasItem,
  DragState,
  ElementExtensions,
  ImageElement,
  ImageMeta,
  TaskCanvas,
  TextBlockElement,
  TextCardElement,
  ToastMessage,
} from "./types";
import {
  cloneExtensions,
  getLocalDateKey,
  normalizeAppData,
  remapContainerExtensions,
} from "./app/appData";
import {
  DEFAULT_CANVAS,
  DEFAULT_ELEMENTS,
  DEFAULT_GRID_OPACITY,
  DEFAULT_PAN,
} from "./app/defaultData";
import { useFrameStats } from "./hooks/useFrameStats";
import { useAutosave } from "./hooks/useAutosave";
import { useDiscordRpc } from "./hooks/useDiscordRpc";
import { useImageCache } from "./hooks/useImageCache";
import { useAppUpdates } from "./hooks/useAppUpdates";
import {
  EXTENSION_COMPATIBLE_TARGETS,
  EXTENSION_DROP_ICONS,
  ExtensionTargetType,
} from "./components/extensionMetadata";
import {
  cloneCanvas,
  createInitialCanvasHistory,
  getCanvasHistoryState,
  HISTORY_DEBOUNCE_MS,
  omitCameraFromHistory,
  pushCanvasHistorySnapshot,
} from "./app/history";

type SnapGuide = {
  axis: "x" | "y";
  position: number;
  pointerPosition: number;
};

type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

type ExtensionDropRipple = {
  id: string;
  extensionId: ExtensionId;
  target:
    | { type: "container"; id: string }
    | { type: "text-block"; id: string }
    | { type: "text-card"; id: string }
    | { type: "image"; id: string };
  offsetX: number;
  offsetY: number;
  bounds: ExtensionRippleBounds;
};

type ExtensionRippleBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomRightRadius?: number;
  borderBottomLeftRadius?: number;
};

type TextCardReleaseAnimation = {
  active: boolean;
  cards: Array<{
    card: TextCardElement;
    from: { x: number; y: number };
    to: { x: number; y: number };
  }>;
};

type LeftPanelState = "closed" | "canvases" | "extensions";

const CANVAS_MANAGER_ANIMATION_MS = 120;
const CANVAS_CYCLE_PANEL_RESTORE_DELAY_MS = 280;

const isEditableKeyboardTarget = (target: HTMLElement | null) =>
  target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

const isKeyboardFocusableControl = (target: HTMLElement | null) =>
  Boolean(target?.closest("button, [role='button'], a, select, [tabindex]"));
const CONTAINER_HEADER_HEIGHT = 48;
const CONTAINER_SEARCH_HEIGHT = 42;
const CONTAINER_TEXT_CARD_PADDING = 17;
const CONTAINER_TEXT_CARD_ROW_HEIGHT = 43;
const CONTAINER_TEXT_CARD_GAP = 8;
const DEFAULT_FROSTED_GLASS_VALUES: FrostedGlassValues = {
  bgOpacity: 0,
  bgBrightness: 0,
  borderOpacity: 0.16,
  blur: 4,
  shadowOpacity: 0.55,
  shadowY: 10,
  shadowBlur: 32,
};
const DEFAULT_LEFT_PANEL_CARD_VALUES: LeftPanelCardValues = {
  bgOpacity: 1,
  outlineOpacity: 0.13,
};

const getWindowPreviewViewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const lastPointerPositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const panelSwitchTimeoutRef = useRef<number | null>(null);
  const canvasCycleRestoreTimeoutRef = useRef<number | null>(null);
  const minimapTimeoutRef = useRef<number | null>(null);
  const canvasCycleSessionRef = useRef<{
    order: string[];
    index: number;
    previousPanelState: LeftPanelState;
  } | null>(null);
  const textCardDropPreviewRef = useRef<{ containerId: string; index: number } | null>(null);
  const textCardDragCenterYRef = useRef<number | null>(null);
  const historyRef = useRef<Record<string, TaskCanvas[]>>({});
  const historyIndexRef = useRef<Record<string, number>>({});
  const historyTimeoutRef = useRef<number | null>(null);
  const applyingHistoryRef = useRef(false);
  const latestAppDataRef = useRef<AppData>({
    activeCanvasId: DEFAULT_CANVAS.id,
    canvases: [DEFAULT_CANVAS],
    canvasGridStyle: "dots",
    canvasGridOpacity: DEFAULT_GRID_OPACITY,
    discordRpcEnabled: false,
    privacyModeEnabled: false,
  });
  const appDataLoadedRef = useRef(false);
  const [appDataLoaded, setAppDataLoaded] = useState(false);
  const [pan, setPan] = useState(DEFAULT_PAN);
  const [zoom, setZoom] = useState(1);
  const latestCameraRef = useRef({ pan: DEFAULT_PAN, zoom: 1 });
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
  const [textBlockMenu, setTextBlockMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const [closingTextBlockMenu, setClosingTextBlockMenu] =
    useState<{ id: string; left: number; top: number } | null>(null);
  const [imageMenu, setImageMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const [closingImageMenu, setClosingImageMenu] =
    useState<{ id: string; left: number; top: number } | null>(null);
  const [canvasMenu, setCanvasMenu] = useState<{ clientX: number; clientY: number } | null>(null);
  const [closingCanvasMenu, setClosingCanvasMenu] = useState<{ clientX: number; clientY: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [editingTextCardId, setEditingTextCardId] = useState<string | null>(null);
  const [textCardDraft, setTextCardDraft] = useState("");
  const [editingTextBlockId, setEditingTextBlockId] = useState<string | null>(null);
  const [textBlockDraft, setTextBlockDraft] = useState("");
  const [copiedItem, setCopiedItem] = useState<CopiedCanvasItem | null>(null);
  const [canvasGridStyle, setCanvasGridStyle] = useState<CanvasGridStyle>("dots");
  const [canvasGridOpacity, setCanvasGridOpacity] =
    useState<Record<CanvasGridStyle, number>>(DEFAULT_GRID_OPACITY);
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(false);
  const [privacyModeEnabled, setPrivacyModeEnabled] = useState(false);
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string | undefined>(undefined);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fpsCounterVisible, setFpsCounterVisible] = useState(false);
  const [temporaryPanelsVisible, setTemporaryPanelsVisible] = useState(false);
  const frameStats = useFrameStats();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [canvasManagerOpen, setCanvasManagerOpen] = useState(false);
  const [canvasManagerClosing, setCanvasManagerClosing] = useState(false);
  const [canvasManagerMinimalView, setCanvasManagerMinimalView] = useState(false);
  const [canvasCycleHighlightId, setCanvasCycleHighlightId] = useState<string | null>(null);
  const [extensionsOpen, setExtensionsOpen] = useState(false);
  const [extensionsClosing, setExtensionsClosing] = useState(false);
  const [quickExtensionsMenu, setQuickExtensionsMenu] =
    useState<{ left: number; top: number } | null>(null);
  const [frostedGlassValues, setFrostedGlassValues] = useState(DEFAULT_FROSTED_GLASS_VALUES);
  const [leftPanelCardValues, setLeftPanelCardValues] = useState(DEFAULT_LEFT_PANEL_CARD_VALUES);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [enteringIds, setEnteringIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [enteringTextCardIds, setEnteringTextCardIds] = useState<string[]>([]);
  const [deletingTextCardIds, setDeletingTextCardIds] = useState<string[]>([]);
  const [pulsingTextCardIds, setPulsingTextCardIds] = useState<string[]>([]);
  const [glowingTextCardIds, setGlowingTextCardIds] = useState<string[]>([]);
  const [enteringImageIds, setEnteringImageIds] = useState<string[]>([]);
  const [deletingImageIds, setDeletingImageIds] = useState<string[]>([]);
  const [loadingImageIds, setLoadingImageIds] = useState<string[]>([]);
  const [enteringTextBlockIds, setEnteringTextBlockIds] = useState<string[]>([]);
  const [deletingTextBlockIds, setDeletingTextBlockIds] = useState<string[]>([]);
  const [pulsingTextBlockIds, setPulsingTextBlockIds] = useState<string[]>([]);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [extensionDropRipples, setExtensionDropRipples] = useState<ExtensionDropRipple[]>([]);
  const [activeCanvas, setActiveCanvas] = useState<TaskCanvas>(DEFAULT_CANVAS);
  const [canvases, setCanvases] = useState<TaskCanvas[]>([DEFAULT_CANVAS]);
  const [elements, setElements] = useState<ContainerElement[]>(DEFAULT_ELEMENTS);
  const [textCards, setTextCards] = useState<TextCardElement[]>([]);
  const [textBlocks, setTextBlocks] = useState<TextBlockElement[]>([]);
  const [images, setImages] = useState<ImageElement[]>([]);
  const [textCardDropPreview, setTextCardDropPreview] =
    useState<{ containerId: string; index: number } | null>(null);

  useEffect(() => {
    const resetDailyCheckboxes = () => {
      const today = getLocalDateKey();
      const dueContainerIds = elements
        .filter(
          (element) =>
            element.extensions?.dailyReset &&
            element.extensions.dailyReset.lastResetDate !== today,
        )
        .map((element) => element.id);
      if (dueContainerIds.length === 0) {
        return;
      }

      const dueContainerIdSet = new Set(dueContainerIds);
      setElements((current) =>
        current.map((element) =>
          dueContainerIdSet.has(element.id) && element.extensions?.dailyReset
            ? {
                ...element,
                extensions: {
                  ...element.extensions,
                  dailyReset: { lastResetDate: today },
                },
              }
            : element,
        ),
      );
      setTextCards((current) =>
        current.map((card) =>
          card.containerId &&
          dueContainerIdSet.has(card.containerId) &&
          card.extensions?.checkbox?.checked
            ? {
                ...card,
                extensions: {
                  ...card.extensions,
                  checkbox: { checked: false },
                },
              }
            : card,
        ),
      );
    };

    resetDailyCheckboxes();
    const interval = window.setInterval(resetDailyCheckboxes, 60_000);
    return () => window.clearInterval(interval);
  }, [elements]);
  const [textCardDetachedContainerId, setTextCardDetachedContainerId] = useState<string | null>(null);
  const [settlingTextCardIds, setSettlingTextCardIds] = useState<string[]>([]);
  const [textCardReleaseAnimation, setTextCardReleaseAnimation] =
    useState<TextCardReleaseAnimation | null>(null);
  const [containerScrollOffsets, setContainerScrollOffsets] = useState<Record<string, number>>({});
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [colorPickerTargetId, setColorPickerTargetId] = useState<string | null>(null);
  const [colorPickerPreview, setColorPickerPreview] = useState<{
    clientX: number;
    clientY: number;
    color: string;
  } | null>(null);
  const containersById = useMemo(
    () => new Map(elements.map((element) => [element.id, element])),
    [elements],
  );
  const textCardsById = useMemo(
    () => new Map(textCards.map((card) => [card.id, card])),
    [textCards],
  );
  const textBlocksById = useMemo(
    () => new Map(textBlocks.map((element) => [element.id, element])),
    [textBlocks],
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
  const imagesById = useMemo(
    () => new Map(images.map((image) => [image.id, image])),
    [images],
  );
  const looseImages = useMemo(
    () => images.filter((image) => !image.containerId),
    [images],
  );
  const renderedLooseTextCards = useMemo(() => {
    const extraCards: TextCardElement[] = [];

    if (dragState?.type === "text-card-move") {
      dragState.ids.forEach((id) => {
        const draggedCard = textCardsById.get(id);
        if (draggedCard?.containerId) {
          extraCards.push(draggedCard);
        }
      });
    }

    return extraCards.length ? [...looseTextCards, ...extraCards] : looseTextCards;
  }, [dragState, looseTextCards, textCardsById]);

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

  const { imageUrlVersion, getImageUrl, storeImageFromBytes } = useImageCache({
    onStoreError: (error) => {
      showToast({ tone: "error", title: "Could not add image", message: String(error) });
    },
  });
  // Latest image drop/paste handlers, refreshed each render so the once-mounted
  // OS drag-drop and clipboard listeners never call stale closures.
  const imageDropOpsRef = useRef<{
    canvasPointFromEvent: (event: { clientX: number; clientY: number }) => { x: number; y: number };
    looseImages: ImageElement[];
    fillElementFromPath: (id: string, path: string) => void;
    importImageFromPath: (path: string, clientX: number, clientY: number, offset?: number) => void;
    addImageFromBuffer: (buffer: ArrayBuffer, clientX: number, clientY: number) => void;
  } | null>(null);

  const collectAllImageIds = (data: AppData): string[] => {
    const ids = new Set<string>();
    data.canvases.forEach((canvas) => {
      (canvas.images ?? []).forEach((image) => {
        if (image.imageId) {
          ids.add(image.imageId);
        }
      });
    });
    return Array.from(ids);
  };

  const collectImageGarbage = (data: AppData) => {
    invoke("gc_images", { used: collectAllImageIds(data) }).catch((error) => {
      console.error("Image garbage collection failed", error);
    });
  };

  const clampCanvasSize = (value: number) => clamp(Number.isFinite(value) ? value : CANVAS_WIDTH, 600, 10000);

  const getActiveCanvasSnapshot = (): TaskCanvas => ({
    ...activeCanvas,
    containers: elements,
    textCards,
    textBlocks,
    images,
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
    discordRpcEnabled,
    privacyModeEnabled,
    dismissedUpdateVersion,
  });

  const updateHistoryState = (canvasId = activeCanvas.id) => {
    setHistoryState(getCanvasHistoryState(historyRef.current, historyIndexRef.current, canvasId));
  };

  const pushHistorySnapshot = (data: AppData) => {
    const nextHistory = pushCanvasHistorySnapshot(historyRef.current, historyIndexRef.current, data);
    if (!nextHistory) {
      return;
    }

    historyRef.current = nextHistory.historyByCanvasId;
    historyIndexRef.current = nextHistory.historyIndexByCanvasId;
    updateHistoryState(nextHistory.canvasId);
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
          const normalized = normalizeAppData(data, getWindowPreviewViewport);
          const selectedCanvas =
            normalized.canvases.find((canvas) => canvas.id === normalized.activeCanvasId) ??
            normalized.canvases[0] ??
            DEFAULT_CANVAS;

          latestAppDataRef.current = normalized;
          setCanvases(normalized.canvases.length ? normalized.canvases : [DEFAULT_CANVAS]);
          setActiveCanvas(selectedCanvas);
          setElements(selectedCanvas.containers);
          setTextCards(selectedCanvas.textCards);
          setTextBlocks(selectedCanvas.textBlocks ?? []);
          setImages(selectedCanvas.images ?? []);
          setPan(selectedCanvas.pan);
          setZoom(selectedCanvas.zoom);
          setCanvasGridStyle(normalized.canvasGridStyle);
          setCanvasGridOpacity(normalized.canvasGridOpacity);
          setDiscordRpcEnabled(normalized.discordRpcEnabled);
          setPrivacyModeEnabled(normalized.privacyModeEnabled);
          setDismissedUpdateVersion(normalized.dismissedUpdateVersion);
          const initialHistory = createInitialCanvasHistory(normalized.canvases);
          historyRef.current = initialHistory.historyByCanvasId;
          historyIndexRef.current = initialHistory.historyIndexByCanvasId;
          updateHistoryState(selectedCanvas.id);
        } else {
          const initialHistory = createInitialCanvasHistory([DEFAULT_CANVAS]);
          historyRef.current = initialHistory.historyByCanvasId;
          historyIndexRef.current = initialHistory.historyIndexByCanvasId;
          updateHistoryState(DEFAULT_CANVAS.id);
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
  }, [
    activeCanvas,
    canvasGridOpacity,
    canvasGridStyle,
    canvases,
    dismissedUpdateVersion,
    discordRpcEnabled,
    elements,
    images,
    pan,
    privacyModeEnabled,
    textBlocks,
    textCards,
    zoom,
  ]);

  useEffect(() => {
    latestCameraRef.current = { pan, zoom };
  }, [pan, zoom]);

  useEffect(() => {
    const activeHistory = historyRef.current[activeCanvas.id];
    if (!activeHistory) {
      const snapshot = omitCameraFromHistory(cloneCanvas(getActiveCanvasSnapshot()));
      historyRef.current = {
        ...historyRef.current,
        [activeCanvas.id]: [snapshot],
      };
      historyIndexRef.current = {
        ...historyIndexRef.current,
        [activeCanvas.id]: 0,
      };
    }

    updateHistoryState(activeCanvas.id);
  }, [activeCanvas.id]);

  const cancelAutosave = useAutosave({
    enabled: appDataLoaded,
    dataRef: latestAppDataRef,
    dependencies: [
      activeCanvas,
      canvasGridOpacity,
      canvasGridStyle,
      canvases,
      discordRpcEnabled,
      dismissedUpdateVersion,
      elements,
      images,
      pan,
      privacyModeEnabled,
      textBlocks,
      textCards,
      zoom,
    ],
    save: persistAppData,
    onSaved: () => {
      setStorageError(null);
      collectImageGarbage(latestAppDataRef.current);
    },
    onError: (error) => {
      const message = `Failed to save app data: ${String(error)}`;
      setStorageError(message);
      console.error(message);
    },
  });

  useDiscordRpc({
    appDataLoaded,
    discordRpcEnabled,
    canvasName: activeCanvas.name,
  });

  useEffect(() => {
    if (!appDataLoaded) {
      return;
    }

    let cancelled = false;

    getCurrentWindow().setContentProtected(privacyModeEnabled).catch((error) => {
      if (cancelled) {
        return;
      }

      if (privacyModeEnabled) {
        setPrivacyModeEnabled(false);
      }
      showToast({
        tone: "error",
        title: "Privacy mode unavailable",
        message: String(error),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [appDataLoaded, privacyModeEnabled, showToast]);

  const {
    appVersion,
    availableUpdate,
    updateModalOpen,
    checkForAppUpdate,
    installAppUpdate,
    dismissUpdateModal,
  } = useAppUpdates({
    appDataLoaded,
    dismissedUpdateVersion,
    onDismissUpdateVersion: setDismissedUpdateVersion,
    cancelAutosave,
    saveCurrentData: () => persistAppData(getCurrentAppData()),
    showToast,
  });

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
    setTextBlockMenu((current) => {
      if (current) {
        setClosingTextBlockMenu(current);
        window.setTimeout(() => setClosingTextBlockMenu(null), 110);
      }

      return null;
    });
    setImageMenu((current) => {
      if (current) {
        setClosingImageMenu(current);
        window.setTimeout(() => setClosingImageMenu(null), 110);
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

  const getContainerSearchQuery = (container: ContainerElement) =>
    container.extensions?.search?.query.trim().toLowerCase() ?? "";

  const getContainerVisibleTextCards = (container: ContainerElement, cards = textCards) => {
    const orderedCards = getOrderedContainerTextCards(container.id, cards);
    const query = getContainerSearchQuery(container);
    const searchedCards = query
      ? orderedCards.filter((card) => card.text.toLowerCase().includes(query))
      : orderedCards;
    const selectedCardId = container.extensions?.pickCard?.selectedCardId;
    const filtered = selectedCardId
      ? searchedCards.filter((card) => card.id === selectedCardId)
      : searchedCards;

    // Match the render pipeline exactly (filter, then sort) so a card's index
    // in this list is the same slot it visually occupies. Drag math relies on
    // this — using the unfiltered/unsorted order makes a card snap to the wrong
    // slot the instant it is grabbed (notably with the search extension).
    return getSortedContainerTextCards(container, filtered);
  };

  const getAlphabetSortKey = (text: string) => text.replace(/[*_]/g, "").trim().toLocaleLowerCase();

  const getSortGroup = (value: string) => (/^[a-z]/i.test(value) ? 0 : 1);

  const getSortedContainerTextCards = (container: ContainerElement, cards: TextCardElement[]) => {
    const sorting = container.extensions?.sorting;
    if (!sorting?.mode) {
      return cards;
    }

    return [...cards].sort((left, right) => {
      const leftValue = sorting.mode === "alphabet" ? getAlphabetSortKey(left.text) : left.accent.toLocaleLowerCase();
      const rightValue = sorting.mode === "alphabet" ? getAlphabetSortKey(right.text) : right.accent.toLocaleLowerCase();
      const groupDifference =
        sorting.mode === "alphabet" ? getSortGroup(leftValue) - getSortGroup(rightValue) : 0;
      const valueDifference = leftValue.localeCompare(rightValue);
      const stableDifference = (left.order ?? 0) - (right.order ?? 0);
      const direction = sorting.direction === "asc" ? 1 : -1;

      return groupDifference || (valueDifference || stableDifference) * direction;
    });
  };

  const getContainerViewportHeight = (container: ContainerElement) =>
    Math.max(
      0,
      container.height -
        CONTAINER_HEADER_HEIGHT -
        (container.extensions?.search ? CONTAINER_SEARCH_HEIGHT : 0),
    );

  const getContainerContentHeight = (container: ContainerElement, cards = textCards) => {
    const cardCount = getContainerVisibleTextCards(container, cards).length;

    if (cardCount === 0) {
      return CONTAINER_TEXT_CARD_PADDING * 2;
    }

    return (
      CONTAINER_TEXT_CARD_PADDING * 2 +
      cardCount * CONTAINER_TEXT_CARD_ROW_HEIGHT +
      (cardCount - 1) * CONTAINER_TEXT_CARD_GAP
    );
  };

  const getContainerMaxScroll = (container: ContainerElement, cards = textCards) =>
    Math.max(0, getContainerContentHeight(container, cards) - getContainerViewportHeight(container));

  const getContainerScrollOffset = (container: ContainerElement) =>
    clamp(containerScrollOffsets[container.id] ?? 0, 0, getContainerMaxScroll(container));

  const getScrollOffsetForVisibleCardIndex = (
    container: ContainerElement,
    visibleIndex: number,
    cards: TextCardElement[],
  ) => {
    const currentOffset = getContainerScrollOffset(container);
    const viewportHeight = getContainerViewportHeight(container);
    const maxScroll = getContainerMaxScroll(container, cards);
    const slotTop = CONTAINER_TEXT_CARD_PADDING + visibleIndex * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP);
    const slotBottom = slotTop + CONTAINER_TEXT_CARD_ROW_HEIGHT;
    const visibleTop = currentOffset + CONTAINER_TEXT_CARD_PADDING;
    const visibleBottom = currentOffset + viewportHeight - CONTAINER_TEXT_CARD_PADDING;

    if (slotBottom > visibleBottom) {
      return clamp(slotBottom - viewportHeight + CONTAINER_TEXT_CARD_PADDING, 0, maxScroll);
    }

    if (slotTop < visibleTop) {
      return clamp(slotTop - CONTAINER_TEXT_CARD_PADDING, 0, maxScroll);
    }

    return currentOffset;
  };

  const getContainerCardStackTop = (container: ContainerElement) =>
    container.y +
    CONTAINER_HEADER_HEIGHT +
    (container.extensions?.search ? CONTAINER_SEARCH_HEIGHT : 0) +
    CONTAINER_TEXT_CARD_PADDING;

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

  const isElementVisible = (element: ContainerElement | TextBlockElement) => {
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

    const visibleCards = getContainerVisibleTextCards(container, cards);
    const index = Math.max(
      visibleCards.findIndex((currentCard) => currentCard.id === card.id),
      0,
    );

    return {
      x: container.x + CONTAINER_TEXT_CARD_PADDING,
      y:
        getContainerCardStackTop(container) +
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

    const draggingTextCard = dragState?.type === "text-card-move" && dragState.ids.includes(card.id);
    if (draggingTextCard) {
      return { x: card.x, y: card.y };
    }

    const container = containersById.get(card.containerId);
    if (!container) {
      return { x: card.x, y: card.y };
    }

    const draggedIds = dragState?.type === "text-card-move" ? new Set(dragState.ids) : null;
    const previewingThisContainer = textCardDropPreview?.containerId === container.id;
    const detachedFromThisContainer = textCardDetachedContainerId === container.id;
    const visibleCards = getContainerVisibleTextCards(container).filter(
      (currentCard) =>
        !(previewingThisContainer || detachedFromThisContainer) || !draggedIds?.has(currentCard.id),
    );
    let index = Math.max(
      visibleCards.findIndex((currentCard) => currentCard.id === card.id),
      0,
    );

    if (previewingThisContainer && index >= textCardDropPreview.index) {
      index += dragState?.type === "text-card-move" ? dragState.ids.length : 1;
    }

    return {
      x: container.x + CONTAINER_TEXT_CARD_PADDING,
      y:
        getContainerCardStackTop(container) +
        index * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP) -
        getContainerScrollOffset(container),
    };
  };

  const getTextCardDropContainer = (point: { x: number; y: number }) => {
    for (let index = textBlocks.length - 1; index >= 0; index -= 1) {
      const element = textBlocks[index];
      if (
        point.x >= element.x &&
        point.x <= element.x + element.width &&
        point.y >= element.y &&
        point.y <= element.y + element.height
      ) {
        return null;
      }
    }

    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index];
      const bodyTop = getContainerCardStackTop(element) - CONTAINER_TEXT_CARD_PADDING;
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
    // Index against the visible (filtered + sorted) list, minus the dragged
    // card, so a drop slot matches what the user actually sees. When no search
    // is active this is just the full ordered list.
    const visibleCards = getContainerVisibleTextCards(container, cards).filter(
      (card) => card.id !== draggingId,
    );
    const stackTop = getContainerCardStackTop(container) - getContainerScrollOffset(container);
    const slotHeight = CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP;

    if (currentIndex !== undefined) {
      const previousCard = visibleCards[currentIndex - 1];
      const nextCard = visibleCards[currentIndex];

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

    for (let index = 0; index < visibleCards.length; index += 1) {
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
    const cardsWithoutDragged = getContainerVisibleTextCards(container, cards).filter(
      (card) => card.id !== draggingId,
    );
    const stackTop = getContainerCardStackTop(container) - getContainerScrollOffset(container);
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

  // The drop index above is a slot in the visible (filtered) list. Translate it
  // to a real position in the container's full ordered list so dropping into a
  // searched container inserts relative to the cards on screen while leaving
  // hidden cards in their existing relative order. Without a filter the visible
  // and full lists are identical, so this is an identity mapping.
  const resolveContainerInsertOrderIndex = (
    container: ContainerElement,
    visibleInsertionIndex: number,
    cards: TextCardElement[],
    draggingId: string,
  ) => {
    const fullOrdered = cards
      .filter((card) => card.containerId === container.id && card.id !== draggingId)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    const visibleCards = getContainerVisibleTextCards(container, cards).filter(
      (card) => card.id !== draggingId,
    );

    if (visibleCards.length === 0) {
      return fullOrdered.length;
    }

    if (visibleInsertionIndex >= visibleCards.length) {
      const lastVisible = visibleCards[visibleCards.length - 1];
      return fullOrdered.findIndex((card) => card.id === lastVisible.id) + 1;
    }

    const target = visibleCards[Math.max(visibleInsertionIndex, 0)];
    return fullOrdered.findIndex((card) => card.id === target.id);
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
        getContainerCardStackTop(container) +
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

  const moveLayerItems = <T extends { id: string }>(
    current: T[],
    ids: string[],
    direction: "back" | "backward" | "forward" | "front",
  ) => {
    const targetIds = new Set(ids);
    const targets = current.filter((item) => targetIds.has(item.id));
    if (targets.length === 0) {
      return current;
    }

    const withoutTargets = current.filter((item) => !targetIds.has(item.id));
    const firstIndex = current.findIndex((item) => targetIds.has(item.id));
    let lastIndex = -1;
    for (let index = current.length - 1; index >= 0; index -= 1) {
      if (targetIds.has(current[index].id)) {
        lastIndex = index;
        break;
      }
    }
    const nonTargetsBeforeFirst = current.slice(0, firstIndex).filter((item) => !targetIds.has(item.id)).length;
    const nonTargetsThroughLast = current.slice(0, lastIndex + 1).filter((item) => !targetIds.has(item.id)).length;
    const nextIndex =
      direction === "back"
        ? 0
        : direction === "front"
          ? withoutTargets.length
          : direction === "backward"
            ? Math.max(0, nonTargetsBeforeFirst - 1)
            : Math.min(withoutTargets.length, nonTargetsThroughLast + 1);

    const nextItems = [...withoutTargets];
    nextItems.splice(nextIndex, 0, ...targets);
    return nextItems;
  };

  const getLayerActionIds = (id: string, predicate: (actionId: string) => boolean) =>
    (selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : [id]).filter(predicate);

  const moveCanvasLayers = (
    id: string,
    direction: "back" | "backward" | "forward" | "front",
  ) => {
    const topLevelItems = [
      ...elements,
      ...textBlocks,
      ...textCards.filter((card) => !card.containerId),
      ...images.filter((image) => !image.containerId),
    ].sort((left, right) => (left.layer ?? Number.MAX_SAFE_INTEGER) - (right.layer ?? Number.MAX_SAFE_INTEGER));
    const topLevelIds = new Set(topLevelItems.map((item) => item.id));
    const actionIds = getLayerActionIds(id, (actionId) => topLevelIds.has(actionId));
    const reordered = moveLayerItems(topLevelItems, actionIds, direction);
    const layers = new Map(reordered.map((item, index) => [item.id, index]));
    const applyLayer = <T extends { id: string; layer?: number }>(items: T[]) =>
      items.map((item) => (layers.has(item.id) ? { ...item, layer: layers.get(item.id) } : item));

    setElements((current) => applyLayer(current));
    setTextBlocks((current) => applyLayer(current));
    setTextCards((current) => applyLayer(current));
    setImages((current) => applyLayer(current));
    setRenamingId(null);
  };

  const topLevelLayerMap = useMemo(() => {
    const ordered = [
      ...elements,
      ...textBlocks,
      ...textCards.filter((card) => !card.containerId),
      ...images.filter((image) => !image.containerId),
    ].sort((left, right) => (left.layer ?? Number.MAX_SAFE_INTEGER) - (right.layer ?? Number.MAX_SAFE_INTEGER));

    return new Map(ordered.map((item, index) => [item.id, index]));
  }, [elements, images, textBlocks, textCards]);

  const withCanvasLayer = <T extends { id: string; layer?: number }>(item: T): T => ({
    ...item,
    layer: topLevelLayerMap.get(item.id) ?? item.layer,
  });

  const addIdsToSelection = (ids: string[]) => {
    setSelectedIds((current) => Array.from(new Set([...current, ...ids])));
  };

  const applySelection = (ids: string[], additive = false) => {
    if (additive) {
      addIdsToSelection(ids);
      return;
    }

    setSelectedIds(ids);
  };

  const selectCanvasElement = (element: ContainerElement | TextBlockElement, additive = false) => {
    applySelection([element.id], additive);
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

  const animateTextBlockIn = (id: string) => {
    setEnteringTextBlockIds((current) => [...current, id]);
    window.setTimeout(() => {
      setEnteringTextBlockIds((current) => current.filter((enteringId) => enteringId !== id));
    }, 180);
  };

  const animateImageIn = (id: string) => {
    setEnteringImageIds((current) => [...current, id]);
    window.setTimeout(() => {
      setEnteringImageIds((current) => current.filter((enteringId) => enteringId !== id));
    }, 180);
  };

  const removeImages = (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    setDeletingImageIds((current) => Array.from(new Set([...current, ...ids])));
    setImageMenu((current) => (current && ids.includes(current.id) ? null : current));
    setSelectedIds((current) => current.filter((selectedId) => !ids.includes(selectedId)));
    setLoadingImageIds((current) => current.filter((loadingId) => !ids.includes(loadingId)));
    window.setTimeout(() => {
      setImages((current) => current.filter((image) => !ids.includes(image.id)));
      setDeletingImageIds((current) => current.filter((deletingId) => !ids.includes(deletingId)));
      setEnteringImageIds((current) => current.filter((enteringId) => !ids.includes(enteringId)));
    }, 160);
  };

  const pulseTextCard = (id: string) => {
    setPulsingTextCardIds((current) => [...current.filter((pulsingId) => pulsingId !== id), id]);
    window.setTimeout(() => {
      setPulsingTextCardIds((current) => current.filter((pulsingId) => pulsingId !== id));
    }, 260);
  };

  const glowTextCard = (id: string) => {
    setGlowingTextCardIds((current) => [...current.filter((glowingId) => glowingId !== id), id]);
    window.setTimeout(() => {
      setGlowingTextCardIds((current) => current.filter((glowingId) => glowingId !== id));
    }, 720);
  };

  const pulseTextBlock = (id: string) => {
    setPulsingTextBlockIds((current) => [...current.filter((pulsingId) => pulsingId !== id), id]);
    window.setTimeout(() => {
      setPulsingTextBlockIds((current) => current.filter((pulsingId) => pulsingId !== id));
    }, 260);
  };

  const removeContainers = (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    const idsToRemove = new Set(ids);
    const containedTextCardIds = textCards
      .filter((card) => card.containerId && idsToRemove.has(card.containerId))
      .map((card) => card.id);
    const containedImageIds = images
      .filter((image) => image.containerId && idsToRemove.has(image.containerId))
      .map((image) => image.id);

    setDeletingIds((current) => Array.from(new Set([...current, ...ids])));
    setDeletingTextCardIds((current) => Array.from(new Set([...current, ...containedTextCardIds])));
    setDeletingImageIds((current) => Array.from(new Set([...current, ...containedImageIds])));
    setSelectedIds((current) =>
      current.filter(
        (selectedId) =>
          !ids.includes(selectedId) &&
          !containedTextCardIds.includes(selectedId) &&
          !containedImageIds.includes(selectedId),
      ),
    );
    setEditingTextCardId((current) => (current && containedTextCardIds.includes(current) ? null : current));
    setTextCardMenu((current) => (current && containedTextCardIds.includes(current.id) ? null : current));
    setImageMenu((current) => (current && containedImageIds.includes(current.id) ? null : current));
    setLoadingImageIds((current) => current.filter((loadingId) => !containedImageIds.includes(loadingId)));
    window.setTimeout(() => {
      setElements((current) => current.filter((element) => !ids.includes(element.id)));
      setTextCards((current) =>
        normalizeTextCardOrders(current.filter((card) => !containedTextCardIds.includes(card.id))),
      );
      setImages((current) => current.filter((image) => !containedImageIds.includes(image.id)));
      setDeletingIds((current) => current.filter((deletingId) => !ids.includes(deletingId)));
      setEnteringIds((current) => current.filter((enteringId) => !ids.includes(enteringId)));
      setDeletingTextCardIds((current) => current.filter((deletingId) => !containedTextCardIds.includes(deletingId)));
      setEnteringTextCardIds((current) => current.filter((enteringId) => !containedTextCardIds.includes(enteringId)));
      setPulsingTextCardIds((current) => current.filter((pulsingId) => !containedTextCardIds.includes(pulsingId)));
      setDeletingImageIds((current) => current.filter((deletingId) => !containedImageIds.includes(deletingId)));
      setEnteringImageIds((current) => current.filter((enteringId) => !containedImageIds.includes(enteringId)));
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

  const removeTextBlocks = (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    setDeletingTextBlockIds((current) => Array.from(new Set([...current, ...ids])));
    setEditingTextBlockId((current) => (current && ids.includes(current) ? null : current));
    setTextBlockMenu((current) => (current && ids.includes(current.id) ? null : current));
    setSelectedIds((current) => current.filter((selectedId) => !ids.includes(selectedId)));
    window.setTimeout(() => {
      setTextBlocks((current) => current.filter((element) => !ids.includes(element.id)));
      setDeletingTextBlockIds((current) => current.filter((deletingId) => !ids.includes(deletingId)));
      setEnteringTextBlockIds((current) => current.filter((enteringId) => !ids.includes(enteringId)));
      setPulsingTextBlockIds((current) => current.filter((pulsingId) => !ids.includes(pulsingId)));
    }, 160);
  };

  const closeCanvasManager = useCallback(() => {
    if (!canvasManagerOpen || canvasManagerClosing) {
      return;
    }

    setCanvasManagerClosing(true);
    window.setTimeout(() => {
      setCanvasManagerOpen(false);
      setCanvasManagerClosing(false);
    }, CANVAS_MANAGER_ANIMATION_MS);
  }, [canvasManagerClosing, canvasManagerOpen]);

  const closeExtensionsPanel = useCallback(() => {
    if (!extensionsOpen || extensionsClosing) {
      return;
    }

    setExtensionsClosing(true);
    window.setTimeout(() => {
      setExtensionsOpen(false);
      setExtensionsClosing(false);
    }, CANVAS_MANAGER_ANIMATION_MS);
  }, [extensionsClosing, extensionsOpen]);

  const switchLeftPanel = useCallback(
    (target: "canvases" | "extensions") => {
      if (canvasManagerClosing || extensionsClosing) {
        return;
      }

      if (panelSwitchTimeoutRef.current !== null) {
        window.clearTimeout(panelSwitchTimeoutRef.current);
      }

      const openTarget = () => {
        if (target === "canvases") {
          setCanvasManagerOpen(true);
          setCanvasManagerClosing(false);
        } else {
          setExtensionsOpen(true);
          setExtensionsClosing(false);
        }
      };

      if (target === "canvases" && extensionsOpen) {
        setExtensionsClosing(true);
        panelSwitchTimeoutRef.current = window.setTimeout(() => {
          setExtensionsOpen(false);
          setExtensionsClosing(false);
          openTarget();
          panelSwitchTimeoutRef.current = null;
        }, CANVAS_MANAGER_ANIMATION_MS);
        return;
      }

      if (target === "extensions" && canvasManagerOpen) {
        setCanvasManagerClosing(true);
        panelSwitchTimeoutRef.current = window.setTimeout(() => {
          setCanvasManagerOpen(false);
          setCanvasManagerClosing(false);
          openTarget();
          panelSwitchTimeoutRef.current = null;
        }, CANVAS_MANAGER_ANIMATION_MS);
        return;
      }

      openTarget();
    },
    [canvasManagerClosing, canvasManagerOpen, extensionsClosing, extensionsOpen],
  );

  useEffect(
    () => () => {
      if (panelSwitchTimeoutRef.current !== null) {
        window.clearTimeout(panelSwitchTimeoutRef.current);
      }
      if (canvasCycleRestoreTimeoutRef.current !== null) {
        window.clearTimeout(canvasCycleRestoreTimeoutRef.current);
      }
    },
    [],
  );


  useEffect(() => {
    const trackPointer = (event: globalThis.PointerEvent) => {
      lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("pointermove", trackPointer, true);
    return () => window.removeEventListener("pointermove", trackPointer, true);
  }, []);

  useEffect(() => {
    const clearFocusedElement = () => {
      const focusedElement = document.activeElement;
      if (focusedElement instanceof HTMLElement) {
        focusedElement.blur();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditingText = isEditableKeyboardTarget(target);

      if (
        event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key.toLowerCase() === "e" &&
        !isEditingText
      ) {
        event.preventDefault();
        event.stopPropagation();
        clearFocusedElement();
        closeContextMenus();
        setQuickExtensionsMenu({
          left: lastPointerPositionRef.current.x,
          top: lastPointerPositionRef.current.y,
        });
        return;
      }

      if (event.key === "Tab" && !isEditingText && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        clearFocusedElement();

        if (event.shiftKey) {
          if (canvasManagerOpen && !canvasManagerClosing) {
            switchLeftPanel("extensions");
            return;
          }

          if (extensionsOpen && !extensionsClosing) {
            switchLeftPanel("canvases");
            return;
          }

          switchLeftPanel("canvases");
          return;
        }

        if (canvasManagerOpen && !canvasManagerClosing) {
          closeCanvasManager();
          return;
        }

        closeExtensionsPanel();
        setQuickExtensionsMenu(null);
        setCanvasManagerOpen(true);
        setCanvasManagerClosing(false);
        return;
      }

      if (
        !isEditingText &&
        (event.key === "Enter" || event.key === " " || event.key === "Spacebar") &&
        isKeyboardFocusableControl(target)
      ) {
        event.preventDefault();
        event.stopPropagation();
        clearFocusedElement();
        return;
      }

      if (
        !isEditingText &&
        event.key === "Escape" &&
        !settingsOpen &&
        !clearModalOpen &&
        !updateModalOpen
      ) {
        event.preventDefault();
        event.stopPropagation();
        clearFocusedElement();
        closeContextMenus();
        closeCanvasManager();
        closeExtensionsPanel();
        setColorPickerTargetId(null);
        setColorPickerPreview(null);
        setRenamingId(null);
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
      removeTextBlocks(selectedIds.filter((id) => textBlocksById.has(id)));
      removeImages(selectedIds.filter((id) => imagesById.has(id)));
      closeContextMenus();
      setRenamingId(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    canvasManagerClosing,
    canvasManagerOpen,
    clearModalOpen,
    closeCanvasManager,
    closeExtensionsPanel,
    containersById,
    extensionsClosing,
    extensionsOpen,
    imagesById,
    selectedIds,
    settingsOpen,
    switchLeftPanel,
    textBlocksById,
    textCardsById,
    updateModalOpen,
  ]);

  const getLooseTextCardSelectionBounds = (card: TextCardElement) => {
    const estimatedTextWidth = Math.max(44, Math.min(520, card.text.length * 9 + 48));

    return {
      left: card.x,
      top: card.y,
      width: estimatedTextWidth,
      height: CONTAINER_TEXT_CARD_ROW_HEIGHT,
    };
  };

  const getMeasuredTextCardBounds = (card: TextCardElement): ExtensionRippleBounds | null => {
    const node = worldRef.current?.querySelector<HTMLElement>(`[data-text-card-id="${card.id}"]`);
    const worldRect = worldRef.current?.getBoundingClientRect();
    if (!node || !worldRect || zoom <= 0) {
      return null;
    }

    const rect = node.getBoundingClientRect();
    return {
      left: (rect.left - worldRect.left) / zoom,
      top: (rect.top - worldRect.top) / zoom,
      width: rect.width / zoom,
      height: rect.height / zoom,
      borderRadius: 8,
    };
  };

  const getTextCardRippleBounds = (card: TextCardElement): ExtensionRippleBounds | null => {
    const measuredBounds = getMeasuredTextCardBounds(card);
    if (!card.containerId) {
      return measuredBounds ?? { ...getLooseTextCardSelectionBounds(card), borderRadius: 8 };
    }

    const container = containersById.get(card.containerId);
    const position = getTextCardRenderPosition(card);
    if (!container || !position) {
      return null;
    }
    const visibleCards = getContainerVisibleTextCards(container);
    if (!visibleCards.some((currentCard) => currentCard.id === card.id)) {
      return null;
    }

    const contentTop =
      container.y +
      CONTAINER_HEADER_HEIGHT +
      (container.extensions?.search ? CONTAINER_SEARCH_HEIGHT : 0);
    const baseBounds =
      measuredBounds ??
      ({
        left: position.x,
        top: position.y,
        width: Math.max(120, container.width - CONTAINER_TEXT_CARD_PADDING * 2),
        height: CONTAINER_TEXT_CARD_ROW_HEIGHT,
      } satisfies ExtensionRippleBounds);
    const top = Math.max(baseBounds.top, contentTop);
    const bottom = Math.min(baseBounds.top + baseBounds.height, container.y + container.height);
    const height = bottom - top;
    if (height <= 0) {
      return null;
    }

    return {
      left: baseBounds.left,
      top,
      width: baseBounds.width,
      height,
      borderTopLeftRadius: top === baseBounds.top ? 8 : 0,
      borderTopRightRadius: top === baseBounds.top ? 8 : 0,
      borderBottomRightRadius: bottom === baseBounds.top + baseBounds.height ? 8 : 0,
      borderBottomLeftRadius: bottom === baseBounds.top + baseBounds.height ? 8 : 0,
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
  const containerSelectionBounds =
    dragState?.type === "container-select"
      ? {
          containerId: dragState.containerId,
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
        ...textBlocks
          .filter((element) =>
            rectsOverlap(selectionBounds, {
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
            }),
          )
          .map((element) => element.id),
        ...images
          .filter(
            (image) =>
              !image.containerId &&
              rectsOverlap(selectionBounds, {
                left: image.x,
                top: image.y,
                width: image.width,
                height: image.height,
              }),
          )
          .map((image) => image.id),
      ]
    : containerSelectionBounds
      ? (() => {
          const container = containersById.get(containerSelectionBounds.containerId);
          if (!container) {
            return [];
          }

          return getContainerVisibleTextCards(container)
            .filter((card) => {
              const bounds = getTextCardRippleBounds(card);
              return bounds ? rectsOverlap(containerSelectionBounds, bounds) : false;
            })
            .map((card) => card.id);
        })()
    : [];
  const outlinedIds =
    dragState?.type === "select" || dragState?.type === "container-select"
      ? Array.from(new Set([...(dragState.additive ? selectedIds : []), ...selectionPreviewIds]))
      : selectedIds.length > 1
        ? selectedIds
        : [];

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

  const getAlignmentTargets = (
    current: Array<ContainerElement | TextBlockElement>,
    excludeIds: Set<string>,
    axis: "x" | "y",
  ) =>
    current
      .filter((element) => !excludeIds.has(element.id) && isElementVisible(element))
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

  const getTextCardAlignmentTargets = (excludeIds: Set<string>, axis: "x" | "y") => [
    ...elements
      .filter((element) => !excludeIds.has(element.id))
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
      ),
    ...textBlocks
      .filter((element) => !excludeIds.has(element.id))
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
      ),
    ...textCards
      .filter((card) => !excludeIds.has(card.id) && !card.containerId)
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
    ...images
      .filter((image) => !excludeIds.has(image.id) && !image.containerId)
      .flatMap((image) =>
        axis === "x"
          ? [
              { value: image.x, kind: "start" as const },
              { value: image.x + image.width, kind: "end" as const },
            ]
          : [
              { value: image.y, kind: "start" as const },
              { value: image.y + image.height, kind: "end" as const },
            ],
      ),
  ];

  const snapMovedContainer = (
    element: ContainerElement | TextBlockElement,
    current: Array<ContainerElement | TextBlockElement>,
    nextX: number,
    nextY: number,
    pointer: { x: number; y: number },
    excludeIds: Set<string> = new Set([element.id]),
  ) => {
    const xSnap = findSnapOffset(
      [
        { value: nextX, kind: "start" },
        { value: nextX + element.width, kind: "end" },
      ],
      getAlignmentTargets(current, excludeIds, "x"),
    );
    const ySnap = findSnapOffset(
      [
        { value: nextY, kind: "start" },
        { value: nextY + element.height, kind: "end" },
      ],
      getAlignmentTargets(current, excludeIds, "y"),
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
    excludeIds: Set<string> = new Set([activeId]),
  ) => {
    const xSnap = findSnapOffset(
      [
        { value: nextX, kind: "start" },
        { value: nextX + width, kind: "end" },
      ],
      getTextCardAlignmentTargets(excludeIds, "x"),
    );
    const ySnap = findSnapOffset(
      [
        { value: nextY, kind: "start" },
        { value: nextY + height, kind: "end" },
      ],
      getTextCardAlignmentTargets(excludeIds, "y"),
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
    element: ContainerElement | TextBlockElement,
    current: Array<ContainerElement | TextBlockElement>,
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

  // Aspect-locked resize snapping: snap the right or bottom edge to nearby
  // element edges, whichever is closer, and derive the other dimension so the
  // image keeps its aspect ratio.
  const snapResizedImage = (
    image: ImageElement,
    nextWidth: number,
    nextHeight: number,
    pointer: { x: number; y: number },
  ) => {
    const aspect = nextHeight > 0 ? nextWidth / nextHeight : 1;
    const excludeIds = new Set([image.id]);
    const xSnap = findSnapOffset(
      [{ value: image.x + nextWidth, kind: "end" }],
      getTextCardAlignmentTargets(excludeIds, "x"),
    );
    const ySnap = findSnapOffset(
      [{ value: image.y + nextHeight, kind: "end" }],
      getTextCardAlignmentTargets(excludeIds, "y"),
    );

    const xGuide = xSnap.guide;
    const yGuide = ySnap.guide;
    let width = nextWidth;
    const guides: SnapGuide[] = [];

    if (xGuide !== null && (yGuide === null || Math.abs(xSnap.offset) <= Math.abs(ySnap.offset))) {
      width = nextWidth + xSnap.offset;
      guides.push({ axis: "x", position: xGuide, pointerPosition: pointer.y });
    } else if (yGuide !== null) {
      width = (nextHeight + ySnap.offset) * aspect;
      guides.push({ axis: "y", position: yGuide, pointerPosition: pointer.x });
    }

    return { width, height: aspect > 0 ? width / aspect : nextHeight, guides };
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

  // Fit an image's natural size into a sensible initial on-canvas box.
  const getInitialImageSize = (naturalWidth?: number, naturalHeight?: number) => {
    const maxEdge = 360;
    if (!naturalWidth || !naturalHeight) {
      return { width: 280, height: 200 };
    }
    const scale = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight));
    return {
      width: Math.max(MIN_IMAGE_SIZE, Math.round(naturalWidth * scale)),
      height: Math.max(MIN_IMAGE_SIZE, Math.round(naturalHeight * scale)),
    };
  };

  // Create an empty image placeholder at a canvas point; the caller (or the
  // user clicking it) fills it with a picked/dropped/pasted image afterwards.
  const createImageElement = (clientX: number, clientY: number): string => {
    const point = canvasPointFromEvent({ clientX, clientY });
    const id = `image-${Date.now()}`;
    const width = 280;
    const height = 200;
    const image: ImageElement = {
      id,
      x: clamp(point.x - width / 2, 0, canvasWidth - width),
      y: clamp(point.y - height / 2, 0, canvasHeight - height),
      width,
      height,
      accent: DEFAULT_CONTAINER_ACCENT,
    };

    setImages((current) => [...current, image]);
    animateImageIn(id);
    setSelectedIds([id]);
    closeContextMenus();
    setRenamingId(null);
    return id;
  };

  const setImageLoading = (id: string, loading: boolean) => {
    setLoadingImageIds((current) =>
      loading
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((loadingId) => loadingId !== id),
    );
  };

  // Apply stored image metadata to an element, sizing it to the image's aspect.
  // Only resizes empty placeholders; an element that already had an image keeps
  // its current box when the image is replaced.
  const applyImageMeta = (id: string, meta: ImageMeta) => {
    setImages((current) =>
      current.map((image) => {
        if (image.id !== id) {
          return image;
        }
        const wasEmpty = !image.imageId;
        const size = getInitialImageSize(meta.width, meta.height);
        return {
          ...image,
          imageId: meta.hash,
          format: meta.format,
          naturalWidth: meta.width || undefined,
          naturalHeight: meta.height || undefined,
          ...(wasEmpty
            ? {
                x: clamp(image.x, 0, canvasWidth - size.width),
                y: clamp(image.y, 0, canvasHeight - size.height),
                ...size,
              }
            : {}),
        };
      }),
    );
    setImageLoading(id, false);
  };

  // Store an already-read image path into the given element, showing a loading
  // spinner while the (off-thread) decode/encode runs.
  const fillElementFromPath = async (id: string, path: string) => {
    setImageLoading(id, true);
    try {
      const meta = await invoke<ImageMeta>("store_image_path", { path });
      applyImageMeta(id, meta);
    } catch (error) {
      console.error("Failed to store image", error);
      showToast({ tone: "error", title: "Could not add image", message: String(error) });
      setImageLoading(id, false);
    }
  };

  // Open the native file picker (fast — returns a path) and fill the given
  // element. The heavy processing happens afterward behind a loading spinner so
  // the app never freezes on a large image.
  const pickImageForElement = async (id: string) => {
    try {
      const path = await invoke<string | null>("pick_image_path");
      if (path) {
        await fillElementFromPath(id, path);
      }
    } catch (error) {
      console.error("Failed to pick image", error);
      showToast({ tone: "error", title: "Could not add image", message: String(error) });
    }
  };

  // Create an empty placeholder at a canvas point and return its id, without
  // touching selection focus the way the menu/double-click path does.
  const spawnImagePlaceholder = (clientX: number, clientY: number, offset = 0): string => {
    const point = canvasPointFromEvent({ clientX, clientY });
    const width = 280;
    const height = 200;
    const id = `image-${Date.now()}-${Math.round(point.x) + offset}`;
    const image: ImageElement = {
      id,
      x: clamp(point.x - width / 2 + offset, 0, canvasWidth - width),
      y: clamp(point.y - height / 2 + offset, 0, canvasHeight - height),
      width,
      height,
      accent: DEFAULT_CONTAINER_ACCENT,
    };
    setImages((current) => [...current, image]);
    animateImageIn(id);
    return id;
  };

  // Drop a loading placeholder at a point, then fill it from a path off-thread.
  const importImageFromPath = (path: string, clientX: number, clientY: number, offset = 0) => {
    const id = spawnImagePlaceholder(clientX, clientY, offset);
    void fillElementFromPath(id, path);
  };

  // Clipboard paste: placeholder first, then store the bytes behind a spinner.
  const addImageFromBuffer = async (buffer: ArrayBuffer, clientX: number, clientY: number) => {
    const id = spawnImagePlaceholder(clientX, clientY);
    setSelectedIds([id]);
    setImageLoading(id, true);
    try {
      // Yield so the placeholder + spinner paint before the base64 encode.
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const meta = await storeImageFromBytes(buffer);
      if (meta) {
        applyImageMeta(id, meta);
      } else {
        removeImages([id]);
      }
    } finally {
      setImageLoading(id, false);
    }
  };

  imageDropOpsRef.current = {
    canvasPointFromEvent,
    looseImages,
    fillElementFromPath,
    importImageFromPath,
    addImageFromBuffer,
  };

  // OS file drop (Tauri native drag-drop). HTML5 ondrop does not receive files
  // while native drag-drop is enabled, so we listen on the webview instead and
  // store dropped image paths in Rust. A drop over an empty image placeholder
  // fills it; otherwise a new image element is created at the drop point.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") {
          return;
        }

        const ops = imageDropOpsRef.current;
        if (!ops) {
          return;
        }

        const { x, y } = event.payload.position;
        const paths = event.payload.paths.filter((path) => /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(path));
        if (paths.length === 0) {
          return;
        }

        const point = ops.canvasPointFromEvent({ clientX: x, clientY: y });
        const targetEmpty = [...ops.looseImages]
          .reverse()
          .find(
            (image) =>
              !image.imageId &&
              point.x >= image.x &&
              point.x <= image.x + image.width &&
              point.y >= image.y &&
              point.y <= image.y + image.height,
          );

        paths.forEach((path, index) => {
          if (targetEmpty && index === 0) {
            ops.fillElementFromPath(targetEmpty.id, path);
          } else {
            ops.importImageFromPath(path, x, y, index * 24);
          }
        });
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch((error) => {
        console.error("Failed to register drag-drop listener", error);
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Clipboard paste of an image → new image element at the viewport center.
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const ops = imageDropOpsRef.current;
      if (!ops || !event.clipboardData) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const item = Array.from(event.clipboardData.items).find((entry) =>
        entry.type.startsWith("image/"),
      );
      if (!item) {
        return;
      }

      const file = item.getAsFile();
      if (!file) {
        return;
      }

      event.preventDefault();
      file
        .arrayBuffer()
        .then((buffer) => {
          ops.addImageFromBuffer(buffer, window.innerWidth / 2, window.innerHeight / 2);
        })
        .catch((error) => {
          console.error("Failed to read pasted image", error);
        });
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Canvas menu "Image": drop an empty placeholder. The user fills it by
  // double-clicking inside (or dropping a file onto it).
  const createImageFromMenu = (clientX: number, clientY: number) => {
    createImageElement(clientX, clientY);
  };

  const updateImageAccent = (id: string, accent: string) => {
    setImages((current) =>
      current.map((image) => (image.id === id ? { ...image, accent } : image)),
    );
  };

  const toggleImageBackground = (id: string) => {
    setImages((current) =>
      current.map((image) =>
        image.id === id ? { ...image, background: image.background === false } : image,
      ),
    );
    closeContextMenus();
  };

  const copyImage = (image: ImageElement) => {
    if (copyContextSelection(image.id)) {
      return;
    }

    setCopiedItem({
      type: "image",
      item: {
        imageId: image.imageId,
        format: image.format,
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        accent: image.accent,
        background: image.background,
        extensions: cloneExtensions(image.extensions),
      },
    });
    closeContextMenus();
  };

  const deleteImageElement = (id: string) => {
    removeImages([id]);
    closeContextMenus();
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

  const createTextBlock = (clientX: number, clientY: number) => {
    const point = canvasPointFromEvent({ clientX, clientY });
    const width = 320;
    const height = 220;
    const nextNumber = textBlocks.length + 1;
    const id = `text-block-${Date.now()}`;
    const element: TextBlockElement = {
      id,
      name: `Text block ${nextNumber}`,
      text: "Text block",
      x: clamp(point.x - width / 2, 0, canvasWidth - width),
      y: clamp(point.y - 28, 0, canvasHeight - height),
      width,
      height,
      accent: DEFAULT_CONTAINER_ACCENT,
    };

    setTextBlocks((current) => [...current, element]);
    setSelectedIds([id]);
    animateTextBlockIn(id);
    setRenameDraft(element.name);
    setRenamingId(id);
    closeContextMenus();
    setEditingTextCardId(null);
    setEditingTextBlockId(null);
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
      y: getContainerCardStackTop(container) + order * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP),
      accent: DEFAULT_TEXT_CARD_ACCENT,
      ...(container.extensions?.inheritCardColor ? { accent: container.accent } : {}),
      containerId,
      order,
    };
    const cardsOutsideContainer = textCards.filter((currentCard) => currentCard.containerId !== containerId);
    const containerCards = getOrderedContainerTextCards(containerId);
    containerCards.splice(order, 0, card);
    const nextCards = normalizeTextCardOrders([
      ...cardsOutsideContainer,
      ...containerCards.map((currentCard, index) => ({ ...currentCard, order: index })),
    ]);
    const visibleIndex = getContainerVisibleTextCards(container, nextCards).findIndex(
      (currentCard) => currentCard.id === id,
    );

    setTextCards(nextCards);
    if (visibleIndex >= 0) {
      setContainerScrollOffsets((current) => ({
        ...current,
        [containerId]: getScrollOffsetForVisibleCardIndex(container, visibleIndex, nextCards),
      }));
    }
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

  const shouldStartPan = (event: PointerEvent<HTMLElement>) => {
    if (event.button === 1) {
      return true;
    }

    if (event.button !== 0 || !event.ctrlKey) {
      return false;
    }

    const target = event.target instanceof HTMLElement ? event.target : null;
    return !isEditableKeyboardTarget(target);
  };

  const startPan = (event: PointerEvent<HTMLElement>, stage: HTMLElement) => {
    event.preventDefault();
    event.stopPropagation();
    stage.setPointerCapture(event.pointerId);
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

  const handleMainPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    if (applyColorPickerSelection(event)) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (quickExtensionsMenu && !target?.closest("[data-quick-extensions-menu]")) {
      setQuickExtensionsMenu(null);
    }

    if (!target?.closest("[data-text-block-content]") && !isEditableKeyboardTarget(target)) {
      window.getSelection()?.removeAllRanges();
    }

    const focusedControl = target?.closest("button, [role='button'], a, select, [tabindex]");
    if (focusedControl instanceof HTMLElement && !isEditableKeyboardTarget(focusedControl)) {
      requestAnimationFrame(() => focusedControl.blur());
    }

    if (renamingId && !target?.closest("[data-container-rename-input]")) {
      saveRename(renamingId);
    }

    if ((event.target as HTMLElement | null)?.closest("[data-context-menu]")) {
      return;
    }

    closeContextMenus();
  };

  const handleStagePointerDownCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.ctrlKey || !shouldStartPan(event)) {
      return;
    }

    startPan(event, event.currentTarget);
  };

  const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!shouldStartPan(event)) {
      return;
    }

    startPan(event, event.currentTarget);
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
    if (editingTextBlockId) {
      saveTextBlockEdit(editingTextBlockId);
    }
    setRenamingId(null);
    const point = canvasPointFromEvent(event);
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    setDragState({
      type: "select",
      pointerId: event.pointerId,
      additive: event.shiftKey,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
  };

  const startContainerContentSelection = (event: PointerEvent<HTMLElement>, container: ContainerElement) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    closeContextMenus();
    if (editingTextCardId) {
      saveTextCardEdit(editingTextCardId);
    }
    if (editingTextBlockId) {
      saveTextBlockEdit(editingTextBlockId);
    }
    setRenamingId(null);
    const point = canvasPointFromEvent(event);
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    setDragState({
      type: "container-select",
      pointerId: event.pointerId,
      containerId: container.id,
      additive: event.shiftKey,
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

    if (dragState.type === "select" || dragState.type === "container-select") {
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
      const activeTextBlock = textBlocksById.get(dragState.id);
      const activeTextCardStart = dragState.textCardStartPositions.find(
        (position) => position.id === dragState.id,
      );
      const activeTextBlockStart = dragState.textBlockStartPositions.find(
        (position) => position.id === dragState.id,
      );
      const activeImage = imagesById.get(dragState.id);
      const activeImageStart = dragState.imageStartPositions.find(
        (position) => position.id === dragState.id,
      );
      const activePosition = activeStart ?? activeTextBlockStart ?? activeTextCardStart ?? activeImageStart;
      const activeWidth = activeElement?.width ?? activeTextBlock?.width ?? activeImage?.width ?? dragState.activeWidth;
      const activeHeight = activeElement?.height ?? activeTextBlock?.height ?? activeImage?.height ?? dragState.activeHeight;

      if (!activePosition) {
        return;
      }

      const nextX = activePosition.x + worldDeltaX;
      const nextY = activePosition.y + worldDeltaY;
      const movingIds = new Set<string>([
        ...dragState.startPositions.map((position) => position.id),
        ...dragState.textBlockStartPositions.map((position) => position.id),
        ...dragState.textCardStartPositions.map((position) => position.id),
        ...dragState.imageStartPositions.map((position) => position.id),
      ]);
      const snapped = event.shiftKey
        ? activeElement || activeTextBlock
          ? snapMovedContainer(
              activeElement ?? activeTextBlock!,
              [...elements, ...textBlocks],
              nextX,
              nextY,
              pointerPoint,
              movingIds,
            )
          : snapMovedTextCard(
              dragState.id,
              activeWidth,
              activeHeight,
              nextX,
              nextY,
              pointerPoint,
              movingIds,
            )
        : { x: nextX, y: nextY, guides: [] };
      const appliedDeltaX = snapped.x - activePosition.x;
      const appliedDeltaY = snapped.y - activePosition.y;
      nextGuides = snapped.guides;
      const startPositionsById = new Map(
        dragState.startPositions.map((position) => [position.id, position]),
      );
      const textCardStartPositionsById = new Map(
        dragState.textCardStartPositions.map((position) => [position.id, position]),
      );
      const textBlockStartPositionsById = new Map(
        dragState.textBlockStartPositions.map((position) => [position.id, position]),
      );
      const imageStartPositionsById = new Map(
        dragState.imageStartPositions.map((position) => [position.id, position]),
      );

      setElements(
        elements.map((element) => {
          const startPosition = startPositionsById.get(element.id);
          if (!startPosition) {
            return element;
          }

          return {
            ...element,
            x: startPosition.x + appliedDeltaX,
            y: startPosition.y + appliedDeltaY,
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
            x: startPosition.x + appliedDeltaX,
            y: startPosition.y + appliedDeltaY,
          };
        }),
      );
      setTextBlocks(
        textBlocks.map((element) => {
          const startPosition = textBlockStartPositionsById.get(element.id);
          if (!startPosition) {
            return element;
          }

          return {
            ...element,
            x: startPosition.x + appliedDeltaX,
            y: startPosition.y + appliedDeltaY,
          };
        }),
      );
      setImages(
        images.map((image) => {
          const startPosition = imageStartPositionsById.get(image.id);
          if (!startPosition) {
            return image;
          }

          return {
            ...image,
            x: startPosition.x + appliedDeltaX,
            y: startPosition.y + appliedDeltaY,
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
      const cardsWithoutBundle = textCards.filter((card) => !dragState.ids.includes(card.id));
      const originalDropIndex =
        dropContainer && dropContainer.id === dragState.startContainerId
          ? getContainerVisibleTextCards(dropContainer, textCards).findIndex(
              (card) => card.id === dragState.id,
            )
          : -1;
      const dropIndex = dropContainer
        ? currentPreview?.containerId === dropContainer.id
          ? getDirectionalTextCardDropIndex(
              dropContainer,
              draggedCenterPoint.y,
              cardsWithoutBundle,
              dragState.id,
              currentPreview.index,
            )
          : getTextCardDropIndex(
              dropContainer,
              draggedCenterPoint,
              cardsWithoutBundle,
              dragState.id,
              originalDropIndex >= 0 ? originalDropIndex : undefined,
            )
        : null;

      if (!dropContainer || currentPreview?.containerId !== dropContainer.id) {
        textCardDragCenterYRef.current = draggedCenterPoint.y;
      }

      const pointerDeltaX = event.clientX - dragState.lastClientX;
      const pointerDeltaY = event.clientY - dragState.lastClientY;
      const nextSwayX = clamp(dragState.swayX * 0.55 + pointerDeltaX * 0.45, -14, 14);
      const nextSwayY = clamp(dragState.swayY * 0.55 + pointerDeltaY * 0.45, -10, 10);
      setDragState({
        ...dragState,
        snapping: event.shiftKey,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        swayX: nextSwayX,
        swayY: nextSwayY,
      });

      const nextX = dragState.startX + worldDeltaX;
      const nextY = dragState.startY + worldDeltaY;
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
        const offsets = new Map(dragState.cardOffsets.map((offset) => [offset.id, offset]));
        return current.map((card) => {
          const offset = offsets.get(card.id);
          return offset
            ? {
                ...card,
                x: snapped.x + offset.x,
                y: snapped.y + offset.y,
              }
            : card;
        });
      });
      setSnapGuides(event.shiftKey ? snapped.guides : []);
      return;
    }

    if (dragState.type === "image-move") {
      const nextX = dragState.startX + worldDeltaX;
      const nextY = dragState.startY + worldDeltaY;
      const movingImage = imagesById.get(dragState.id);
      const snapped =
        event.shiftKey && movingImage
          ? snapMovedTextCard(
              dragState.id,
              dragState.width,
              dragState.height,
              nextX,
              nextY,
              pointerPoint,
            )
          : { x: nextX, y: nextY, guides: [] };
      const appliedX = snapped.x;
      const appliedY = snapped.y;
      setImages((current) =>
        current.map((image) =>
          image.id === dragState.id ? { ...image, x: appliedX, y: appliedY } : image,
        ),
      );
      setSnapGuides(event.shiftKey ? snapped.guides : []);
      return;
    }

    if (dragState.type === "image-resize") {
      const resizingImage = imagesById.get(dragState.id);
      if (!resizingImage) {
        return;
      }

      // Aspect-locked: drive width from the larger pointer delta, derive height.
      const proposedWidth = dragState.startWidth + Math.max(worldDeltaX, worldDeltaY * dragState.aspectRatio);
      const maxWidth = Math.min(
        canvasWidth - resizingImage.x,
        (canvasHeight - resizingImage.y) * dragState.aspectRatio,
      );
      const baseWidth = clamp(proposedWidth, MIN_IMAGE_SIZE, maxWidth);
      const baseHeight = baseWidth / dragState.aspectRatio;
      const snapped = event.shiftKey
        ? snapResizedImage(resizingImage, baseWidth, baseHeight, pointerPoint)
        : { width: baseWidth, height: baseHeight, guides: [] };
      const width = clamp(snapped.width, MIN_IMAGE_SIZE, maxWidth);
      const height = width / dragState.aspectRatio;
      setImages((current) =>
        current.map((image) =>
          image.id === dragState.id ? { ...image, width, height } : image,
        ),
      );
      setSnapGuides(event.shiftKey ? snapped.guides : []);
      return;
    }

    const resizingContainer = containersById.get(dragState.id);
    const resizingTextBlock = textBlocksById.get(dragState.id);
    const resizingElement = resizingContainer ?? resizingTextBlock;
    if (!resizingElement) {
      return;
    }

    const nextWidth = clamp(dragState.startWidth + worldDeltaX, MIN_WIDTH, canvasWidth - resizingElement.x);
    const nextHeight = clamp(dragState.startHeight + worldDeltaY, MIN_HEIGHT, canvasHeight - resizingElement.y);
    const snapped = event.shiftKey
      ? snapResizedContainer(resizingElement, [...elements, ...textBlocks], nextWidth, nextHeight, pointerPoint)
      : { width: nextWidth, height: nextHeight, guides: [] };
    nextGuides = snapped.guides;
    const width = clamp(snapped.width, MIN_WIDTH, canvasWidth - resizingElement.x);
    const height = clamp(snapped.height, MIN_HEIGHT, canvasHeight - resizingElement.y);

    if (resizingContainer) {
      const resizedElement = {
        ...resizingContainer,
        width,
        height,
      };
      const maxScroll = getContainerMaxScroll(resizedElement);
      setElements((current) =>
        current.map((element) => (element.id === dragState.id ? resizedElement : element)),
      );
      setContainerScrollOffsets((current) => ({
        ...current,
        [resizedElement.id]: clamp(current[resizedElement.id] ?? 0, 0, maxScroll),
      }));
    } else {
      setTextBlocks((current) =>
        current.map((element) =>
          element.id === dragState.id
            ? {
                ...element,
                width,
                height,
              }
            : element,
        ),
      );
    }
    setSnapGuides(event.shiftKey ? nextGuides : []);
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    if (dragState.type === "text-card-move") {
      const droppedTextCardIds = dragState.ids;
      const droppedTextCardIdSet = new Set(droppedTextCardIds);
      const movedDistance = Math.hypot(
        event.clientX - dragState.startClientX,
        event.clientY - dragState.startClientY,
      );
      const droppedWithoutMoving = movedDistance < 3;
      const endPoint = canvasPointFromEvent(event);
      const dropContainer = getTextCardDropContainer(endPoint);
      const draggedCenterPoint = {
        ...endPoint,
        y: endPoint.y - dragState.pointerOffsetY + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2,
      };
      const currentPreview = textCardDropPreviewRef.current;
      const draggedCards = textCards
        .filter((card) => droppedTextCardIdSet.has(card.id))
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
      let nextTextCards = textCards;

      if (draggedCards.length > 0 && !droppedWithoutMoving) {
        if (!dropContainer) {
          nextTextCards = normalizeTextCardOrders(
            textCards.map((card) =>
              droppedTextCardIdSet.has(card.id)
                ? {
                    ...card,
                    containerId: undefined,
                    order: undefined,
                  }
                : card,
            ),
          );
        } else {
          const cardsWithoutBundle = textCards.filter((card) => !droppedTextCardIdSet.has(card.id));
          const visibleDropIndex =
            currentPreview?.containerId === dropContainer.id
              ? currentPreview.index
              : getTextCardDropIndex(
                  dropContainer,
                  draggedCenterPoint,
                  cardsWithoutBundle,
                  dragState.id,
                );
          const realDropIndex = resolveContainerInsertOrderIndex(
            dropContainer,
            visibleDropIndex,
            cardsWithoutBundle,
            dragState.id,
          );
          const targetCards = cardsWithoutBundle
            .filter((card) => card.containerId === dropContainer.id)
            .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

          targetCards.splice(
            realDropIndex,
            0,
            ...draggedCards.map((draggedCard, index) => ({
              ...draggedCard,
              containerId: dropContainer.id,
              order: realDropIndex + index,
            })),
          );

          nextTextCards = normalizeTextCardOrders([
            ...cardsWithoutBundle.filter((card) => card.containerId !== dropContainer.id),
            ...targetCards.map((card, index) => ({
              ...card,
              containerId: dropContainer.id,
              order: index,
            })),
          ]);
        }

        const releaseCards = draggedCards.map((draggedCard) => {
          const nextCard = nextTextCards.find((card) => card.id === draggedCard.id) ?? draggedCard;
          const bundleIndex = dragState.ids.indexOf(draggedCard.id);
          const swayFactor = 0.18 + Math.min(Math.max(bundleIndex, 0), 5) * 0.04;
          const from = {
            x: draggedCard.x + (bundleIndex > 0 ? dragState.swayX * swayFactor : 0),
            y:
              draggedCard.y +
              (bundleIndex > 0
                ? Math.abs(dragState.swayX) * 0.08 + dragState.swayY * 0.12
                : 0),
          };
          if (!nextCard.containerId) {
            return {
              card: nextCard,
              from,
              to: { x: draggedCard.x, y: draggedCard.y },
            };
          }

          const nextContainer = containersById.get(nextCard.containerId);
          const visibleCards = nextContainer
            ? getContainerVisibleTextCards(nextContainer, nextTextCards)
            : [];
          const visibleIndex = Math.max(
            visibleCards.findIndex((card) => card.id === nextCard.id),
            0,
          );
          return {
            card: nextCard,
            from,
            to: nextContainer
              ? {
                  x: nextContainer.x + CONTAINER_TEXT_CARD_PADDING,
                  y:
                    getContainerCardStackTop(nextContainer) +
                    visibleIndex * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP) -
                    getContainerScrollOffset(nextContainer),
                }
              : { x: draggedCard.x, y: draggedCard.y },
          };
        });

        setTextCards(nextTextCards);
        setSettlingTextCardIds(droppedTextCardIds);
        setTextCardReleaseAnimation({ active: false, cards: releaseCards });
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setTextCardReleaseAnimation((current) =>
              current ? { ...current, active: true } : current,
            );
          });
        });
        window.setTimeout(() => {
          setTextCardReleaseAnimation(null);
          setSettlingTextCardIds((current) =>
            current.filter((id) => !droppedTextCardIdSet.has(id)),
          );
        }, 240);
      }
      updateTextCardDropPreview(null);
      setTextCardDetachedContainerId(null);
      textCardDragCenterYRef.current = null;
    }

    if (dragState.type === "select") {
      const endPoint = canvasPointFromEvent(event);
      const left = Math.min(dragState.startX, endPoint.x);
      const top = Math.min(dragState.startY, endPoint.y);
      const right = Math.max(dragState.startX, endPoint.x);
      const bottom = Math.max(dragState.startY, endPoint.y);
      const tinySelection = right - left < 4 && bottom - top < 4;
      const selectedDuringDrag = [
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
        ...textBlocks
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
        ...looseImages
          .filter((image) =>
            rectsOverlap(
              { left, top, width: right - left, height: bottom - top },
              {
                left: image.x,
                top: image.y,
                width: image.width,
                height: image.height,
              },
            ),
          )
          .map((image) => image.id),
      ];

      if (!tinySelection) {
        applySelection(selectedDuringDrag, dragState.additive);
      } else if (!dragState.additive) {
        setSelectedIds([]);
      }
    }

    if (dragState.type === "container-select") {
      const endPoint = canvasPointFromEvent(event);
      const left = Math.min(dragState.startX, endPoint.x);
      const top = Math.min(dragState.startY, endPoint.y);
      const right = Math.max(dragState.startX, endPoint.x);
      const bottom = Math.max(dragState.startY, endPoint.y);
      const tinySelection = right - left < 4 && bottom - top < 4;
      const container = containersById.get(dragState.containerId);
      const selectedDuringDrag =
        container && !tinySelection
          ? getContainerVisibleTextCards(container)
              .filter((card) => {
                const bounds = getTextCardRippleBounds(card);
                return bounds
                  ? rectsOverlap({ left, top, width: right - left, height: bottom - top }, bounds)
                  : false;
              })
              .map((card) => card.id)
          : [];

      if (!tinySelection && container) {
        applySelection(selectedDuringDrag, dragState.additive);
      } else if (!dragState.additive) {
        setSelectedIds([]);
      }
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

    const nextZoom = getWheelZoom(zoom, event.deltaY);
    const canvasX = (event.clientX - pan.x) / zoom;
    const canvasY = (event.clientY - pan.y) / zoom;
    const nextPan = {
      x: event.clientX - canvasX * nextZoom,
      y: event.clientY - canvasY * nextZoom,
    };

    setZoom(nextZoom);
    setPan(nextPan);
    setDragState((current) => {
      if (!current) {
        return current;
      }

      if (current.type === "pan") {
        return {
          ...current,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startPanX: nextPan.x,
          startPanY: nextPan.y,
        };
      }

      if (current.type === "move") {
        const movingContainerIds = new Set(current.startPositions.map((position) => position.id));
        const movingTextCardIds = new Set(current.textCardStartPositions.map((position) => position.id));
        const movingTextBlockIds = new Set(current.textBlockStartPositions.map((position) => position.id));
        const movingImageIds = new Set(current.imageStartPositions.map((position) => position.id));

        return {
          ...current,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startPositions: elements
            .filter((element) => movingContainerIds.has(element.id))
            .map((element) => ({ id: element.id, x: element.x, y: element.y })),
          textCardStartPositions: textCards
            .filter((card) => movingTextCardIds.has(card.id))
            .map((card) => ({ id: card.id, x: card.x, y: card.y })),
          textBlockStartPositions: textBlocks
            .filter((element) => movingTextBlockIds.has(element.id))
            .map((element) => ({ id: element.id, x: element.x, y: element.y })),
          imageStartPositions: images
            .filter((image) => movingImageIds.has(image.id))
            .map((image) => ({ id: image.id, x: image.x, y: image.y })),
        };
      }

      if (current.type === "text-card-move") {
        const activeCard = textCards.find((card) => card.id === current.id);
        const activeOffset = current.cardOffsets.find((offset) => offset.id === current.id);
        if (!activeCard) {
          return current;
        }

        return {
          ...current,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startX: activeCard.x - (activeOffset?.x ?? 0),
          startY: activeCard.y - (activeOffset?.y ?? 0),
          lastClientX: event.clientX,
          lastClientY: event.clientY,
          swayX: 0,
          swayY: 0,
        };
      }

      if (current.type === "image-move") {
        const activeImage = images.find((image) => image.id === current.id);
        if (!activeImage) {
          return current;
        }

        return {
          ...current,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startX: activeImage.x,
          startY: activeImage.y,
        };
      }

      return current;
    });
  };

  const isElementLocked = (id: string) =>
    Boolean(
      (
        containersById.get(id) ??
        textBlocksById.get(id) ??
        textCardsById.get(id) ??
        imagesById.get(id)
      )?.extensions?.lock?.enabled,
    );

  const startMove = (event: PointerEvent<HTMLElement>, element: ContainerElement | TextBlockElement) => {
    if (event.button !== 0) {
      return;
    }

    if (event.shiftKey) {
      event.stopPropagation();
      selectCanvasElement(element, true);
      closeContextMenus();
      return;
    }

    if (isElementLocked(element.id)) {
      event.stopPropagation();
      selectCanvasElement(element);
      closeContextMenus();
      return;
    }

    event.stopPropagation();
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    const movingIds = selectedIds.includes(element.id) ? selectedIds : [element.id];
    const movingContainerIds = movingIds.filter((id) => containersById.has(id));
    const movingTextBlockIds = movingIds.filter((id) => textBlocksById.has(id));
    const movingTextCardIds = movingIds.filter((id) => {
      const card = textCardsById.get(id);
      return Boolean(card && !card.containerId);
    });
    const movingImageIds = movingIds.filter((id) => imagesById.has(id));
    if (!selectedIds.includes(element.id)) {
      selectCanvasElement(element);
    }
    closeContextMenus();
    setRenamingId(null);
    if (editingTextBlockId) {
      saveTextBlockEdit(editingTextBlockId);
    }
    setEditingTextBlockId(null);
    setDragState({
      type: "move",
      pointerId: event.pointerId,
      id: element.id,
      ids: [...movingContainerIds, ...movingTextBlockIds],
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
      textBlockStartPositions: textBlocks
        .filter((currentElement) => movingTextBlockIds.includes(currentElement.id))
        .map((currentElement) => ({
          id: currentElement.id,
          x: currentElement.x,
          y: currentElement.y,
        })),
      imageStartPositions: images
        .filter((image) => movingImageIds.includes(image.id))
        .map((image) => ({
          id: image.id,
          x: image.x,
          y: image.y,
        })),
    });
  };

  const startResize = (event: PointerEvent<HTMLButtonElement>, element: ContainerElement | TextBlockElement) => {
    if (event.button !== 0) {
      return;
    }

    if (isElementLocked(element.id)) {
      event.stopPropagation();
      return;
    }

    event.stopPropagation();
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    selectCanvasElement(element);
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

    if (event.shiftKey) {
      event.stopPropagation();
      addIdsToSelection([card.id]);
      closeContextMenus();
      return;
    }

    if (isElementLocked(card.id)) {
      event.stopPropagation();
      setSelectedIds([card.id]);
      closeContextMenus();
      return;
    }

    event.stopPropagation();
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );

    if (!card.containerId && selectedIds.length > 1 && selectedIds.includes(card.id)) {
      const movingIds = selectedIds.includes(card.id) ? selectedIds : [card.id];
      const movingContainerIds = movingIds.filter((id) => containersById.has(id));
      const movingTextBlockIds = movingIds.filter((id) => textBlocksById.has(id));
      const movingTextCardIds = movingIds.filter((id) => {
        const currentCard = textCardsById.get(id);
        return Boolean(currentCard && !currentCard.containerId);
      });
      const movingImageIds = movingIds.filter((id) => imagesById.has(id));
      const cardRect = event.currentTarget.getBoundingClientRect();

      if (!selectedIds.includes(card.id)) {
        setSelectedIds([card.id]);
      }

      closeContextMenus();
      setRenamingId(null);
      setEditingTextCardId(null);
      setEditingTextBlockId(null);
      setDragState({
        type: "move",
        pointerId: event.pointerId,
        id: card.id,
        ids: [...movingContainerIds, ...movingTextBlockIds],
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
        textBlockStartPositions: textBlocks
          .filter((element) => movingTextBlockIds.includes(element.id))
          .map((element) => ({
            id: element.id,
            x: element.x,
            y: element.y,
          })),
        imageStartPositions: images
          .filter((image) => movingImageIds.includes(image.id))
          .map((image) => ({
            id: image.id,
            x: image.x,
            y: image.y,
          })),
      });
      return;
    }

    closeContextMenus();
    setRenamingId(null);
    setEditingTextCardId(null);
    setEditingTextBlockId(null);
    const bundleCards =
      card.containerId && selectedIds.includes(card.id)
        ? getOrderedContainerTextCards(card.containerId).filter((currentCard) =>
            selectedIds.includes(currentCard.id),
          )
        : [card];
    const movableBundleCards = bundleCards.filter((currentCard) => !isElementLocked(currentCard.id));
    const draggedCards = movableBundleCards.length > 0 ? movableBundleCards : [card];
    const draggedIds = draggedCards.map((currentCard) => currentCard.id);
    if (draggedIds.length === 1) {
      setSelectedIds([]);
    } else {
      setSelectedIds(draggedIds);
    }
    const startPosition = getTextCardStackPosition(card);
    const stackedCards = [card, ...draggedCards.filter((currentCard) => currentCard.id !== card.id)];
    const cardOffsets = stackedCards.map((currentCard, index) => {
      const originalPosition = getTextCardStackPosition(currentCard);
      const x = index === 0 ? 0 : ((index % 2 === 0 ? -1 : 1) * (5 + Math.min(index, 4) * 2));
      const y = index === 0 ? 0 : Math.min(index, 5) * 4;
      return {
        id: currentCard.id,
        x,
        y,
        pickupX: originalPosition.x - (startPosition.x + x),
        pickupY: originalPosition.y - (startPosition.y + y),
      };
    });
    setTextCards((current) =>
      current.map((currentCard) =>
        draggedIds.includes(currentCard.id)
          ? {
              ...currentCard,
              x: startPosition.x + (cardOffsets.find((offset) => offset.id === currentCard.id)?.x ?? 0),
              y: startPosition.y + (cardOffsets.find((offset) => offset.id === currentCard.id)?.y ?? 0),
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
      ids: draggedIds,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: startPosition.x,
      startY: startPosition.y,
      cardOffsets,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      swayX: 0,
      swayY: 0,
      startContainerId: card.containerId,
      pointerOffsetY,
      width: cardRect.width / zoom,
      height: cardRect.height / zoom,
      snapping: false,
    });
  };

  const startImageMove = (event: PointerEvent<HTMLElement>, image: ImageElement) => {
    if (event.button !== 0) {
      return;
    }

    if (event.shiftKey) {
      event.stopPropagation();
      addIdsToSelection([image.id]);
      closeContextMenus();
      return;
    }

    if (isElementLocked(image.id)) {
      event.stopPropagation();
      setSelectedIds([image.id]);
      closeContextMenus();
      return;
    }

    event.stopPropagation();
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );

    // Part of a multi-selection → use the shared container/card/block move path.
    if (selectedIds.length > 1 && selectedIds.includes(image.id)) {
      const movingIds = selectedIds;
      const movingContainerIds = movingIds.filter((id) => containersById.has(id));
      const movingTextBlockIds = movingIds.filter((id) => textBlocksById.has(id));
      const movingTextCardIds = movingIds.filter((id) => {
        const card = textCardsById.get(id);
        return Boolean(card && !card.containerId);
      });
      const movingImageIds = movingIds.filter((id) => imagesById.has(id));

      closeContextMenus();
      setRenamingId(null);
      setEditingTextCardId(null);
      setEditingTextBlockId(null);
      setDragState({
        type: "move",
        pointerId: event.pointerId,
        id: image.id,
        ids: [...movingContainerIds, ...movingTextBlockIds],
        activeWidth: image.width,
        activeHeight: image.height,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPositions: elements
          .filter((element) => movingContainerIds.includes(element.id))
          .map((element) => ({ id: element.id, x: element.x, y: element.y })),
        textCardStartPositions: textCards
          .filter((card) => movingTextCardIds.includes(card.id) && !card.containerId)
          .map((card) => ({ id: card.id, x: card.x, y: card.y })),
        textBlockStartPositions: textBlocks
          .filter((element) => movingTextBlockIds.includes(element.id))
          .map((element) => ({ id: element.id, x: element.x, y: element.y })),
        imageStartPositions: images
          .filter((currentImage) => movingImageIds.includes(currentImage.id))
          .map((currentImage) => ({ id: currentImage.id, x: currentImage.x, y: currentImage.y })),
      });
      return;
    }

    setSelectedIds([image.id]);
    closeContextMenus();
    setRenamingId(null);
    setEditingTextCardId(null);
    setEditingTextBlockId(null);
    setDragState({
      type: "image-move",
      pointerId: event.pointerId,
      id: image.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: image.x,
      startY: image.y,
      width: image.width,
      height: image.height,
      snapping: false,
    });
  };

  const startImageResize = (event: PointerEvent<HTMLButtonElement>, image: ImageElement) => {
    if (event.button !== 0) {
      return;
    }

    if (isElementLocked(image.id)) {
      event.stopPropagation();
      return;
    }

    event.stopPropagation();
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    setSelectedIds([image.id]);
    closeContextMenus();
    setRenamingId(null);
    setDragState({
      type: "image-resize",
      pointerId: event.pointerId,
      id: image.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: image.width,
      startHeight: image.height,
      aspectRatio: image.height > 0 ? image.width / image.height : 1,
    });
  };

  const openImageMenu = (event: React.MouseEvent<HTMLElement>, image: ImageElement) => {
    event.preventDefault();
    event.stopPropagation();
    closeContextMenus();
    setRenamingId(null);
    if (!selectedIds.includes(image.id)) {
      setSelectedIds([image.id]);
    }
    setClosingImageMenu(null);
    setImageMenu({
      id: image.id,
      left: event.clientX + 8,
      top: event.clientY + 8,
    });
  };

  const openTextCardMenu = (event: React.MouseEvent<HTMLElement>, card: TextCardElement) => {
    event.preventDefault();
    event.stopPropagation();
    closeContextMenus();
    setRenamingId(null);
    setEditingTextCardId(null);
    if (!selectedIds.includes(card.id)) {
      setSelectedIds([card.id]);
    }
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

    // Local file paths are kept as-is so they can be opened with the file handler.
    // Windows drive (C:\ or C:/), UNC (\\server\share), or a file:// URI.
    const windowsDrive = /^[a-zA-Z]:[\\/]/.test(trimmed);
    const uncPath = /^\\\\[^\\]/.test(trimmed);
    if (windowsDrive || uncPath) {
      return trimmed;
    }
    if (/^file:/i.test(trimmed)) {
      try {
        return decodeURIComponent(new URL(trimmed).pathname.replace(/^\/([a-zA-Z]:)/, "$1"));
      } catch {
        return undefined;
      }
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

  const openTextBlockMenu = (event: React.MouseEvent<HTMLButtonElement>, element: TextBlockElement) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    if (!selectedIds.includes(element.id)) {
      selectCanvasElement(element);
    }
    setRenamingId(null);
    setRenameDraft(element.name);
    setEditingTextCardId(null);

    if (textBlockMenu?.id === element.id) {
      closeContextMenus();
      return;
    }

    closeContextMenus();
    setClosingTextBlockMenu(null);
    setTextBlockMenu({
      id: element.id,
      left: rect.right + 8,
      top: rect.top,
    });
  };

  const startTextBlockEdit = (element: TextBlockElement, _caretPosition?: number) => {
    setTextBlockDraft(element.text);
    setEditingTextBlockId(element.id);
    setSelectedIds([element.id]);
    setRenamingId(null);
    closeContextMenus();
  };

  const saveTextBlockEdit = (id: string) => {
    const nextText = textBlockDraft.trim();
    if (nextText) {
      setTextBlocks((current) =>
        current.map((element) => (element.id === id ? { ...element, text: nextText } : element)),
      );
    }
    setEditingTextBlockId(null);
    setTextBlockDraft("");
    pulseTextBlock(id);
  };

  const cancelTextBlockEdit = () => {
    if (editingTextBlockId) {
      pulseTextBlock(editingTextBlockId);
    }
    setEditingTextBlockId(null);
    setTextBlockDraft("");
  };

  const updateTextBlockAccent = (id: string, accent: string) => {
    setTextBlocks((current) =>
      current.map((element) => (element.id === id ? { ...element, accent } : element)),
    );
  };

  const deleteTextBlock = (id: string) => {
    removeTextBlocks([id]);
    closeContextMenus();
  };

  const toggleMenu = (event: React.MouseEvent<HTMLButtonElement>, element: ContainerElement) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    if (!selectedIds.includes(element.id)) {
      selectCanvasElement(element);
    }
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

  const startRename = (element: ContainerElement | TextBlockElement) => {
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
    setTextBlocks((current) =>
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

  const getTextCardCopyPosition = (card: TextCardElement) => {
    const position = getTextCardRenderPosition(card) ?? getTextCardStackPosition(card);
    return { x: position.x, y: position.y };
  };

  const copyContextSelection = (id: string) => {
    if (!isMultiContextAction(id)) {
      return false;
    }

    const actionIds = getContextActionIds(id);
    const actionSet = new Set(actionIds);
    const selectedContainerIds = new Set(actionIds.filter((actionId) => containersById.has(actionId)));

    setCopiedItem({
      type: "selection",
      item: {
        containers: elements
          .filter((element) => actionSet.has(element.id))
          .map((element) => ({
            name: element.name,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            accent: element.accent,
            extensions: cloneExtensions(element.extensions),
            textCards: getOrderedContainerTextCards(element.id).map((card) => ({
              text: card.text,
              accent: card.accent,
              link: card.link,
              order: card.order,
              extensions: cloneExtensions(card.extensions),
              sourceId: card.id,
            })),
          })),
        textCards: textCards
          .filter((card) => actionSet.has(card.id) && (!card.containerId || !selectedContainerIds.has(card.containerId)))
          .map((card) => {
            const position = getTextCardCopyPosition(card);
            return {
              text: card.text,
              accent: card.accent,
              link: card.link,
              x: position.x,
              y: position.y,
              order: card.order,
              extensions: cloneExtensions(card.extensions),
            };
          }),
        textBlocks: textBlocks
          .filter((element) => actionSet.has(element.id))
          .map((element) => ({
            name: element.name,
            text: element.text,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            accent: element.accent,
            extensions: cloneExtensions(element.extensions),
          })),
        images: images
          .filter((image) => actionSet.has(image.id) && (!image.containerId || !selectedContainerIds.has(image.containerId)))
          .map((image) => ({
            imageId: image.imageId,
            format: image.format,
            x: image.x,
            y: image.y,
            width: image.width,
            height: image.height,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            accent: image.accent,
            background: image.background,
            extensions: cloneExtensions(image.extensions),
          })),
      },
    });
    closeContextMenus();
    return true;
  };

  const copyContainer = (element: ContainerElement) => {
    if (copyContextSelection(element.id)) {
      return;
    }

    setCopiedItem({
      type: "container",
      item: {
        name: element.name,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        accent: element.accent,
        extensions: cloneExtensions(element.extensions),
        textCards: getOrderedContainerTextCards(element.id).map((card) => ({
          text: card.text,
          accent: card.accent,
          link: card.link,
          order: card.order,
          extensions: cloneExtensions(card.extensions),
          sourceId: card.id,
        })),
      },
    });
    closeContextMenus();
  };

  const copyTextCard = (card: TextCardElement) => {
    if (copyContextSelection(card.id)) {
      return;
    }

    const position = getTextCardCopyPosition(card);
    setCopiedItem({
      type: "text-card",
      item: {
        text: card.text,
        accent: card.accent,
        link: card.link,
        x: position.x,
        y: position.y,
        extensions: cloneExtensions(card.extensions),
      },
    });
    closeContextMenus();
  };

  const copyTextBlock = (element: TextBlockElement) => {
    if (copyContextSelection(element.id)) {
      return;
    }

    setCopiedItem({
      type: "text-block",
      item: {
        name: element.name,
        text: element.text,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        accent: element.accent,
        extensions: cloneExtensions(element.extensions),
      },
    });
    closeContextMenus();
  };

  const pasteCopiedItem = (clientX: number, clientY: number, targetContainerId?: string) => {
    if (!copiedItem) {
      return;
    }

    const point = canvasPointFromEvent({ clientX, clientY });

    if (copiedItem.type === "container") {
      const copiedContainer = copiedItem.item;
      const pasteSeed = Date.now();
      const id = `container-${pasteSeed}`;
      const textCardIdMap = new Map<string, string>(
        copiedContainer.textCards
          .filter((card) => card.sourceId)
          .map((card, index): [string, string] => [
            card.sourceId as string,
            `text-card-${pasteSeed}-${index}`,
          ]),
      );
      const duplicate = {
        ...copiedContainer,
        id,
        name: `${copiedContainer.name} copy`,
        x: clamp(point.x - copiedContainer.width / 2, 0, canvasWidth - copiedContainer.width),
        y: clamp(point.y - 28, 0, canvasHeight - copiedContainer.height),
        extensions: remapContainerExtensions(copiedContainer.extensions, textCardIdMap),
      };

      setElements((current) => [...current, duplicate]);
      const pastedTextCards = copiedContainer.textCards.map((card, index) => ({
        id: card.sourceId ? textCardIdMap.get(card.sourceId) ?? `text-card-${pasteSeed}-${index}` : `text-card-${pasteSeed}-${index}`,
        text: card.text,
        x: duplicate.x + CONTAINER_TEXT_CARD_PADDING,
        y:
          getContainerCardStackTop(duplicate) +
          index * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP),
        accent: card.accent,
        link: card.link,
        containerId: id,
        order: card.order ?? index,
        extensions: cloneExtensions(card.extensions),
      }));

      setTextCards((current) => [...current, ...pastedTextCards]);
      pastedTextCards.forEach((card) => animateTextCardIn(card.id));
      setSelectedIds([id]);
      animateContainerIn(id);
    } else if (copiedItem.type === "text-card") {
      const targetContainer = targetContainerId ? containersById.get(targetContainerId) : null;
      const id = `text-card-${Date.now()}`;
      const duplicate = {
        ...copiedItem.item,
        id,
        x: targetContainer ? targetContainer.x + CONTAINER_TEXT_CARD_PADDING : point.x,
        y: targetContainer ? getContainerCardStackTop(targetContainer) : point.y,
        containerId: targetContainer?.id,
        extensions: cloneExtensions(copiedItem.item.extensions),
      };

      if (targetContainer) {
        const order = getTextCardDropIndex(targetContainer, point, textCards, id);
        const cardsOutsideContainer = textCards.filter((currentCard) => currentCard.containerId !== targetContainer.id);
        const containerCards = getOrderedContainerTextCards(targetContainer.id);
        const cardInContainer = {
          ...duplicate,
          y: getContainerCardStackTop(targetContainer) + order * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP),
          order,
        };
        containerCards.splice(order, 0, cardInContainer);
        const nextCards = normalizeTextCardOrders([
          ...cardsOutsideContainer,
          ...containerCards.map((currentCard, index) => ({ ...currentCard, order: index })),
        ]);
        const visibleIndex = getContainerVisibleTextCards(targetContainer, nextCards).findIndex(
          (currentCard) => currentCard.id === id,
        );

        setTextCards(nextCards);
        if (visibleIndex >= 0) {
          setContainerScrollOffsets((current) => ({
            ...current,
            [targetContainer.id]: getScrollOffsetForVisibleCardIndex(targetContainer, visibleIndex, nextCards),
          }));
        }
      } else {
        setTextCards((current) => [...current, duplicate]);
      }
      animateTextCardIn(id);
      setSelectedIds([]);
    } else if (copiedItem.type === "text-block") {
      const copiedTextBlock = copiedItem.item;
      const id = `text-block-${Date.now()}`;
      const duplicate = {
        ...copiedTextBlock,
        id,
        name: `${copiedTextBlock.name} copy`,
        x: clamp(point.x - copiedTextBlock.width / 2, 0, canvasWidth - copiedTextBlock.width),
        y: clamp(point.y - 28, 0, canvasHeight - copiedTextBlock.height),
        extensions: cloneExtensions(copiedTextBlock.extensions),
      };

      setTextBlocks((current) => [...current, duplicate]);
      animateTextBlockIn(id);
      setSelectedIds([id]);
    } else if (copiedItem.type === "image") {
      const copiedImage = copiedItem.item;
      const id = `image-${Date.now()}`;
      const duplicate: ImageElement = {
        ...copiedImage,
        id,
        x: clamp(point.x - copiedImage.width / 2, 0, canvasWidth - copiedImage.width),
        y: clamp(point.y - copiedImage.height / 2, 0, canvasHeight - copiedImage.height),
        extensions: cloneExtensions(copiedImage.extensions),
      };

      setImages((current) => [...current, duplicate]);
      animateImageIn(id);
      setSelectedIds([id]);
    } else if (copiedItem.type === "selection") {
      const copiedSelection = copiedItem.item;
      const positionedItems = [
        ...copiedSelection.containers,
        ...copiedSelection.textCards,
        ...copiedSelection.textBlocks,
        ...copiedSelection.images,
      ].filter((item) => item.x !== undefined && item.y !== undefined);
      if (positionedItems.length === 0) {
        return;
      }
      const originX = Math.min(...positionedItems.map((item) => item.x ?? 0));
      const originY = Math.min(...positionedItems.map((item) => item.y ?? 0));
      const offsetX = point.x - originX;
      const offsetY = point.y - originY;
      const nextSelectedIds: string[] = [];
      const pasteSeed = Date.now();
      const containerTextCardIdMaps = copiedSelection.containers.map(
        (container, containerIndex) =>
          new Map<string, string>(
            container.textCards
              .filter((card) => card.sourceId)
              .map((card, cardIndex): [string, string] => [
                card.sourceId as string,
                `text-card-${pasteSeed}-${containerIndex}-${cardIndex}`,
              ]),
          ),
      );

      const pastedContainers = copiedSelection.containers.map((container, index) => {
        const id = `container-${pasteSeed}-${index}`;
        nextSelectedIds.push(id);
        return {
          ...container,
          id,
          name: `${container.name} copy`,
          x: clamp((container.x ?? point.x) + offsetX, 0, canvasWidth - container.width),
          y: clamp((container.y ?? point.y) + offsetY, 0, canvasHeight - container.height),
          extensions: remapContainerExtensions(container.extensions, containerTextCardIdMaps[index]),
        };
      });
      const pastedContainerCards = pastedContainers.flatMap((container, containerIndex) =>
        copiedSelection.containers[containerIndex].textCards.map((card, cardIndex) => ({
          id: card.sourceId
            ? containerTextCardIdMaps[containerIndex].get(card.sourceId) ??
              `text-card-${pasteSeed}-${containerIndex}-${cardIndex}`
            : `text-card-${pasteSeed}-${containerIndex}-${cardIndex}`,
          text: card.text,
          x: container.x + CONTAINER_TEXT_CARD_PADDING,
          y:
            getContainerCardStackTop(container) +
            cardIndex * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP),
          accent: card.accent,
          link: card.link,
          containerId: container.id,
          order: card.order ?? cardIndex,
          extensions: cloneExtensions(card.extensions),
        })),
      );
      const pastedTextCards = copiedSelection.textCards.map((card, index) => {
        const id = `text-card-${pasteSeed}-selection-${index}`;
        nextSelectedIds.push(id);
        return {
          text: card.text,
          accent: card.accent,
          link: card.link,
          id,
          x: clamp((card.x ?? point.x) + offsetX, 0, canvasWidth),
          y: clamp((card.y ?? point.y) + offsetY, 0, canvasHeight),
          order: card.order,
          extensions: cloneExtensions(card.extensions),
        };
      });
      const pastedTextBlocks = copiedSelection.textBlocks.map((block, index) => {
        const id = `text-block-${pasteSeed}-${index}`;
        nextSelectedIds.push(id);
        return {
          ...block,
          id,
          name: `${block.name} copy`,
          x: clamp((block.x ?? point.x) + offsetX, 0, canvasWidth - block.width),
          y: clamp((block.y ?? point.y) + offsetY, 0, canvasHeight - block.height),
          extensions: cloneExtensions(block.extensions),
        };
      });
      const pastedImages = copiedSelection.images.map((image, index) => {
        const id = `image-${pasteSeed}-${index}`;
        nextSelectedIds.push(id);
        return {
          ...image,
          id,
          x: clamp((image.x ?? point.x) + offsetX, 0, canvasWidth - image.width),
          y: clamp((image.y ?? point.y) + offsetY, 0, canvasHeight - image.height),
          extensions: cloneExtensions(image.extensions),
        };
      });

      setElements((current) => [...current, ...pastedContainers]);
      setTextCards((current) => [...current, ...pastedContainerCards, ...pastedTextCards]);
      setTextBlocks((current) => [...current, ...pastedTextBlocks]);
      setImages((current) => [...current, ...pastedImages]);
      pastedContainers.forEach((container) => animateContainerIn(container.id));
      [...pastedContainerCards, ...pastedTextCards].forEach((card) => animateTextCardIn(card.id));
      pastedTextBlocks.forEach((block) => animateTextBlockIn(block.id));
      pastedImages.forEach((image) => animateImageIn(image.id));
      setSelectedIds(nextSelectedIds);
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
    removeTextBlocks(textBlocks.map((element) => element.id));
    removeImages(images.map((image) => image.id));
    closeContextMenus();
    setRenamingId(null);
    setEditingTextCardId(null);
    setEditingTextBlockId(null);
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

  const getContextActionIds = (id: string) =>
    selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : [id];

  const isMultiContextAction = (id: string) => selectedIds.length > 1 && selectedIds.includes(id);

  const getSelectedExtensionState = (ids: string[]) => {
    const hasExtension = (id: string, key: keyof ElementExtensions) =>
      Boolean(
        (
          containersById.get(id) ??
          textBlocksById.get(id) ??
          textCardsById.get(id) ??
          imagesById.get(id)
        )?.extensions?.[key],
      );

    return {
      privacy: ids.some((id) => hasExtension(id, "privacy")),
      search: ids.some((id) => hasExtension(id, "search")),
      sorting: ids.some((id) => hasExtension(id, "sorting")),
      lock: ids.some((id) => hasExtension(id, "lock")),
      colors: ids.some((id) => hasExtension(id, "colors")),
      colorPicker: ids.some((id) => hasExtension(id, "colorPicker")),
      checkbox: ids.some((id) => hasExtension(id, "checkbox")),
      dailyReset: ids.some((id) => hasExtension(id, "dailyReset")),
      counter: ids.some((id) => hasExtension(id, "counter")),
      inheritCardColor: ids.some((id) => hasExtension(id, "inheritCardColor")),
      pickCard: ids.some((id) => hasExtension(id, "pickCard")),
    };
  };

  const getElementAccentForKind = (accent: string, kind: "text-card" | "other") => {
    const preset = ALL_ACCENT_PRESETS.find(
      (currentPreset) => currentPreset.accent === accent || currentPreset.textCardAccent === accent,
    );
    return kind === "text-card" ? preset?.textCardAccent ?? accent : preset?.accent ?? accent;
  };

  const updateContextAccent = (id: string, accent: string) => {
    const actionIds = getContextActionIds(id);
    const actionSet = new Set(actionIds);

    setElements((current) =>
      current.map((element) =>
        actionSet.has(element.id) ? { ...element, accent: getElementAccentForKind(accent, "other") } : element,
      ),
    );
    setTextBlocks((current) =>
      current.map((element) =>
        actionSet.has(element.id) ? { ...element, accent: getElementAccentForKind(accent, "other") } : element,
      ),
    );
    setTextCards((current) =>
      current.map((card) =>
        actionSet.has(card.id) ? { ...card, accent: getElementAccentForKind(accent, "text-card") } : card,
      ),
    );
    setImages((current) =>
      current.map((image) =>
        actionSet.has(image.id) ? { ...image, accent: getElementAccentForKind(accent, "other") } : image,
      ),
    );
  };

  const stripContextExtension = (id: string, key: keyof ElementExtensions) => {
    const actionSet = new Set(getContextActionIds(id));
    const strip = <T extends { id: string; extensions?: ElementExtensions }>(item: T): T => {
      if (!actionSet.has(item.id) || !item.extensions?.[key]) {
        return item;
      }

      const { [key]: _removed, ...extensions } = item.extensions;
      return { ...item, extensions };
    };

    setElements((current) => current.map(strip));
    setTextBlocks((current) => current.map(strip));
    setTextCards((current) => current.map(strip));
    setImages((current) => current.map(strip));
    if (key === "search" || key === "sorting") {
      setContainerScrollOffsets((current) => {
        const next = { ...current };
        actionSet.forEach((actionId) => {
          next[actionId] = 0;
        });
        return next;
      });
    }
    closeContextMenus();
  };

  const deleteContextSelection = (id: string) => {
    const actionIds = getContextActionIds(id);
    const selectedContainerIds = actionIds.filter((actionId) => containersById.has(actionId));
    const selectedContainerIdSet = new Set(selectedContainerIds);

    removeContainers(selectedContainerIds);
    removeTextCards(
      actionIds.filter((actionId) => {
        const card = textCardsById.get(actionId);
        return Boolean(card && (!card.containerId || !selectedContainerIdSet.has(card.containerId)));
      }),
    );
    removeTextBlocks(actionIds.filter((actionId) => textBlocksById.has(actionId)));
    removeImages(
      actionIds.filter((actionId) => {
        const image = imagesById.get(actionId);
        return Boolean(image && (!image.containerId || !selectedContainerIdSet.has(image.containerId)));
      }),
    );
    closeContextMenus();
    setRenamingId(null);
  };

  const installPrivacyExtensions = (ids: string[]) => {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) {
      return;
    }

    setElements((current) =>
      current.map((element) =>
        targetIds.has(element.id)
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                privacy: element.extensions?.privacy ?? { enabled: true },
              },
            }
          : element,
      ),
    );
    setTextBlocks((current) =>
      current.map((element) =>
        targetIds.has(element.id)
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                privacy: element.extensions?.privacy ?? { enabled: true },
              },
            }
          : element,
      ),
    );
    closeContextMenus();
  };

  const installPrivacyExtension = (id: string) => {
    installPrivacyExtensions([id]);
  };

  const installSearchExtensions = (ids: string[]) => {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) {
      return;
    }

    setElements((current) =>
      current.map((element) =>
        targetIds.has(element.id)
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                search: element.extensions?.search ?? { query: "" },
              },
            }
          : element,
      ),
    );
    closeContextMenus();
  };

  const installSearchExtension = (id: string) => {
    installSearchExtensions([id]);
  };

  const installSortingExtensions = (ids: string[]) => {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) {
      return;
    }

    setElements((current) =>
      current.map((element) =>
        targetIds.has(element.id)
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                sorting: element.extensions?.sorting ?? { mode: null, direction: "asc" },
              },
            }
          : element,
      ),
    );
    closeContextMenus();
  };

  const installSortingExtension = (id: string) => {
    installSortingExtensions([id]);
  };

  const togglePrivacyExtension = (id: string) => {
    setElements((current) =>
      current.map((element) =>
        element.id === id && element.extensions?.privacy
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                privacy: {
                  enabled: !element.extensions.privacy.enabled,
                },
              },
            }
          : element,
      ),
    );
    setTextBlocks((current) =>
      current.map((element) =>
        element.id === id && element.extensions?.privacy
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                privacy: {
                  enabled: !element.extensions.privacy.enabled,
                },
              },
            }
          : element,
      ),
    );
  };

  const removePrivacyExtension = (id: string) => {
    setElements((current) =>
      current.map((element) => {
        if (element.id !== id || !element.extensions?.privacy) {
          return element;
        }

        const { privacy: _privacy, ...extensions } = element.extensions;
        return {
          ...element,
          extensions,
        };
      }),
    );
    setTextBlocks((current) =>
      current.map((element) => {
        if (element.id !== id || !element.extensions?.privacy) {
          return element;
        }

        const { privacy: _privacy, ...extensions } = element.extensions;
        return {
          ...element,
          extensions,
        };
      }),
    );
    closeContextMenus();
  };

  const installLockExtensions = (ids: string[]) => {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) {
      return;
    }

    const withLock = <T extends { id: string; extensions?: ElementExtensions }>(item: T): T =>
      targetIds.has(item.id)
        ? {
            ...item,
            extensions: {
              ...item.extensions,
              lock: item.extensions?.lock ?? { enabled: true },
            },
          }
        : item;
    setElements((current) => current.map(withLock));
    setTextBlocks((current) => current.map(withLock));
    setTextCards((current) => current.map(withLock));
    setImages((current) => current.map(withLock));
    closeContextMenus();
  };

  const installLockExtension = (id: string) => {
    installLockExtensions([id]);
  };

  const toggleLockExtension = (id: string) => {
    const toggle = <T extends { id: string; extensions?: ElementExtensions }>(item: T): T =>
      item.id === id && item.extensions?.lock
        ? {
            ...item,
            extensions: {
              ...item.extensions,
              lock: { enabled: !item.extensions.lock.enabled },
            },
          }
        : item;
    setElements((current) => current.map(toggle));
    setTextBlocks((current) => current.map(toggle));
    setTextCards((current) => current.map(toggle));
    setImages((current) => current.map(toggle));
  };

  const removeLockExtension = (id: string) => {
    const stripLock = <T extends { id: string; extensions?: ElementExtensions }>(item: T): T => {
      if (item.id !== id || !item.extensions?.lock) {
        return item;
      }
      const { lock: _lock, ...extensions } = item.extensions;
      return { ...item, extensions };
    };
    setElements((current) => current.map(stripLock));
    setTextBlocks((current) => current.map(stripLock));
    setTextCards((current) => current.map(stripLock));
    setImages((current) => current.map(stripLock));
    closeContextMenus();
  };

  const installColorsExtensions = (ids: string[]) => {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) {
      return;
    }

    setElements((current) =>
      current.map((element) =>
        targetIds.has(element.id)
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                colors: element.extensions?.colors ?? { enabled: true },
              },
            }
          : element,
      ),
    );
    setTextBlocks((current) =>
      current.map((element) =>
        targetIds.has(element.id)
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                colors: element.extensions?.colors ?? { enabled: true },
              },
            }
          : element,
      ),
    );
    setTextCards((current) =>
      current.map((card) =>
        targetIds.has(card.id)
          ? {
              ...card,
              extensions: {
                ...card.extensions,
                colors: card.extensions?.colors ?? { enabled: true },
              },
            }
          : card,
      ),
    );
    setImages((current) =>
      current.map((image) =>
        targetIds.has(image.id)
          ? {
              ...image,
              extensions: {
                ...image.extensions,
                colors: image.extensions?.colors ?? { enabled: true },
              },
            }
          : image,
      ),
    );
    closeContextMenus();
  };

  const installColorsExtension = (id: string) => {
    installColorsExtensions([id]);
  };

  const installColorPickerExtensions = (ids: string[]) => {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) {
      return;
    }

    const withColorPicker = <T extends { id: string; extensions?: ElementExtensions }>(item: T): T =>
      targetIds.has(item.id)
        ? {
            ...item,
            extensions: {
              ...item.extensions,
              colorPicker: item.extensions?.colorPicker ?? { enabled: true },
            },
          }
        : item;
    setElements((current) => current.map(withColorPicker));
    setTextBlocks((current) => current.map(withColorPicker));
    closeContextMenus();
  };

  const getColorAtClientPoint = (clientX: number, clientY: number) => {
    const transparent = new Set(["transparent", "rgba(0, 0, 0, 0)", "rgba(0,0,0,0)"]);
    const elementsAtPoint = document.elementsFromPoint(clientX, clientY);

    for (const node of elementsAtPoint) {
      if (!(node instanceof HTMLElement) || node.closest("[data-color-picker-tool]")) {
        continue;
      }

      const style = window.getComputedStyle(node);
      const candidates = [style.backgroundColor, style.borderTopColor];
      const color = candidates.find((candidate) => candidate && !transparent.has(candidate));
      if (color) {
        return color;
      }
    }

    return "#111216";
  };

  const applyPickedColor = (id: string, color: string) => {
    setElements((current) =>
      current.map((element) => (element.id === id ? { ...element, accent: color } : element)),
    );
    setTextBlocks((current) =>
      current.map((element) => (element.id === id ? { ...element, accent: color } : element)),
    );
  };

  const pickElementColor = async (id: string) => {
    const EyeDropperApi = (
      window as typeof window & { EyeDropper?: EyeDropperConstructor }
    ).EyeDropper;

    if (EyeDropperApi) {
      setColorPickerTargetId(null);
      setColorPickerPreview(null);

      try {
        const { sRGBHex } = await new EyeDropperApi().open();
        applyPickedColor(id, sRGBHex);
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== "AbortError") {
          setColorPickerTargetId(id);
        }
      }
      return;
    }

    setColorPickerTargetId(id);
    setColorPickerPreview(null);
  };

  const handleColorPickerPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!colorPickerTargetId) {
      return;
    }

    setColorPickerPreview({
      clientX: event.clientX,
      clientY: event.clientY,
      color: getColorAtClientPoint(event.clientX, event.clientY),
    });
  };

  const applyColorPickerSelection = (event: PointerEvent<HTMLElement>) => {
    if (
      !colorPickerTargetId ||
      event.button !== 0
    ) {
      return false;
    }

    const color = getColorAtClientPoint(event.clientX, event.clientY);
    const targetId = colorPickerTargetId;
    event.preventDefault();
    event.stopPropagation();
    applyPickedColor(targetId, color);
    setColorPickerTargetId(null);
    setColorPickerPreview(null);
    return true;
  };

  const installDailyResetExtensions = (ids: string[]) => {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) {
      return;
    }

    const today = getLocalDateKey();
    setElements((current) =>
      current.map((element) =>
        targetIds.has(element.id)
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                dailyReset: element.extensions?.dailyReset ?? { lastResetDate: today },
              },
            }
          : element,
      ),
    );
    closeContextMenus();
  };

  const installCounterExtensions = (ids: string[]) => {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) {
      return;
    }

    setElements((current) =>
      current.map((element) =>
        targetIds.has(element.id)
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                counter: element.extensions?.counter ?? { enabled: true },
              },
            }
          : element,
      ),
    );
    closeContextMenus();
  };

  const installInheritCardColorExtensions = (ids: string[]) => {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) {
      return;
    }

    setElements((current) =>
      current.map((element) =>
        targetIds.has(element.id)
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                inheritCardColor: element.extensions?.inheritCardColor ?? { enabled: true },
              },
            }
          : element,
      ),
    );
    closeContextMenus();
  };

  const installPickCardExtensions = (ids: string[]) => {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) {
      return;
    }

    setElements((current) =>
      current.map((element) =>
        targetIds.has(element.id)
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                pickCard: element.extensions?.pickCard ?? {},
              },
            }
          : element,
      ),
    );
    closeContextMenus();
  };

  const togglePickedContainerCard = (id: string) => {
    const container = containersById.get(id);
    if (!container?.extensions?.pickCard) {
      return;
    }

    const selectedCardId = container.extensions.pickCard.selectedCardId;
    const lastCardId = container.extensions.pickCard.lastCardId;
    const allCards = getOrderedContainerTextCards(id);
    const availableCards = allCards.filter((card) => card.id !== lastCardId);
    const randomPool = availableCards.length > 0 ? availableCards : allCards;
    const nextSelectedCardId = selectedCardId
      ? undefined
      : randomPool[Math.floor(Math.random() * randomPool.length)]?.id;

    setElements((current) =>
      current.map((element) =>
        element.id === id && element.extensions?.pickCard
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                pickCard: {
                  selectedCardId: nextSelectedCardId,
                  lastCardId: selectedCardId ?? nextSelectedCardId ?? lastCardId,
                },
              },
            }
          : element,
      ),
    );
    setContainerScrollOffsets((current) => ({ ...current, [id]: 0 }));
    if (nextSelectedCardId) {
      window.requestAnimationFrame(() => glowTextCard(nextSelectedCardId));
    }
  };

  const removeColorsExtension = (id: string) => {
    setElements((current) =>
      current.map((element) => {
        if (element.id !== id || !element.extensions?.colors) {
          return element;
        }

        const { colors: _colors, ...extensions } = element.extensions;
        return {
          ...element,
          extensions,
        };
      }),
    );
    setTextBlocks((current) =>
      current.map((element) => {
        if (element.id !== id || !element.extensions?.colors) {
          return element;
        }

        const { colors: _colors, ...extensions } = element.extensions;
        return {
          ...element,
          extensions,
        };
      }),
    );
    setTextCards((current) =>
      current.map((card) => {
        if (card.id !== id || !card.extensions?.colors) {
          return card;
        }

        const { colors: _colors, ...extensions } = card.extensions;
        return {
          ...card,
          extensions,
        };
      }),
    );
    setImages((current) =>
      current.map((image) => {
        if (image.id !== id || !image.extensions?.colors) {
          return image;
        }

        const { colors: _colors, ...extensions } = image.extensions;
        return {
          ...image,
          extensions,
        };
      }),
    );
    closeContextMenus();
  };

  const installCheckboxExtensions = (ids: string[]) => {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) {
      return;
    }

    setTextCards((current) =>
      current.map((card) =>
        targetIds.has(card.id)
          ? {
              ...card,
              extensions: {
                ...card.extensions,
                checkbox: card.extensions?.checkbox ?? { checked: false },
              },
            }
          : card,
      ),
    );
    closeContextMenus();
  };

  const toggleTextCardCheckbox = (id: string) => {
    setTextCards((current) =>
      current.map((card) =>
        card.id === id && card.extensions?.checkbox
          ? {
              ...card,
              extensions: {
                ...card.extensions,
                checkbox: {
                  checked: !card.extensions.checkbox.checked,
                },
              },
            }
          : card,
      ),
    );
  };

  const updateContainerSearchQuery = (id: string, query: string) => {
    setElements((current) =>
      current.map((element) =>
        element.id === id && element.extensions?.search
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                search: {
                  query,
                },
              },
            }
          : element,
      ),
    );
    setContainerScrollOffsets((current) => ({
      ...current,
      [id]: 0,
    }));
  };

  const removeSearchExtension = (id: string) => {
    setElements((current) =>
      current.map((element) => {
        if (element.id !== id || !element.extensions?.search) {
          return element;
        }

        const { search: _search, ...extensions } = element.extensions;
        return {
          ...element,
          extensions,
        };
      }),
    );
    setContainerScrollOffsets((current) => ({
      ...current,
      [id]: 0,
    }));
    closeContextMenus();
  };

  const setContainerSort = (
    id: string,
    mode: "alphabet" | "color" | null,
    direction: "asc" | "desc" = "asc",
  ) => {
    setElements((current) =>
      current.map((element) => {
        const sorting = element.extensions?.sorting;
        if (element.id !== id || !sorting) {
          return element;
        }

        return {
          ...element,
          extensions: {
            ...element.extensions,
            sorting: { mode, direction },
          },
        };
      }),
    );
    setContainerScrollOffsets((current) => ({
      ...current,
      [id]: 0,
    }));
  };

  const removeSortingExtension = (id: string) => {
    setElements((current) =>
      current.map((element) => {
        if (element.id !== id || !element.extensions?.sorting) {
          return element;
        }

        const { sorting: _sorting, ...extensions } = element.extensions;
        return {
          ...element,
          extensions,
        };
      }),
    );
    setContainerScrollOffsets((current) => ({
      ...current,
      [id]: 0,
    }));
    closeContextMenus();
  };

  const showExtensionDropRipple = (
    extensionId: ExtensionId,
    point: { x: number; y: number },
    target: ExtensionDropRipple["target"],
    bounds: ExtensionRippleBounds,
  ) => {
    const id = `extension-ripple-${Date.now()}-${Math.round(point.x)}-${Math.round(point.y)}`;
    setExtensionDropRipples((current) => [
      ...current,
      {
        id,
        extensionId,
        target,
        offsetX: point.x - bounds.left,
        offsetY: point.y - bounds.top,
        bounds,
      },
    ]);
    window.setTimeout(() => {
      setExtensionDropRipples((current) => current.filter((ripple) => ripple.id !== id));
    }, 620);
  };

  const getExtensionTargetType = (id: string): ExtensionTargetType | null => {
    if (containersById.has(id)) {
      return "container";
    }
    if (textBlocksById.has(id)) {
      return "text-block";
    }
    if (textCardsById.has(id)) {
      return "text-card";
    }
    if (imagesById.has(id)) {
      return "image";
    }
    return null;
  };

  const getExtensionRippleTarget = (id: string): ExtensionDropRipple["target"] | null => {
    const targetType = getExtensionTargetType(id);
    if (!targetType) {
      return null;
    }

    return { type: targetType, id };
  };

  const getExtensionTargetBounds = (target: ExtensionDropRipple["target"]): ExtensionRippleBounds | null => {
    if (target.type === "container") {
      const element = containersById.get(target.id);
      return element
        ? { left: element.x, top: element.y, width: element.width, height: element.height }
        : null;
    }

    if (target.type === "text-block") {
      const element = textBlocksById.get(target.id);
      return element
        ? { left: element.x, top: element.y, width: element.width, height: element.height }
        : null;
    }

    if (target.type === "image") {
      const image = imagesById.get(target.id);
      return image
        ? { left: image.x, top: image.y, width: image.width, height: image.height }
        : null;
    }

    const card = textCardsById.get(target.id);
    return card ? getTextCardRippleBounds(card) : null;
  };

  const getExtensionHoverTargetAtPoint = (
    point: { x: number; y: number },
  ): { target: ExtensionDropRipple["target"]; bounds: ExtensionRippleBounds } | null => {
    const hitBounds = (bounds: ExtensionRippleBounds) =>
      point.x >= bounds.left &&
      point.x <= bounds.left + bounds.width &&
      point.y >= bounds.top &&
      point.y <= bounds.top + bounds.height;

    for (const image of [...looseImages].reverse()) {
      const bounds = { left: image.x, top: image.y, width: image.width, height: image.height };
      if (hitBounds(bounds)) {
        return { target: { type: "image", id: image.id }, bounds };
      }
    }

    for (const card of [...looseTextCards].reverse()) {
      const bounds = getTextCardRippleBounds(card) ?? getLooseTextCardSelectionBounds(card);
      if (hitBounds(bounds)) {
        return { target: { type: "text-card", id: card.id }, bounds };
      }
    }

    for (const container of [...elements].reverse()) {
      const contentTop =
        container.y +
        CONTAINER_HEADER_HEIGHT +
        (container.extensions?.search ? CONTAINER_SEARCH_HEIGHT : 0);
      const contentBottom = container.y + container.height;

      for (const card of [...getContainerVisibleTextCards(container)].reverse()) {
        const bounds = getTextCardRippleBounds(card);
        if (
          bounds &&
          bounds.top < contentBottom &&
          bounds.top + bounds.height > contentTop &&
          hitBounds(bounds)
        ) {
          return { target: { type: "text-card", id: card.id }, bounds };
        }
      }
    }

    for (const element of [...textBlocks].reverse()) {
      const bounds = { left: element.x, top: element.y, width: element.width, height: element.height };
      if (hitBounds(bounds)) {
        return { target: { type: "text-block", id: element.id }, bounds };
      }
    }

    for (const element of [...elements].reverse()) {
      const bounds = { left: element.x, top: element.y, width: element.width, height: element.height };
      if (hitBounds(bounds)) {
        return { target: { type: "container", id: element.id }, bounds };
      }
    }

    return null;
  };

  const handleExtensionDragHover = (
    _extensionId: ExtensionId | null,
    _clientX?: number,
    _clientY?: number,
  ) => {
  };

  const getExtensionDropTargetIds = (extensionId: ExtensionId, target: ExtensionDropRipple["target"]) => {
    if (!selectedIds.includes(target.id) || selectedIds.length <= 1) {
      return [target.id];
    }

    return selectedIds.filter((id) => {
      const targetType = getExtensionTargetType(id);
      return targetType ? EXTENSION_COMPATIBLE_TARGETS[extensionId].has(targetType) : false;
    });
  };

  const installDroppedExtension = (
    extensionId: ExtensionId,
    ids: string[],
  ) => {
    if (extensionId === "privacy") {
      installPrivacyExtensions(ids);
    } else if (extensionId === "lock") {
      installLockExtensions(ids);
    } else if (extensionId === "colors") {
      installColorsExtensions(ids);
    } else if (extensionId === "colorPicker") {
      installColorPickerExtensions(ids);
    } else if (extensionId === "search") {
      installSearchExtensions(ids);
    } else if (extensionId === "checkbox") {
      installCheckboxExtensions(ids);
    } else if (extensionId === "dailyReset") {
      installDailyResetExtensions(ids);
    } else if (extensionId === "counter") {
      installCounterExtensions(ids);
    } else if (extensionId === "inheritCardColor") {
      installInheritCardColorExtensions(ids);
    } else if (extensionId === "pickCard") {
      installPickCardExtensions(ids);
    } else {
      installSortingExtensions(ids);
    }
  };

  const applyDroppedExtension = (
    extensionId: ExtensionId,
    point: { x: number; y: number },
    target: ExtensionDropRipple["target"],
    bounds: ExtensionRippleBounds,
  ) => {
    const targetIds = getExtensionDropTargetIds(extensionId, target);
    installDroppedExtension(extensionId, targetIds);
    if (!selectedIds.includes(target.id)) {
      setSelectedIds([target.id]);
    }

    const showDropRipples = () => {
      targetIds.forEach((targetId) => {
        const rippleTarget = targetId === target.id ? target : getExtensionRippleTarget(targetId);
        if (!rippleTarget) {
          return;
        }

        const rippleBounds =
          getExtensionTargetBounds(rippleTarget) ?? (targetId === target.id ? bounds : null);
        if (!rippleBounds) {
          return;
        }

        const ripplePoint =
          targetId === target.id
            ? point
            : {
                x: rippleBounds.left + rippleBounds.width / 2,
                y: rippleBounds.top + rippleBounds.height / 2,
              };

        showExtensionDropRipple(extensionId, ripplePoint, rippleTarget, rippleBounds);
      });
    };

    if (extensionId === "checkbox") {
      window.requestAnimationFrame(showDropRipples);
    } else {
      showDropRipples();
    }
  };

  const dropExtensionOnCanvas = (
    extensionId: ExtensionId,
    clientX: number,
    clientY: number,
  ) => {
    const point = canvasPointFromEvent({ clientX, clientY });
    if (extensionId === "colors" || extensionId === "lock") {
      const targetImage = [...looseImages].reverse().find(
        (image) =>
          point.x >= image.x &&
          point.x <= image.x + image.width &&
          point.y >= image.y &&
          point.y <= image.y + image.height,
      );

      if (targetImage) {
        applyDroppedExtension(
          extensionId,
          point,
          { type: "image", id: targetImage.id },
          {
            left: targetImage.x,
            top: targetImage.y,
            width: targetImage.width,
            height: targetImage.height,
          },
        );
        return;
      }
    }

    if (extensionId === "colors" || extensionId === "lock" || extensionId === "checkbox") {
      const targetTextCard = [...looseTextCards].reverse().find((card) => {
        const bounds = getTextCardRippleBounds(card) ?? getLooseTextCardSelectionBounds(card);
        return (
          point.x >= bounds.left &&
          point.x <= bounds.left + bounds.width &&
          point.y >= bounds.top &&
          point.y <= bounds.top + bounds.height
        );
      });

      if (targetTextCard) {
        const bounds = getTextCardRippleBounds(targetTextCard);
        if (bounds) {
          applyDroppedExtension(extensionId, point, { type: "text-card", id: targetTextCard.id }, bounds);
        }
        return;
      }

      const targetContainerCard = [...elements]
        .reverse()
        .flatMap((container) => {
          const contentTop =
            container.y +
            CONTAINER_HEADER_HEIGHT +
            (container.extensions?.search ? CONTAINER_SEARCH_HEIGHT : 0);
          const contentBottom = container.y + container.height;
          const cardWidth = Math.max(120, container.width - CONTAINER_TEXT_CARD_PADDING * 2);

          return getContainerVisibleTextCards(container)
            .map((card, index) => {
              const measuredBounds = getTextCardRippleBounds(card);
              const fallbackTop =
                getContainerCardStackTop(container) +
                index * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP) -
                getContainerScrollOffset(container);

              return {
                card,
                left: measuredBounds?.left ?? container.x + CONTAINER_TEXT_CARD_PADDING,
                top: measuredBounds?.top ?? fallbackTop,
                width: measuredBounds?.width ?? cardWidth,
                height: measuredBounds?.height ?? CONTAINER_TEXT_CARD_ROW_HEIGHT,
                visibleTop: contentTop,
                visibleBottom: contentBottom,
              };
            })
            .reverse();
        })
        .find(
          ({ left, top, width, height, visibleTop, visibleBottom }) =>
            top < visibleBottom &&
            top + height > visibleTop &&
            point.x >= left &&
            point.x <= left + width &&
            point.y >= Math.max(top, visibleTop) &&
            point.y <= Math.min(top + height, visibleBottom),
        )?.card;

      if (targetContainerCard) {
        const bounds = getTextCardRippleBounds(targetContainerCard);
        if (bounds) {
          applyDroppedExtension(extensionId, point, { type: "text-card", id: targetContainerCard.id }, bounds);
        }
        return;
      }
    }

    if (
      extensionId === "privacy" ||
      extensionId === "colors" ||
      extensionId === "colorPicker" ||
      extensionId === "lock"
    ) {
      const targetTextBlock = [...textBlocks]
        .reverse()
        .find(
          (element) =>
            point.x >= element.x &&
            point.x <= element.x + element.width &&
            point.y >= element.y &&
            point.y <= element.y + element.height,
        );

      if (targetTextBlock) {
        applyDroppedExtension(
          extensionId,
          point,
          { type: "text-block", id: targetTextBlock.id },
          {
            left: targetTextBlock.x,
            top: targetTextBlock.y,
            width: targetTextBlock.width,
            height: targetTextBlock.height,
          },
        );
        return;
      }
    }

    const targetContainer = [...elements]
      .reverse()
      .find(
        (element) =>
          point.x >= element.x &&
          point.x <= element.x + element.width &&
          point.y >= element.y &&
          point.y <= element.y + element.height,
      );

    if (targetContainer && EXTENSION_COMPATIBLE_TARGETS[extensionId].has("container")) {
      applyDroppedExtension(
        extensionId,
        point,
        { type: "container", id: targetContainer.id },
        {
          left: targetContainer.x,
          top: targetContainer.y,
          width: targetContainer.width,
          height: targetContainer.height,
        },
      );
    }
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

    const normalized = normalizeAppData(data, getWindowPreviewViewport);
    const selectedCanvas =
      normalized.canvases.find((canvas) => canvas.id === normalized.activeCanvasId) ??
      normalized.canvases[0] ??
      DEFAULT_CANVAS;

    const currentCameraByCanvasId = new Map(
      latestAppDataRef.current.canvases.map((canvas) => [
        canvas.id,
        {
          pan: canvas.id === activeCanvas.id ? latestCameraRef.current.pan : canvas.pan,
          zoom: canvas.id === activeCanvas.id ? latestCameraRef.current.zoom : canvas.zoom,
          previewViewport: canvas.previewViewport,
        },
      ]),
    );
    const nextCanvases = normalized.canvases.length ? normalized.canvases : [DEFAULT_CANVAS];
    const cameraPreservedCanvases = preserveCamera
      ? nextCanvases.map((canvas) => {
          const currentCamera = currentCameraByCanvasId.get(canvas.id);

          return currentCamera
            ? {
                ...canvas,
                pan: currentCamera.pan,
                zoom: currentCamera.zoom,
                previewViewport: currentCamera.previewViewport,
              }
            : canvas;
        })
      : nextCanvases;
    const cameraPreservedSelectedCanvas =
      cameraPreservedCanvases.find((canvas) => canvas.id === selectedCanvas.id) ?? selectedCanvas;

    setCanvases(cameraPreservedCanvases);
    setActiveCanvas(cameraPreservedSelectedCanvas);
    setElements(selectedCanvas.containers);
    setTextCards(selectedCanvas.textCards);
    setTextBlocks(selectedCanvas.textBlocks ?? []);
    setImages(selectedCanvas.images ?? []);
    setPan(preserveCamera ? latestCameraRef.current.pan : selectedCanvas.pan);
    setZoom(preserveCamera ? latestCameraRef.current.zoom : selectedCanvas.zoom);
    setCanvasGridStyle(normalized.canvasGridStyle);
    setCanvasGridOpacity(normalized.canvasGridOpacity);
    setDiscordRpcEnabled(normalized.discordRpcEnabled);
    setPrivacyModeEnabled(normalized.privacyModeEnabled);
    setDismissedUpdateVersion(normalized.dismissedUpdateVersion);
    setSelectedIds([]);
    setRenamingId(null);
    setEditingTextCardId(null);
    setEditingTextBlockId(null);
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

  const applyActiveCanvasHistorySnapshot = (snapshot: TaskCanvas) => {
    applyingHistoryRef.current = true;
    if (historyTimeoutRef.current) {
      window.clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }

    const currentActiveCanvas = latestAppDataRef.current.canvases.find((canvas) => canvas.id === activeCanvas.id);
    const nextCanvas = {
      ...snapshot,
      pan: latestCameraRef.current.pan,
      zoom: latestCameraRef.current.zoom,
      previewViewport: currentActiveCanvas?.previewViewport,
    };

    setCanvases((current) => current.map((canvas) => (canvas.id === activeCanvas.id ? nextCanvas : canvas)));
    setActiveCanvas(nextCanvas);
    setElements(snapshot.containers);
    setTextCards(snapshot.textCards);
    setTextBlocks(snapshot.textBlocks ?? []);
    setImages(snapshot.images ?? []);
    setPan(latestCameraRef.current.pan);
    setZoom(latestCameraRef.current.zoom);
    setSelectedIds([]);
    setRenamingId(null);
    setEditingTextCardId(null);
    setEditingTextBlockId(null);
    setCopiedItem(null);
    closeContextMenus();

    window.setTimeout(() => {
      applyingHistoryRef.current = false;
    }, 0);
  };

  const undo = useCallback(() => {
    const canvasId = activeCanvas.id;
    const history = historyRef.current[canvasId] ?? [];
    const historyIndex = historyIndexRef.current[canvasId] ?? -1;

    if (historyIndex <= 0) {
      return;
    }

    const nextHistoryIndex = historyIndex - 1;
    historyIndexRef.current = {
      ...historyIndexRef.current,
      [canvasId]: nextHistoryIndex,
    };
    applyActiveCanvasHistorySnapshot(cloneCanvas(history[nextHistoryIndex]));
    updateHistoryState(canvasId);
  }, [activeCanvas.id, applyActiveCanvasHistorySnapshot]);

  const redo = useCallback(() => {
    const canvasId = activeCanvas.id;
    const history = historyRef.current[canvasId] ?? [];
    const historyIndex = historyIndexRef.current[canvasId] ?? -1;

    if (historyIndex < 0 || historyIndex >= history.length - 1) {
      return;
    }

    const nextHistoryIndex = historyIndex + 1;
    historyIndexRef.current = {
      ...historyIndexRef.current,
      [canvasId]: nextHistoryIndex,
    };
    applyActiveCanvasHistorySnapshot(cloneCanvas(history[nextHistoryIndex]));
    updateHistoryState(canvasId);
  }, [activeCanvas.id, applyActiveCanvasHistorySnapshot]);

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

  const resetLocalDatabase = async () => {
    await invoke("reset_local_database");
    const data: AppData = {
      activeCanvasId: DEFAULT_CANVAS.id,
      canvases: [DEFAULT_CANVAS],
      canvasGridStyle: "dots",
      canvasGridOpacity: DEFAULT_GRID_OPACITY,
      discordRpcEnabled: false,
      privacyModeEnabled: false,
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
      textBlocks: [],
      images: [],
      pan: DEFAULT_PAN,
      zoom: 1,
      previewViewport: {
        width: stageRef.current?.clientWidth ?? window.innerWidth,
        height: stageRef.current?.clientHeight ?? window.innerHeight,
      },
    };

    const nextCanvases = [...currentCanvases, canvas];
    setCanvases(nextCanvases);
    setActiveCanvas(canvas);
    setElements([]);
    setTextCards([]);
    setTextBlocks([]);
    setImages([]);
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
    setTextBlocks(nextCanvas.textBlocks ?? []);
    setImages(nextCanvas.images ?? []);
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
      setTextBlocks((current) =>
        current.map((element) => ({
          ...element,
          x: clamp(element.x, 0, Math.max(0, width - element.width)),
          y: clamp(element.y, 0, Math.max(0, height - element.height)),
          width: Math.min(element.width, width),
          height: Math.min(element.height, height),
        })),
      );
      setImages((current) =>
        current.map((image) => ({
          ...image,
          x: clamp(image.x, 0, Math.max(0, width - image.width)),
          y: clamp(image.y, 0, Math.max(0, height - image.height)),
          width: Math.min(image.width, width),
          height: Math.min(image.height, height),
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
      setTextBlocks(nextActiveCanvas.textBlocks ?? []);
      setImages(nextActiveCanvas.images ?? []);
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

  const getCanvasCycleOrder = () => {
    const currentCanvases = getPersistedCanvases();
    return currentCanvases.map((canvas) => canvas.id);
  };

  const getCurrentLeftPanelState = (): LeftPanelState => {
    if (canvasManagerOpen && !canvasManagerClosing) {
      return "canvases";
    }

    if (extensionsOpen && !extensionsClosing) {
      return "extensions";
    }

    return "closed";
  };

  const restoreLeftPanelState = (state: LeftPanelState) => {
    if (panelSwitchTimeoutRef.current !== null) {
      window.clearTimeout(panelSwitchTimeoutRef.current);
      panelSwitchTimeoutRef.current = null;
    }

    if (state === "canvases") {
      setExtensionsOpen(false);
      setExtensionsClosing(false);
      setCanvasManagerOpen(true);
      setCanvasManagerClosing(false);
      return;
    }

    if (state === "extensions") {
      setCanvasManagerOpen(false);
      setCanvasManagerClosing(false);
      setExtensionsOpen(true);
      setExtensionsClosing(false);
      return;
    }

    setExtensionsOpen(false);
    setExtensionsClosing(false);
    setCanvasManagerClosing(true);
    window.setTimeout(() => {
      setCanvasManagerOpen(false);
      setCanvasManagerClosing(false);
    }, CANVAS_MANAGER_ANIMATION_MS);
  };

  const finishCanvasCycle = () => {
    const restorePanelState = canvasCycleSessionRef.current?.previousPanelState ?? "closed";
    canvasCycleSessionRef.current = null;
    setCanvasCycleHighlightId(null);

    if (canvasCycleRestoreTimeoutRef.current !== null) {
      window.clearTimeout(canvasCycleRestoreTimeoutRef.current);
    }

    canvasCycleRestoreTimeoutRef.current = window.setTimeout(() => {
      restoreLeftPanelState(restorePanelState);
      canvasCycleRestoreTimeoutRef.current = null;
    }, CANVAS_CYCLE_PANEL_RESTORE_DELAY_MS);
  };

  const cycleCanvases = (direction: 1 | -1) => {
    const session = canvasCycleSessionRef.current;
    const order = session?.order ?? getCanvasCycleOrder();
    if (order.length <= 1) {
      return;
    }

    const currentIndex = session?.index ?? Math.max(0, order.indexOf(activeCanvas.id));
    const nextIndex = (currentIndex + direction + order.length) % order.length;
    const nextCanvasId = order[nextIndex];
    if (!nextCanvasId) {
      return;
    }

    canvasCycleSessionRef.current = {
      order,
      index: nextIndex,
      previousPanelState: session?.previousPanelState ?? getCurrentLeftPanelState(),
    };

    if (panelSwitchTimeoutRef.current !== null) {
      window.clearTimeout(panelSwitchTimeoutRef.current);
      panelSwitchTimeoutRef.current = null;
    }
    if (canvasCycleRestoreTimeoutRef.current !== null) {
      window.clearTimeout(canvasCycleRestoreTimeoutRef.current);
      canvasCycleRestoreTimeoutRef.current = null;
    }

    setQuickExtensionsMenu(null);
    setCanvasCycleHighlightId(nextCanvasId);
    setExtensionsOpen(false);
    setExtensionsClosing(false);
    setCanvasManagerOpen(true);
    setCanvasManagerClosing(false);
    selectCanvas(nextCanvasId);
  };

  useEffect(() => {
    const handleCtrlTab = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== "Tab" ||
        !event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditableKeyboardTarget(target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      cycleCanvases(event.shiftKey ? -1 : 1);
    };
    const handleCtrlRelease = (event: KeyboardEvent) => {
      if (
        (event.key === "Control" || event.key === "ControlLeft" || event.key === "ControlRight") &&
        canvasCycleSessionRef.current
      ) {
        finishCanvasCycle();
      }
    };

    window.addEventListener("keydown", handleCtrlTab, true);
    window.addEventListener("keyup", handleCtrlRelease, true);
    return () => {
      window.removeEventListener("keydown", handleCtrlTab, true);
      window.removeEventListener("keyup", handleCtrlRelease, true);
    };
  }, [
    activeCanvas,
    canvasCycleHighlightId,
    canvasManagerClosing,
    canvasManagerOpen,
    canvases,
    elements,
    extensionsClosing,
    extensionsOpen,
    images,
    pan,
    textBlocks,
    textCards,
    zoom,
  ]);

  const toggleCanvasManager = () => {
    if (canvasManagerOpen && !canvasManagerClosing) {
      closeCanvasManager();
      return;
    }

    switchLeftPanel("canvases");
  };

  const toggleExtensionsPanel = () => {
    if (extensionsOpen && !extensionsClosing) {
      closeExtensionsPanel();
      return;
    }

    switchLeftPanel("extensions");
  };

  const updateDiscordRpcEnabled = (enabled: boolean) => {
    setDiscordRpcEnabled(enabled);
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
  const selectionScreenBounds = selectionBounds
    ? {
        left: pan.x + selectionBounds.left * zoom,
        top: pan.y + selectionBounds.top * zoom,
        width: selectionBounds.width * zoom,
        height: selectionBounds.height * zoom,
      }
    : null;
  const containerSelectionScreenBounds = containerSelectionBounds
    ? {
        left: pan.x + containerSelectionBounds.left * zoom,
        top: pan.y + containerSelectionBounds.top * zoom,
        width: containerSelectionBounds.width * zoom,
        height: containerSelectionBounds.height * zoom,
      }
    : null;
  const containerSelectionAccent = containerSelectionBounds
    ? containersById.get(containerSelectionBounds.containerId)?.accent
    : null;
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
  const textBlockContextElement = textBlockMenu
    ? textBlocksById.get(textBlockMenu.id)
    : null;
  const closingTextBlockContextElement = closingTextBlockMenu
    ? textBlocksById.get(closingTextBlockMenu.id)
    : null;
  const imageContextElement = imageMenu ? imagesById.get(imageMenu.id) : null;
  const closingImageContextElement = closingImageMenu ? imagesById.get(closingImageMenu.id) : null;
  const textCardDropPreviewPosition = getTextCardDropPreviewPosition();
  const dotGridOpacityScale = clamp((zoom - 0.55) / 0.45, 0, 1);
  const frostedGlassStyle = {
    "--frosted-bg-opacity": frostedGlassValues.bgOpacity,
    "--frosted-bg-brightness": frostedGlassValues.bgBrightness,
    "--frosted-border-opacity": frostedGlassValues.borderOpacity,
    "--frosted-blur": `${frostedGlassValues.blur}px`,
    "--frosted-shadow-opacity": frostedGlassValues.shadowOpacity,
    "--frosted-shadow-y": `${frostedGlassValues.shadowY}px`,
    "--frosted-shadow-blur": `${frostedGlassValues.shadowBlur}px`,
    "--left-panel-card-bg-opacity": leftPanelCardValues.bgOpacity,
    "--left-panel-card-outline-opacity": leftPanelCardValues.outlineOpacity,
  } as CSSProperties;
  return (
    <main
      data-theme="taskmap"
      spellCheck={false}
      className="h-full w-full bg-[color:var(--void-bg)] text-white"
      style={frostedGlassStyle}
      onContextMenu={suppressContextMenu}
      onPointerDownCapture={handleMainPointerDownCapture}
      onPointerMoveCapture={handleColorPickerPointerMove}
    >
      <div className="h-full">
        <section className="relative h-full overflow-hidden">
          {colorPickerTargetId && (
            <div
              data-color-picker-tool
              className="pointer-events-none fixed z-[1002] flex items-center gap-2 rounded-lg border border-white/[0.16] bg-[#18191d] px-2.5 py-2 text-sm font-medium text-white/82 shadow-[0_14px_34px_rgba(0,0,0,0.48)]"
              style={{
                left: (colorPickerPreview?.clientX ?? 20) + 18,
                top: (colorPickerPreview?.clientY ?? 60) + 18,
              }}
            >
              <span
                className="h-5 w-5 rounded border border-black/70 shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
                style={{ backgroundColor: colorPickerPreview?.color ?? "#111216" }}
              />
              <IconColorPicker size={18} stroke={2} />
              <span>Click to apply</span>
            </div>
          )}
          {temporaryPanelsVisible && (
            <>
              <FrostedGlassTuner
                frostedValues={frostedGlassValues}
                cardValues={leftPanelCardValues}
                onFrostedChange={setFrostedGlassValues}
                onCardChange={setLeftPanelCardValues}
              />
              <div className="frosted-glass pointer-events-none fixed left-1/2 top-6 z-30 w-[640px] -translate-x-1/2 rounded-xl border border-white/[0.15] bg-[#1b1b1e]/94 p-8 text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-sm">
                <div className="text-2xl font-semibold tracking-tight text-white/88">Frosted glass preview</div>
                <div className="mt-3 text-base leading-6 text-white/58">
                  Temporary example panel using the current slider values.
                </div>
              </div>
            </>
          )}
          <FloatingToolbar
            canRedo={historyState.canRedo}
            canUndo={historyState.canUndo}
            canvasesOpen={canvasManagerOpen && !canvasManagerClosing}
            extensionsOpen={extensionsOpen && !extensionsClosing}
            onRedo={redo}
            onToggleExtensions={toggleExtensionsPanel}
            onToggleCanvases={toggleCanvasManager}
            onUndo={undo}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          {fpsCounterVisible && (
            <div className="pointer-events-none fixed right-4 top-4 z-50 rounded-lg border border-white/[0.14] bg-[#111216]/88 px-4 py-3 font-mono text-[22px] leading-8 text-white/78 shadow-[0_12px_32px_rgba(0,0,0,0.34)] backdrop-blur-md">
              <div className="text-white/92">{frameStats.samples ? `${Math.round(frameStats.fps)} fps` : "-- fps"}</div>
              <div>avg {frameStats.averageMs.toFixed(2)} ms</div>
              <div>p95 {frameStats.p95Ms.toFixed(2)} ms</div>
              <div>max {frameStats.maxMs.toFixed(2)} ms</div>
            </div>
          )}
          {canvasManagerOpen && (
            <CanvasManager
              canvases={getPersistedCanvases()}
              activeCanvasId={activeCanvas.id}
              cycleHighlightCanvasId={canvasCycleHighlightId}
              closing={canvasManagerClosing}
              minimalView={canvasManagerMinimalView}
              viewportWidth={stageWidth}
              viewportHeight={stageHeight}
              onMinimalViewChange={setCanvasManagerMinimalView}
              onCreateCanvas={createCanvas}
              onSelectCanvas={selectCanvas}
              onUpdateCanvas={updateCanvas}
              onDeleteCanvas={deleteCanvas}
              onReorderCanvases={reorderCanvases}
            />
          )}
          {extensionsOpen && (
            <ExtensionsPanel
              closing={extensionsClosing}
              onDropExtension={dropExtensionOnCanvas}
              onDragExtension={handleExtensionDragHover}
            />
          )}
          {quickExtensionsMenu && (
            <QuickExtensionsMenu
              left={quickExtensionsMenu.left}
              top={quickExtensionsMenu.top}
              onClose={() => setQuickExtensionsMenu(null)}
              onDropExtension={dropExtensionOnCanvas}
              onDragExtension={handleExtensionDragHover}
            />
          )}
          <div
            ref={stageRef}
            data-stage
            className={`absolute inset-0 overflow-hidden ${
              dragState?.type === "pan" || dragState?.type === "move" ? "cursor-grabbing" : "cursor-default"
            }`}
            onPointerDownCapture={handleStagePointerDownCapture}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
            onWheel={handleWheel}
            onAuxClick={(event) => event.preventDefault()}
          >
            <div
              ref={worldRef}
              className="canvas-grid absolute overflow-hidden rounded-[24px] border border-white/[0.15] shadow-premium"
              data-grid-style={canvasGridStyle}
              data-image-url-version={imageUrlVersion}
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
              {extensionDropRipples.map((ripple) => {
                const bounds = ripple.bounds;

                const rippleX = clamp(ripple.offsetX, 0, bounds.width);
                const rippleY = clamp(ripple.offsetY, 0, bounds.height);

                return (
                  <div
                    key={ripple.id}
                    className="extension-drop-ripple-surface"
                    style={{
                      left: bounds.left,
                      top: bounds.top,
                      width: bounds.width,
                      height: bounds.height,
                      borderRadius: bounds.borderRadius,
                      borderTopLeftRadius: bounds.borderTopLeftRadius,
                      borderTopRightRadius: bounds.borderTopRightRadius,
                      borderBottomRightRadius: bounds.borderBottomRightRadius,
                      borderBottomLeftRadius: bounds.borderBottomLeftRadius,
                    }}
                  >
                    <ExtensionDropEffect
                      originX={rippleX}
                      originY={rippleY}
                      width={bounds.width}
                      height={bounds.height}
                    />
                  </div>
                );
              })}
              {elements.map((element) => {
                // Keep the settling card in the index list so neighbours keep
                // their correct visible slots; it is rendered in the loose
                // layer (for its free-flying settle animation) and merely
                // skipped in the container loop below. Excluding it here
                // instead shifts every later card up a row for the settle
                // window, which reads as a brief shuffle.
                const allContainedCards = (
                  orderedTextCardsByContainerId.get(element.id) ?? []
                ).filter(
                  (card) => !(dragState?.type === "text-card-move" && dragState.ids.includes(card.id)),
                );
                const searchQuery = getContainerSearchQuery(element);
                const containedCards = getContainerVisibleTextCards(element, allContainedCards);
                const sorted = Boolean(element.extensions?.sorting?.mode);
                const relativeDropPreview =
                  textCardDropPreview?.containerId === element.id && textCardDropPreviewPosition
                    ? toContainerRelativePosition(textCardDropPreviewPosition, element)
                    : null;
                const scrollOffset = getContainerScrollOffset(element);
                const containerMultiSelected = selectedIds.length > 1 && selectedIds.includes(element.id);

                return (
                  <ContainerNode
                    key={element.id}
                    element={withCanvasLayer(element)}
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
                    onSelect={selectCanvasElement}
                    onStartMove={startMove}
                    onStartResize={startResize}
                    onToggleMenu={toggleMenu}
                    onTogglePrivacy={togglePrivacyExtension}
                    onToggleLock={toggleLockExtension}
                    onPickColor={pickElementColor}
                    onTogglePickCard={togglePickedContainerCard}
                    onSetSort={setContainerSort}
                    onSearchChange={updateContainerSearchQuery}
                    onOpenContentMenu={openContainerContentMenu}
                    onWheelContent={handleContainerWheel}
                    onStartContentSelection={startContainerContentSelection}
                    cardCount={allContainedCards.length}
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
                    {containedCards.map((card, visibleIndex) => {
                      // The settling card occupies its slot here (so neighbours
                      // index correctly) but is drawn in the loose layer, which
                      // owns its settle animation. Skip emitting it twice.
                      if (settlingTextCardIds.includes(card.id)) {
                        return null;
                      }
                      // While dropping into this container, cards at or after
                      // the preview slot slide down one row to open the gap —
                      // matching the non-filtered render path's behaviour.
                      const previewShift =
                        textCardDropPreview?.containerId === element.id &&
                        visibleIndex >= textCardDropPreview.index
                          ? dragState?.type === "text-card-move"
                            ? dragState.ids.length
                            : 1
                          : 0;
                      const compactSearchPosition = searchQuery || sorted
                        ? {
                            x: element.x + CONTAINER_TEXT_CARD_PADDING,
                            y:
                              getContainerCardStackTop(element) +
                              (visibleIndex + previewShift) *
                                (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP) -
                              getContainerScrollOffset(element),
                          }
                        : null;
                      const position = {
                        ...toContainerRelativePosition(compactSearchPosition ?? getTextCardRenderPosition(card) ?? card, element),
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
                          glowing={glowingTextCardIds.includes(card.id)}
                          moving={dragState?.type === "move" && selectedIds.includes(card.id)}
                          settling={settlingTextCardIds.includes(card.id)}
                          selected={outlinedIds.includes(card.id)}
                          interactionDisabled={containerMultiSelected}
                          linksDisabled={selectedIds.length > 1}
                          privacyHidden={Boolean(element.extensions?.privacy?.enabled)}
                          onDraftChange={setTextCardDraft}
                          onSave={saveTextCardEdit}
                          onCancel={cancelTextCardEdit}
                          onStartMove={startTextCardMove}
                          onOpenMenu={openTextCardMenu}
                          onToggleCheckbox={toggleTextCardCheckbox}
                        />
                      );
                    })}
                  </ContainerNode>
                );
              })}
              {textBlocks.map((element) => {
                const textBlockMultiSelected = selectedIds.length > 1 && selectedIds.includes(element.id);

                return (
                  <TextBlockNode
                    key={element.id}
                    element={withCanvasLayer(element)}
                    selected={outlinedIds.includes(element.id)}
                    multiSelected={textBlockMultiSelected}
                    entering={enteringTextBlockIds.includes(element.id)}
                    deleting={deletingTextBlockIds.includes(element.id)}
                    pulsing={pulsingTextBlockIds.includes(element.id)}
                    dragState={dragState}
                    editing={editingTextBlockId === element.id}
                    draft={textBlockDraft}
                    renaming={renamingId === element.id}
                    renameDraft={renameDraft}
                    onDraftChange={setTextBlockDraft}
                    onSave={saveTextBlockEdit}
                    onCancel={cancelTextBlockEdit}
                    onRenameDraftChange={setRenameDraft}
                    onSaveRename={saveRename}
                    onCancelRename={cancelRename}
                    onStartEdit={startTextBlockEdit}
                    onSelect={selectCanvasElement}
                    onStartMove={startMove}
                    onStartResize={startResize}
                    onToggleMenu={openTextBlockMenu}
                    onTogglePrivacy={togglePrivacyExtension}
                    onToggleLock={toggleLockExtension}
                    onPickColor={pickElementColor}
                  />
                );
              })}
              {renderedLooseTextCards.map((card) => {
                if (textCardReleaseAnimation && settlingTextCardIds.includes(card.id)) {
                  return null;
                }
                const draggingTextCard =
                  dragState?.type === "text-card-move" && dragState.ids.includes(card.id);
                if (draggingTextCard) {
                  return null;
                }
                const dragBundleIndex =
                  dragState?.type === "text-card-move" ? dragState.ids.indexOf(card.id) : -1;
                const dragBundleOffset =
                  dragState?.type === "text-card-move"
                    ? dragState.cardOffsets.find((offset) => offset.id === card.id)
                    : undefined;
                const settlingTextCard = settlingTextCardIds.includes(card.id);
                const position = draggingTextCard
                  ? { x: card.x, y: card.y }
                  : settlingTextCard && card.containerId
                    ? getTextCardRenderPosition(card)
                    : undefined;

                return (
                  <TextCardNode
                    key={card.id}
                    card={withCanvasLayer(card)}
                    editing={editingTextCardId === card.id}
                    draft={textCardDraft}
                    position={position}
                    entering={enteringTextCardIds.includes(card.id)}
                    deleting={deletingTextCardIds.includes(card.id)}
                    pulsing={pulsingTextCardIds.includes(card.id)}
                    glowing={glowingTextCardIds.includes(card.id)}
                    dragging={draggingTextCard}
                    dragPrimary={
                      dragState?.type === "text-card-move" && dragState.id === card.id
                    }
                    dragBundleIndex={dragBundleIndex}
                    dragBundleSize={
                      dragState?.type === "text-card-move" ? dragState.ids.length : 1
                    }
                    dragPickupX={dragBundleOffset?.pickupX ?? 0}
                    dragPickupY={dragBundleOffset?.pickupY ?? 0}
                    dragSwayX={
                      dragState?.type === "text-card-move" ? dragState.swayX : 0
                    }
                    dragSwayY={
                      dragState?.type === "text-card-move" ? dragState.swayY : 0
                    }
                    moving={dragState?.type === "move" && selectedIds.includes(card.id)}
                    settling={settlingTextCard}
                    selected={outlinedIds.includes(card.id)}
                    linksDisabled={selectedIds.length > 1}
                    onDraftChange={setTextCardDraft}
                    onSave={saveTextCardEdit}
                    onCancel={cancelTextCardEdit}
                    onStartMove={startTextCardMove}
                    onOpenMenu={openTextCardMenu}
                    onToggleCheckbox={toggleTextCardCheckbox}
                  />
                );
              })}
              {looseImages.map((image) => (
                <ImageNode
                  key={image.id}
                  image={withCanvasLayer(image)}
                  url={getImageUrl(image.imageId, image.format)}
                  loading={loadingImageIds.includes(image.id)}
                  entering={enteringImageIds.includes(image.id)}
                  deleting={deletingImageIds.includes(image.id)}
                  dragging={dragState?.type === "image-move" && dragState.id === image.id}
                  moving={dragState?.type === "move" && selectedIds.includes(image.id)}
                  resizing={dragState?.type === "image-resize" && dragState.id === image.id}
                  selected={outlinedIds.includes(image.id)}
                  onStartMove={startImageMove}
                  onStartResize={startImageResize}
                  onOpenMenu={openImageMenu}
                  onPick={pickImageForElement}
                />
              ))}
            </div>
            {dragState?.type === "text-card-move" && (
              <div
                className="pointer-events-none absolute left-0 top-0 z-[100] overflow-visible"
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
              >
                {dragState.ids.map((id, dragBundleIndex) => {
                  const card = textCardsById.get(id);
                  const dragBundleOffset = dragState.cardOffsets.find((offset) => offset.id === id);
                  if (!card) {
                    return null;
                  }

                  return (
                    <TextCardNode
                      key={`drag-overlay-${card.id}`}
                      card={card}
                      editing={false}
                      draft={card.text}
                      position={{ x: card.x, y: card.y }}
                      dragging
                      dragPrimary={dragState.id === card.id}
                      dragBundleIndex={dragBundleIndex}
                      dragBundleSize={dragState.ids.length}
                      dragPickupX={dragBundleOffset?.pickupX ?? 0}
                      dragPickupY={dragBundleOffset?.pickupY ?? 0}
                      dragSwayX={dragState.swayX}
                      dragSwayY={dragState.swayY}
                      selected={outlinedIds.includes(card.id)}
                      linksDisabled
                      onDraftChange={setTextCardDraft}
                      onSave={saveTextCardEdit}
                      onCancel={cancelTextCardEdit}
                      onStartMove={startTextCardMove}
                      onOpenMenu={openTextCardMenu}
                      onToggleCheckbox={toggleTextCardCheckbox}
                    />
                  );
                })}
              </div>
            )}
            {textCardReleaseAnimation && (
              <div
                className="pointer-events-none absolute left-0 top-0 z-[100] overflow-visible"
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
              >
                {textCardReleaseAnimation.cards.map(({ card, from, to }) => (
                  <TextCardNode
                    key={`release-overlay-${card.id}`}
                    card={card}
                    editing={false}
                    draft={card.text}
                    position={textCardReleaseAnimation.active ? to : from}
                    settling
                    selected={outlinedIds.includes(card.id)}
                    linksDisabled
                    onDraftChange={setTextCardDraft}
                    onSave={saveTextCardEdit}
                    onCancel={cancelTextCardEdit}
                    onStartMove={startTextCardMove}
                    onOpenMenu={openTextCardMenu}
                    onToggleCheckbox={toggleTextCardCheckbox}
                  />
                ))}
              </div>
            )}
            {selectionScreenBounds && (
              <div
                className="pointer-events-none absolute z-30 rounded-md border border-dashed border-[#2dd8c8]/80 bg-[#2dd8c8]/[0.10] shadow-[0_0_0_1px_rgba(0,0,0,0.22)]"
                style={selectionScreenBounds}
              />
            )}
            {containerSelectionScreenBounds && (
              <div
                className="pointer-events-none absolute z-30 rounded-md border border-dashed shadow-[0_0_0_1px_rgba(0,0,0,0.22)]"
                style={{
                  ...containerSelectionScreenBounds,
                  borderColor: containerSelectionAccent ?? "#2dd8c8",
                  backgroundColor: `color-mix(in srgb, ${containerSelectionAccent ?? "#2dd8c8"} 14%, transparent)`,
                }}
              />
            )}
          </div>

          {containerMenu && contextMenuElement && (
            <ContainerContextMenu
              key={`${containerMenu.id}-${containerMenu.left}-${containerMenu.top}`}
              menu={containerMenu}
              element={contextMenuElement}
              closing={false}
              isMultiTarget={isMultiContextAction(contextMenuElement.id)}
              extensionState={getSelectedExtensionState(getContextActionIds(contextMenuElement.id))}
              onStartRename={startRename}
              onUpdateAccent={updateContextAccent}
              onCopy={copyContainer}
              onRemovePrivacyExtension={(id) => stripContextExtension(id, "privacy")}
              onRemoveSearchExtension={(id) => stripContextExtension(id, "search")}
              onRemoveSortingExtension={(id) => stripContextExtension(id, "sorting")}
              onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
              onRemoveColorsExtension={(id) => stripContextExtension(id, "colors")}
              onRemoveColorPickerExtension={(id) => stripContextExtension(id, "colorPicker")}
              onRemoveDailyResetExtension={(id) => stripContextExtension(id, "dailyReset")}
              onRemoveCounterExtension={(id) => stripContextExtension(id, "counter")}
              onRemoveInheritCardColorExtension={(id) => stripContextExtension(id, "inheritCardColor")}
              onRemovePickCardExtension={(id) => stripContextExtension(id, "pickCard")}
              onMoveLayer={moveCanvasLayers}
              onDelete={deleteContextSelection}
            />
          )}

          {closingContainerMenu && closingContextMenuElement && (
            <ContainerContextMenu
              key={`closing-${closingContainerMenu.id}-${closingContainerMenu.left}-${closingContainerMenu.top}`}
              menu={closingContainerMenu}
              element={closingContextMenuElement}
              closing
              isMultiTarget={isMultiContextAction(closingContextMenuElement.id)}
              extensionState={getSelectedExtensionState(getContextActionIds(closingContextMenuElement.id))}
              onStartRename={startRename}
              onUpdateAccent={updateContextAccent}
              onCopy={copyContainer}
              onRemovePrivacyExtension={(id) => stripContextExtension(id, "privacy")}
              onRemoveSearchExtension={(id) => stripContextExtension(id, "search")}
              onRemoveSortingExtension={(id) => stripContextExtension(id, "sorting")}
              onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
              onRemoveColorsExtension={(id) => stripContextExtension(id, "colors")}
              onRemoveColorPickerExtension={(id) => stripContextExtension(id, "colorPicker")}
              onRemoveDailyResetExtension={(id) => stripContextExtension(id, "dailyReset")}
              onRemoveCounterExtension={(id) => stripContextExtension(id, "counter")}
              onRemoveInheritCardColorExtension={(id) => stripContextExtension(id, "inheritCardColor")}
              onRemovePickCardExtension={(id) => stripContextExtension(id, "pickCard")}
              onMoveLayer={moveCanvasLayers}
              onDelete={deleteContextSelection}
            />
          )}

          {containerContentMenu && (
            <ContainerContentContextMenu
              key={`${containerContentMenu.containerId}-${containerContentMenu.clientX}-${containerContentMenu.clientY}`}
              menu={containerContentMenu}
              hasCopiedItem={Boolean(copiedItem)}
              closing={false}
              onPaste={pasteCopiedItem}
              onCreateTextCard={createTextCardInContainer}
            />
          )}

          {closingContainerContentMenu && (
            <ContainerContentContextMenu
              key={`closing-${closingContainerContentMenu.containerId}-${closingContainerContentMenu.clientX}-${closingContainerContentMenu.clientY}`}
              menu={closingContainerContentMenu}
              hasCopiedItem={Boolean(copiedItem)}
              closing
              onPaste={pasteCopiedItem}
              onCreateTextCard={createTextCardInContainer}
            />
          )}

          {textCardMenu && textCardContextElement && (
            <TextCardContextMenu
              key={`${textCardMenu.id}-${textCardMenu.left}-${textCardMenu.top}`}
              menu={textCardMenu}
              card={textCardContextElement}
              closing={false}
              isMultiTarget={isMultiContextAction(textCardContextElement.id)}
              extensionState={getSelectedExtensionState(getContextActionIds(textCardContextElement.id))}
              onStartEdit={startTextCardEdit}
              onUpdateAccent={updateContextAccent}
              onUpdateLink={updateTextCardLink}
              onCopy={copyTextCard}
              onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
              onRemoveColorsExtension={(id) => stripContextExtension(id, "colors")}
              onRemoveCheckboxExtension={(id) => stripContextExtension(id, "checkbox")}
              onMoveLayer={moveCanvasLayers}
              onDelete={deleteContextSelection}
            />
          )}

          {closingTextCardMenu && closingTextCardContextElement && (
            <TextCardContextMenu
              key={`closing-${closingTextCardMenu.id}-${closingTextCardMenu.left}-${closingTextCardMenu.top}`}
              menu={closingTextCardMenu}
              card={closingTextCardContextElement}
              closing
              isMultiTarget={isMultiContextAction(closingTextCardContextElement.id)}
              extensionState={getSelectedExtensionState(getContextActionIds(closingTextCardContextElement.id))}
              onStartEdit={startTextCardEdit}
              onUpdateAccent={updateContextAccent}
              onUpdateLink={updateTextCardLink}
              onCopy={copyTextCard}
              onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
              onRemoveColorsExtension={(id) => stripContextExtension(id, "colors")}
              onRemoveCheckboxExtension={(id) => stripContextExtension(id, "checkbox")}
              onMoveLayer={moveCanvasLayers}
              onDelete={deleteContextSelection}
            />
          )}

          {textBlockMenu && textBlockContextElement && (
            <TextBlockContextMenu
              key={`${textBlockMenu.id}-${textBlockMenu.left}-${textBlockMenu.top}`}
              menu={textBlockMenu}
              element={textBlockContextElement}
              closing={false}
              isMultiTarget={isMultiContextAction(textBlockContextElement.id)}
              extensionState={getSelectedExtensionState(getContextActionIds(textBlockContextElement.id))}
              onStartEdit={startRename}
              onUpdateAccent={updateContextAccent}
              onCopy={copyTextBlock}
              onRemovePrivacyExtension={(id) => stripContextExtension(id, "privacy")}
              onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
              onRemoveColorsExtension={(id) => stripContextExtension(id, "colors")}
              onRemoveColorPickerExtension={(id) => stripContextExtension(id, "colorPicker")}
              onMoveLayer={moveCanvasLayers}
              onDelete={deleteContextSelection}
            />
          )}

          {closingTextBlockMenu && closingTextBlockContextElement && (
            <TextBlockContextMenu
              key={`closing-${closingTextBlockMenu.id}-${closingTextBlockMenu.left}-${closingTextBlockMenu.top}`}
              menu={closingTextBlockMenu}
              element={closingTextBlockContextElement}
              closing
              isMultiTarget={isMultiContextAction(closingTextBlockContextElement.id)}
              extensionState={getSelectedExtensionState(getContextActionIds(closingTextBlockContextElement.id))}
              onStartEdit={startRename}
              onUpdateAccent={updateContextAccent}
              onCopy={copyTextBlock}
              onRemovePrivacyExtension={(id) => stripContextExtension(id, "privacy")}
              onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
              onRemoveColorsExtension={(id) => stripContextExtension(id, "colors")}
              onRemoveColorPickerExtension={(id) => stripContextExtension(id, "colorPicker")}
              onMoveLayer={moveCanvasLayers}
              onDelete={deleteContextSelection}
            />
          )}

          {imageMenu && imageContextElement && (
            <ImageContextMenu
              key={`${imageMenu.id}-${imageMenu.left}-${imageMenu.top}`}
              menu={imageMenu}
              image={imageContextElement}
              closing={false}
              isMultiTarget={isMultiContextAction(imageContextElement.id)}
              extensionState={getSelectedExtensionState(getContextActionIds(imageContextElement.id))}
              onReplace={pickImageForElement}
              onUpdateAccent={updateContextAccent}
              onToggleBackground={toggleImageBackground}
              onMoveLayer={moveCanvasLayers}
              onCopy={copyImage}
              onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
              onRemoveColorsExtension={(id) => stripContextExtension(id, "colors")}
              onDelete={deleteContextSelection}
            />
          )}

          {closingImageMenu && closingImageContextElement && (
            <ImageContextMenu
              key={`closing-${closingImageMenu.id}-${closingImageMenu.left}-${closingImageMenu.top}`}
              menu={closingImageMenu}
              image={closingImageContextElement}
              closing
              isMultiTarget={isMultiContextAction(closingImageContextElement.id)}
              extensionState={getSelectedExtensionState(getContextActionIds(closingImageContextElement.id))}
              onReplace={pickImageForElement}
              onUpdateAccent={updateContextAccent}
              onToggleBackground={toggleImageBackground}
              onMoveLayer={moveCanvasLayers}
              onCopy={copyImage}
              onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
              onRemoveColorsExtension={(id) => stripContextExtension(id, "colors")}
              onDelete={deleteContextSelection}
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
              onCreateTextBlock={createTextBlock}
              onCreateImage={createImageFromMenu}
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
              onCreateTextBlock={createTextBlock}
              onCreateImage={createImageFromMenu}
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
              discordRpcEnabled={discordRpcEnabled}
              onDiscordRpcEnabledChange={updateDiscordRpcEnabled}
              availableUpdate={availableUpdate}
              appVersion={appVersion}
              fpsCounterVisible={fpsCounterVisible}
              onFpsCounterVisibleChange={setFpsCounterVisible}
              privacyModeEnabled={privacyModeEnabled}
              onPrivacyModeEnabledChange={setPrivacyModeEnabled}
              temporaryPanelsVisible={temporaryPanelsVisible}
              onTemporaryPanelsVisibleChange={setTemporaryPanelsVisible}
              onCheckForUpdate={checkForAppUpdate}
              onInstallUpdate={installAppUpdate}
              onClose={() => setSettingsOpen(false)}
            />
          )}

          {updateModalOpen && availableUpdate && !settingsOpen && (
            <UpdateAvailableModal
              update={availableUpdate}
              onInstall={installAppUpdate}
              onDismiss={dismissUpdateModal}
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
            textBlocks={textBlocks}
            textCards={looseTextCards}
            images={looseImages}
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
