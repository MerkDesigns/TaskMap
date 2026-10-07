export type ElementExtensions = {
  privacy?: {
    enabled: boolean;
  };
  lock?: {
    enabled: boolean;
  };
  colorPicker?: {
    enabled: boolean;
  };
  checkbox?: {
    checked: boolean;
  };
  autoCheckbox?: {
    enabled: boolean;
  };
  counter?: {
    enabled: boolean;
  };
  inheritCardColor?: {
    enabled: boolean;
  };
  copyPasteJson?: {
    enabled: boolean;
  };
  search?: {
    query: string;
  };
  workflow?: {
    lines: {
      invocations: (
        { kind: "run"; executable: string; arguments: string[] } | { kind: "open"; target: string }
      )[];
      workingDirectory: string | null;
      display: "terminal" | "background";
    }[];
  };
};

export type ContainerElement = {
  id: string;
  layer?: number;
  headerButtonsVisible?: boolean;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: string;
  extensions?: ElementExtensions;
};

export type ImageMeta = {
  hash: string;
  format: string;
  width: number;
  height: number;
};

export type ImageElement = {
  id: string;
  layer?: number;
  imageId?: string;
  format?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth?: number;
  naturalHeight?: number;
  accent: string;
  /** When false, the element shell (border/background/shadow) is hidden so a
   *  transparent image shows its true shape. Defaults to true. */
  background?: boolean;
  containerId?: string;
  order?: number;
  extensions?: ElementExtensions;
};

export type TextCardElement = {
  id: string;
  kind?: "mindmap";
  layer?: number;
  text: string;
  x: number;
  y: number;
  accent: string;
  link?: string;
  containerId?: string;
  order?: number;
  extensions?: ElementExtensions;
};

export type MindmapPort = "left" | "right" | "top" | "bottom";

export type MindmapConnection = {
  id: string;
  sourceId: string;
  sourcePort: MindmapPort;
  targetId: string;
  targetPort: MindmapPort;
};

export type TextBlockElement = {
  id: string;
  layer?: number;
  headerButtonsVisible?: boolean;
  name: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: string;
  extensions?: ElementExtensions;
};

export type CanvasGridStyle = "dots" | "lines";

export type DefaultElementColors = {
  container: string;
  textCard: string;
  textBlock: string;
  image: string;
  mindmap: string;
};

export type TaskCanvas = {
  id: string;
  name: string;
  width: number;
  height: number;
  containers: ContainerElement[];
  textCards: TextCardElement[];
  textBlocks: TextBlockElement[];
  images: ImageElement[];
  mindmapConnections: MindmapConnection[];
  pan: {
    x: number;
    y: number;
  };
  zoom: number;
  previewViewport?: {
    width: number;
    height: number;
  };
};

export type AppData = {
  schemaVersion: 2;
  activeCanvasId: string;
  canvases: TaskCanvas[];
  canvasGridStyle: CanvasGridStyle;
  canvasGridOpacity: Record<CanvasGridStyle, number>;
  defaultElementColors: DefaultElementColors;
  recentColors: string[];
  shadowsUnderElements: boolean;
  allowLockedElementDeletion: boolean;
  minimapEnabled: boolean;
  privacyModeEnabled: boolean;
  toolbarButtonsVisible: boolean;
  /** Update version the user dismissed with "Not now"; suppresses the startup
   *  modal for that version only. A newer version still prompts. */
  dismissedUpdateVersion?: string;
};

export type AppUpdateInfo = {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
};

export type ToastTone = "info" | "success" | "warning" | "error";

export type ToastMessage = {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
  exiting?: boolean;
};

export type DragState =
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
      ids: string[];
      activeWidth: number;
      activeHeight: number;
      startClientX: number;
      startClientY: number;
      startPositions: Array<{
        id: string;
        x: number;
        y: number;
      }>;
      textCardStartPositions: Array<{
        id: string;
        x: number;
        y: number;
      }>;
      textBlockStartPositions: Array<{
        id: string;
        x: number;
        y: number;
      }>;
      imageStartPositions: Array<{
        id: string;
        x: number;
        y: number;
      }>;
    }
  | {
      type: "resize";
      pointerId: number;
      id: string;
      startClientX: number;
      startClientY: number;
      startWidth: number;
      startHeight: number;
    }
  | {
      type: "text-card-move";
      pointerId: number;
      id: string;
      ids: string[];
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
      cardOffsets: Array<{
        id: string;
        x: number;
        y: number;
        pickupX: number;
        pickupY: number;
      }>;
      lastClientX: number;
      lastClientY: number;
      swayX: number;
      swayY: number;
      startContainerId?: string;
      pointerOffsetY: number;
      width: number;
      height: number;
      snapping: boolean;
      trueSize: boolean;
    }
  | {
      type: "image-move";
      pointerId: number;
      id: string;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
      width: number;
      height: number;
      snapping: boolean;
    }
  | {
      type: "image-resize";
      pointerId: number;
      id: string;
      startClientX: number;
      startClientY: number;
      startWidth: number;
      startHeight: number;
      aspectRatio: number;
    }
  | {
      type: "select";
      pointerId: number;
      additive: boolean;
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    }
  | {
      type: "container-select";
      pointerId: number;
      containerId: string;
      additive: boolean;
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    };
