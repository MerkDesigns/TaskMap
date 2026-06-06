export type ContainerElement = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: string;
};

export type TextCardElement = {
  id: string;
  text: string;
  x: number;
  y: number;
  accent: string;
  containerId?: string;
  order?: number;
};

export type ContainerMenuState = {
  id: string;
  left: number;
  top: number;
};

export type CopiedContainer = Pick<ContainerElement, "name" | "width" | "height" | "accent"> & {
  textCards: Array<Pick<TextCardElement, "text" | "accent" | "order">>;
};

export type CanvasGridStyle = "dots" | "lines";

export type TaskCanvas = {
  id: string;
  name: string;
  width: number;
  height: number;
  containers: ContainerElement[];
  textCards: TextCardElement[];
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
};

export type AppUpdateInfo = {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
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
      startClientX: number;
      startClientY: number;
      startPositions: Array<{
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
    }
  | {
      type: "select";
      pointerId: number;
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    };
