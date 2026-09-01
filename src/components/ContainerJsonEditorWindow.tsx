import { IconBraces, IconCheck, IconRefresh, IconX } from "@tabler/icons-react";
import { PointerEvent, WheelEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialSurface } from "../ui/materials/MaterialSurface";

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
    <MaterialSurface
      as="section"
      material="acrylic-large"
      radius={12}
      role="dialog"
      aria-modal="false"
      aria-label={`Edit JSON for ${containerName}`}
      className="fixed z-[1004] flex flex-col overflow-hidden text-white"
      style={bounds}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <header
        className="flex h-12 shrink-0 cursor-grab items-center justify-between border-b border-white/[0.10] px-3 active:cursor-grabbing"
        onPointerDown={(event) => startPointerAction(event, "move")}
        onPointerMove={movePointerAction}
        onPointerUp={finishPointerAction}
        onPointerCancel={finishPointerAction}
      >
        <div className="flex min-w-0 items-center gap-2">
          <IconBraces size={19} stroke={2} className="shrink-0 text-white/72" />
          <span className="truncate text-sm font-semibold text-white/85">
            Copy/Paste JSON - {containerName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-white/58 transition-colors hover:bg-white/[0.08] hover:text-white/82"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setDraft(initialJson)}
          >
            <IconRefresh size={16} stroke={2} />
            <span>Reset</span>
          </button>
          <button
            className="flex h-8 items-center gap-1.5 rounded-md bg-[#318f87] px-2.5 text-sm font-semibold text-white/92 transition-colors hover:bg-[#38a198]"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onApply(draft)}
          >
            <IconCheck size={16} stroke={2} />
            <span>Apply JSON</span>
          </button>
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
            title="Close JSON editor"
          >
            <IconX size={18} stroke={2} />
          </button>
        </div>
      </header>

      <textarea
        className="json-editor-scrollbar m-3 min-h-0 flex-1 resize-none rounded-lg border border-white/[0.12] bg-[#0f1014] p-3 font-mono text-white/78 outline-none selection:bg-[#318f87]/45 focus:border-white/25"
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
    </MaterialSurface>,
    document.body,
  );
}
