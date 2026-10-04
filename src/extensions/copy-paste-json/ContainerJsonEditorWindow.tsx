import { IconBraces, IconCheck, IconRefresh, IconX } from "@tabler/icons-react";
import {
  PointerEvent,
  WheelEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { MaterialSurface } from "../../ui/materials/MaterialSurface";
import { MENU_PRESENCE_TIMING, PRESENCE_PRESETS } from "../../ui/motion/presencePresets";
import { usePresenceMotion } from "../../ui/motion/usePresenceMotion";
import { Button, IconButton } from "../../ui/primitives/Button";
import { TextArea } from "../../ui/primitives/FormControls";
import "./ContainerJsonEditorWindow.css";

type ContainerJsonEditorWindowProps = {
  containerName: string;
  initialJson: string;
  onApply: (json: string) => void;
  onClose: () => void;
};

type WindowBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PointerAction = {
  type: "move" | "resize";
  resizeDirection?: ResizeDirection;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startBounds: WindowBounds;
};

type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const MIN_WIDTH = 380;
const MIN_HEIGHT = 280;
const MIN_FONT_SIZE = 9;
const MAX_FONT_SIZE = 24;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(value, maximum));

const getInitialBounds = (): WindowBounds => {
  const width = Math.min(620, window.innerWidth - 32);
  const height = Math.min(480, window.innerHeight - 32);
  return {
    left: Math.max(16, Math.round((window.innerWidth - width) / 2)),
    top: Math.max(16, Math.round((window.innerHeight - height) / 2)),
    width,
    height,
  };
};

