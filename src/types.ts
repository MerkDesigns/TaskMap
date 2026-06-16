export type ElementExtensions = {
  privacy?: {
    enabled: boolean;
  };
  lock?: {
    enabled: boolean;
  };
  colors?: {
    enabled: boolean;
  };
  search?: {
    query: string;
  };
  sorting?: {
    mode: "alphabet" | "color" | null;
    direction: "asc" | "desc";
  };
};

export type ContainerElement = {
  id: string;
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
  text: string;
  x: number;
  y: number;
  accent: string;
  link?: string;
  containerId?: string;
  order?: number;
  extensions?: ElementExtensions;
};

export type TextBlockElement = {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: string;
  extensions?: ElementExtensions;
};

export type ContainerMenuState = {
  id: string;
  left: number;
  top: number;
};

export type CopiedContainer = Pick<ContainerElement, "name" | "width" | "height" | "accent"> & {
  x?: number;
  y?: number;
  textCards: Array<Pick<TextCardElement, "text" | "accent" | "link" | "order">>;
};

export type CopiedTextCard = Pick<TextCardElement, "text" | "accent" | "link"> & {
  x?: number;
  y?: number;
  containerId?: string;
  order?: number;
};

export type CopiedImage = Pick<
  ImageElement,
  "imageId" | "format" | "width" | "height" | "naturalWidth" | "naturalHeight" | "accent" | "background"
> & {
  x?: number;
  y?: number;
};

export type CopiedTextBlock = Pick<TextBlockElement, "name" | "text" | "width" | "height" | "accent"> & {
  x?: number;
  y?: number;
};

export type CopiedCanvasItem =
  | {
      type: "container";
      item: CopiedContainer;
    }
  | {
      type: "text-card";
      item: CopiedTextCard;
    }
  | {
      type: "text-block";
      item: CopiedTextBlock;
    }
  | {
      type: "image";
      item: CopiedImage;
    }
  | {
      type: "selection";
      item: {
        containers: CopiedContainer[];
        textCards: CopiedTextCard[];
        textBlocks: CopiedTextBlock[];
        images: CopiedImage[];
      };
    };

export type CanvasGridStyle = "dots" | "lines";

export type TaskCanvas = {
  id: string;
  name: string;
  width: number;
  height: number;
  containers: ContainerElement[];
  textCards: TextCardElement[];
  textBlocks: TextBlockElement[];
  images: ImageElement[];
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
  activeCanvasId: string;
  canvases: TaskCanvas[];
  canvasGridStyle: CanvasGridStyle;
  canvasGridOpacity: Record<CanvasGridStyle, number>;
  discordRpcEnabled: boolean;
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
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
      startContainerId?: string;
      pointerOffsetY: number;
      width: number;
      height: number;
      snapping: boolean;
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
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    }
  | {
      type: "container-select";
      pointerId: number;
      containerId: string;
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    };
