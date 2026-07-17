import { IconArrowDownRight, IconLoader2, IconPhotoPlus } from "@tabler/icons-react";
import { MouseEvent, PointerEvent, memo, useRef } from "react";
import { ImageElement } from "../types";

type ImageNodeProps = {
  image: ImageElement;
  url: string | null;
  loading?: boolean;
  entering?: boolean;
  deleting?: boolean;
  dragging?: boolean;
  moving?: boolean;
  resizing?: boolean;
  selected?: boolean;
  shadowsUnderElements: boolean;
  onStartMove: (event: PointerEvent<HTMLElement>, image: ImageElement) => void;
  onStartResize: (event: PointerEvent<HTMLButtonElement>, image: ImageElement) => void;
  onOpenMenu: (event: MouseEvent<HTMLElement>, image: ImageElement) => void;
  onPick: (id: string) => void;
};

function ImageNodeComponent({
  image,
  url,
  loading = false,
  entering = false,
  deleting = false,
  dragging = false,
  moving = false,
  resizing = false,
  selected = false,
  shadowsUnderElements,
  onStartMove,
  onStartResize,
  onOpenMenu,
  onPick,
}: ImageNodeProps) {
  const empty = !image.imageId;
  const loaded = !empty && !loading;
  const lastEmptyClickRef = useRef<{ time: number; x: number; y: number } | null>(null);
  // Background extension off: only show the image, no frame/border/shell, so a
  // transparent PNG reads as its real shape.
  const chromeless = loaded && image.background === false;
  const selectedAccent = selected
    ? `color-mix(in srgb, ${image.accent} 72%, white 28%)`
    : image.accent;

  return (
    <div
      className={`group/image absolute select-none overflow-hidden ${
        chromeless ? "border-0 bg-transparent" : "rounded-xl border bg-[color:var(--container-bg)]"
      } ${
        dragging
          ? "z-30 cursor-grabbing opacity-95 transition-none"
          : `z-20 cursor-grab ${
              moving || resizing
                ? "transition-none"
                : "transition-[top,left,width,height,box-shadow,opacity,border-color] duration-150 ease-out"
            }`
      } ${
        chromeless || shadowsUnderElements
          ? ""
          : `canvas-attached-shadow-card ${dragging || moving ? "canvas-attached-drag-shadow" : ""}`
      } ${entering ? "text-card-enter" : ""} ${deleting ? "text-card-exit pointer-events-none" : ""}`}
      style={{
        zIndex: dragging ? 10000 : 20 + (image.layer ?? 0),
        left: image.x,
        top: image.y,
        width: image.width,
        height: image.height,
        borderColor: chromeless ? undefined : selectedAccent,
      }}
      onPointerDown={(event) => {
        if (empty && event.button === 0) {
          const now = window.performance.now();
          const lastClick = lastEmptyClickRef.current;
          const doubleClick =
            lastClick &&
            now - lastClick.time < 420 &&
            Math.abs(event.clientX - lastClick.x) < 6 &&
            Math.abs(event.clientY - lastClick.y) < 6;

          if (doubleClick) {
            lastEmptyClickRef.current = null;
            event.preventDefault();
            event.stopPropagation();
            onPick(image.id);
            return;
          }

          lastEmptyClickRef.current = { time: now, x: event.clientX, y: event.clientY };
        }

        if (empty && event.detail > 1) {
          event.stopPropagation();
          return;
        }

        onStartMove(event, image);
      }}
      onContextMenu={(event) => onOpenMenu(event, image)}
    >
      {empty ? (
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-2 text-white/45">
          <IconPhotoPlus size={28} stroke={2} />
          <span className="text-[13px] font-medium">Double-click to add image</span>
          <span className="text-[11px] text-white/30">or drop a file here</span>
        </div>
      ) : loading ? (
        <div className="pointer-events-none flex h-full w-full items-center justify-center text-white/55">
          <IconLoader2 size={30} stroke={2} className="animate-spin" />
        </div>
      ) : (
        <img
          src={url ?? undefined}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
        />
      )}

      <button
        type="button"
        aria-label="Resize image"
        className="pointer-events-none absolute bottom-0 right-0 grid h-6 w-6 cursor-nwse-resize place-items-center rounded-tl-md text-white/55 opacity-0 transition-[opacity,background-color,color] duration-150 ease-out group-hover/image:pointer-events-auto group-hover/image:opacity-100 hover:bg-white/[0.12] hover:text-white focus-visible:pointer-events-auto focus-visible:opacity-100 focus:outline-none"
        onPointerDown={(event) => onStartResize(event, image)}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      >
        <IconArrowDownRight size={16} stroke={2} />
      </button>
      <div
        className={`selection-overlay pointer-events-none z-10 ${
          chromeless ? "" : "rounded-[inherit]"
        } ${selected ? "selection-overlay-active" : ""}`}
      />
    </div>
  );
}

export const ImageNode = memo(ImageNodeComponent);