export function ContainerJsonEditorWindow({
  containerName,
  initialJson,
  onApply,
  onClose,
}: ContainerJsonEditorWindowProps) {
  const [draft, setDraft] = useState(initialJson);
  const [bounds, setBounds] = useState(getInitialBounds);
  const [fontSize, setFontSize] = useState(12);
  const pointerActionRef = useRef<PointerAction | null>(null);
  const windowRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const presence = usePresenceMotion(windowRef, {
    channels: PRESENCE_PRESETS.materialFadeScale,
    enter: MENU_PRESENCE_TIMING.enter,
    exit: MENU_PRESENCE_TIMING.exit,
    initialProgress: 0,
    onComplete: (endpoint) => {
      if (endpoint === "hidden" && closingRef.current) onCloseRef.current();
    },
  });
  useLayoutEffect(() => presence.show(), [presence]);
  // Close and Escape play the exit; a successful Apply is closed by its owner.
  const requestClose = useCallback(() => {
    closingRef.current = true;
    presence.hide();
  }, [presence]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !windowRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      requestClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [requestClose]);

  const startPointerAction = (
    event: PointerEvent<HTMLElement>,
    type: PointerAction["type"],
    resizeDirection?: ResizeDirection,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerActionRef.current = {
      type,
      resizeDirection,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBounds: bounds,
    };
  };

  const movePointerAction = (event: PointerEvent<HTMLElement>) => {
    const action = pointerActionRef.current;
    if (!action || action.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - action.startClientX;
    const deltaY = event.clientY - action.startClientY;
    if (action.type === "move") {
      setBounds({
        ...action.startBounds,
        left: Math.max(
          8,
          Math.min(
            action.startBounds.left + deltaX,
            window.innerWidth - action.startBounds.width - 8,
          ),
        ),
        top: Math.max(
          8,
          Math.min(
            action.startBounds.top + deltaY,
            window.innerHeight - action.startBounds.height - 8,
          ),
        ),
      });
      return;
    }

    const direction = action.resizeDirection ?? "se";
    const start = action.startBounds;
    let left = start.left;
    let top = start.top;
    let width = start.width;
    let height = start.height;

    if (direction.includes("e")) {
      width = clamp(start.width + deltaX, MIN_WIDTH, window.innerWidth - start.left - 8);
    }
    if (direction.includes("s")) {
      height = clamp(start.height + deltaY, MIN_HEIGHT, window.innerHeight - start.top - 8);
    }
    if (direction.includes("w")) {
      left = clamp(start.left + deltaX, 8, start.left + start.width - MIN_WIDTH);
      width = start.width + start.left - left;
    }
    if (direction.includes("n")) {
      top = clamp(start.top + deltaY, 8, start.top + start.height - MIN_HEIGHT);
      height = start.height + start.top - top;
    }

    setBounds({ left, top, width, height });
  };

  const finishPointerAction = (event: PointerEvent<HTMLElement>) => {
    if (pointerActionRef.current?.pointerId !== event.pointerId) {
      return;
    }
    pointerActionRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const resizeHandleProps = (direction: ResizeDirection) => ({
    onPointerDown: (event: PointerEvent<HTMLDivElement>) =>
      startPointerAction(event, "resize", direction),
    onPointerMove: movePointerAction,
    onPointerUp: finishPointerAction,
    onPointerCancel: finishPointerAction,
  });

  const handleEditorWheel = (event: WheelEvent<HTMLTextAreaElement>) => {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setFontSize((current) =>
      clamp(current + (event.deltaY < 0 ? 1 : -1), MIN_FONT_SIZE, MAX_FONT_SIZE),
    );
  };

  return createPortal(
    <div className="taskmap-target-theme">
      <MaterialSurface
        ref={windowRef}
        material="acrylic-large"
        radius={12}
        role="dialog"
        aria-modal="false"
        aria-label={`Edit JSON for ${containerName}`}
        className="taskmap-json-editor"
        style={bounds}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <header
          className="taskmap-json-editor__header"
          onPointerDown={(event) => startPointerAction(event, "move")}
          onPointerMove={movePointerAction}
          onPointerUp={finishPointerAction}
          onPointerCancel={finishPointerAction}
        >
          <div className="taskmap-json-editor__identity">
            <IconBraces size={19} stroke={2} className="taskmap-json-editor__icon" />
            <h2 className="taskmap-json-editor__title">Copy/Paste JSON - {containerName}</h2>
          </div>
          <div
            className="taskmap-json-editor__actions"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="compact"
              leadingIcon={<IconRefresh size={16} stroke={2} />}
              onClick={() => setDraft(initialJson)}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="compact"
              leadingIcon={<IconCheck size={16} stroke={2} />}
              onClick={() => onApply(draft)}
            >
              Apply JSON
            </Button>
            <IconButton
              icon={<IconX size={17} stroke={2} />}
              variant="ghost"
              size="compact"
              aria-label="Close JSON editor"
              title="Close JSON editor"
              onClick={requestClose}
            />
          </div>
        </header>

        <TextArea
          className="taskmap-json-editor__text taskmap-scrollbar-thin"
          style={{ fontSize, lineHeight: `${Math.round(fontSize * 1.65)}px` }}
          value={draft}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onWheel={handleEditorWheel}
          aria-label="Container JSON"
        />

        <div
          className="absolute left-2 right-2 top-0 z-10 h-1 cursor-ns-resize"
          {...resizeHandleProps("n")}
        />
        <div
          className="absolute bottom-0 left-2 right-2 z-10 h-1 cursor-ns-resize"
          {...resizeHandleProps("s")}
        />
        <div
          className="absolute bottom-2 left-0 top-2 z-10 w-1 cursor-ew-resize"
          {...resizeHandleProps("w")}
        />
        <div
          className="absolute bottom-2 right-0 top-2 z-10 w-1 cursor-ew-resize"
          {...resizeHandleProps("e")}
        />
        <div
          className="absolute left-0 top-0 z-20 h-2 w-2 cursor-nwse-resize"
          {...resizeHandleProps("nw")}
        />
        <div
          className="absolute right-0 top-0 z-20 h-2 w-2 cursor-nesw-resize"
          {...resizeHandleProps("ne")}
        />
        <div
          className="absolute bottom-0 left-0 z-20 h-2 w-2 cursor-nesw-resize"
          {...resizeHandleProps("sw")}
        />
        <div
          className="absolute bottom-0 right-0 z-20 h-2 w-2 cursor-nwse-resize"
          {...resizeHandleProps("se")}
        />
      </MaterialSurface>
    </div>,
    document.body,
  );
}
