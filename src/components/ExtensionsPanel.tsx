import {
  IconBox,
  IconLock,
  IconNotes,
  IconPalette,
  IconPhoto,
  IconPencil,
  IconSearch,
  IconShieldLock,
  IconSortAZ,
} from "@tabler/icons-react";
import { PointerEvent, useEffect, useRef, useState } from "react";

type ExtensionId = "privacy" | "lock" | "colors" | "search" | "sorting";

type ExtensionsPanelProps = {
  closing: boolean;
  onDropExtension: (extensionId: ExtensionId, clientX: number, clientY: number) => void;
};

function TargetTags({ targets }: { targets: Array<"container" | "textblock" | "textcard" | "image"> }) {
  const tagMeta = {
    container: { title: "Containers", icon: <IconBox size={13} stroke={2} /> },
    textblock: { title: "Text blocks", icon: <IconNotes size={13} stroke={2} /> },
    textcard: { title: "Text cards", icon: <IconPencil size={13} stroke={2} /> },
    image: { title: "Images", icon: <IconPhoto size={13} stroke={2} /> },
  } as const;

  return (
    <span className="absolute right-2 top-2 flex items-center gap-1">
      {targets.map((target) => (
        <span
          key={target}
          className="grid h-5 w-5 place-items-center rounded border border-white/[0.10] bg-black/[0.18] text-white/48"
          title={tagMeta[target].title}
        >
          {tagMeta[target].icon}
        </span>
      ))}
    </span>
  );
}

const DRAG_META: Record<ExtensionId, { label: string; Icon: typeof IconShieldLock }> = {
  privacy: { label: "Privacy", Icon: IconShieldLock },
  lock: { label: "Lock", Icon: IconLock },
  colors: { label: "More colors", Icon: IconPalette },
  search: { label: "Search", Icon: IconSearch },
  sorting: { label: "Sorting", Icon: IconSortAZ },
};

export function ExtensionsPanel({ closing, onDropExtension }: ExtensionsPanelProps) {
  const [drag, setDrag] = useState<{ extensionId: ExtensionId; clientX: number; clientY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!drag) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      setDrag((current) =>
        current ? { ...current, clientX: event.clientX, clientY: event.clientY } : current,
      );
    };

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      const releaseTarget = document.elementFromPoint(event.clientX, event.clientY);
      if (releaseTarget && panelRef.current?.contains(releaseTarget)) {
        setDrag(null);
        return;
      }

      onDropExtension(drag.extensionId, event.clientX, event.clientY);
      setDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd, { once: true });
    window.addEventListener("pointercancel", handlePointerEnd, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [drag, onDropExtension]);

  const startExtensionDrag = (event: PointerEvent<HTMLButtonElement>, extensionId: ExtensionId) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDrag({ extensionId, clientX: event.clientX, clientY: event.clientY });
  };

  const DragIcon = drag ? DRAG_META[drag.extensionId].Icon : IconShieldLock;

  return (
    <>
      <div
        ref={panelRef}
        className={`frosted-glass fixed left-4 top-16 z-30 flex max-h-[calc(100vh-5rem)] w-[290px] flex-col rounded-xl border border-white/[0.15] bg-[#1b1b1e]/94 p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-sm ${
          closing ? "side-panel-exit pointer-events-none" : "side-panel-enter"
        }`}
      >
        <div className="mb-3 flex h-8 items-center justify-between">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-white/48">Extensions</div>
        </div>

        <div className="canvas-browser-scroll min-h-0 flex-1 space-y-2 overflow-y-auto">
          <button
            className="relative flex w-full touch-none select-none items-center gap-2.5 rounded-lg border border-white/[0.10] bg-[#15161a] p-2.5 pr-14 text-left transition-colors hover:bg-[#1d1e24]"
            onPointerDown={(event) => startExtensionDrag(event, "privacy")}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-black/[0.18] text-white/72">
              <IconShieldLock size={19} stroke={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">Privacy</span>
              <span className="block text-xs leading-5 text-white/42">Blur element content</span>
            </span>
            <TargetTags targets={["container", "textblock"]} />
          </button>
          <button
            className="relative flex w-full touch-none select-none items-center gap-2.5 rounded-lg border border-white/[0.10] bg-[#15161a] p-2.5 pr-14 text-left transition-colors hover:bg-[#1d1e24]"
            onPointerDown={(event) => startExtensionDrag(event, "lock")}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-black/[0.18] text-white/72">
              <IconLock size={19} stroke={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">Lock</span>
              <span className="block text-xs leading-5 text-white/42">Lock move, resize &amp; deletion</span>
            </span>
            <TargetTags targets={["container", "textblock", "textcard", "image"]} />
          </button>
          <button
            className="relative flex w-full touch-none select-none items-center gap-2.5 rounded-lg border border-white/[0.10] bg-[#15161a] p-2.5 pr-14 text-left transition-colors hover:bg-[#1d1e24]"
            onPointerDown={(event) => startExtensionDrag(event, "colors")}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-black/[0.18] text-white/72">
              <IconPalette size={19} stroke={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">More colors</span>
              <span className="block text-xs leading-5 text-white/42">Unlock 7 extra accents</span>
            </span>
            <TargetTags targets={["container", "textblock", "textcard"]} />
          </button>
          <button
            className="relative flex w-full touch-none select-none items-center gap-2.5 rounded-lg border border-white/[0.10] bg-[#15161a] p-2.5 pr-14 text-left transition-colors hover:bg-[#1d1e24]"
            onPointerDown={(event) => startExtensionDrag(event, "search")}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-black/[0.18] text-white/72">
              <IconSearch size={19} stroke={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">Search</span>
              <span className="block text-xs leading-5 text-white/42">Filter container cards</span>
            </span>
            <TargetTags targets={["container"]} />
          </button>
          <button
            className="relative flex w-full touch-none select-none items-center gap-2.5 rounded-lg border border-white/[0.10] bg-[#15161a] p-2.5 pr-14 text-left transition-colors hover:bg-[#1d1e24]"
            onPointerDown={(event) => startExtensionDrag(event, "sorting")}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-black/[0.18] text-white/72">
              <IconSortAZ size={19} stroke={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">Sorting</span>
              <span className="block text-xs leading-5 text-white/42">Sort container cards</span>
            </span>
            <TargetTags targets={["container"]} />
          </button>
        </div>
      </div>

      {drag && (
        <div
          className="pointer-events-none fixed z-[1000] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg border border-white/[0.16] bg-[#15161a] text-white/78 shadow-[0_18px_48px_rgba(0,0,0,0.52)]"
          style={{ left: drag.clientX, top: drag.clientY }}
        >
          <DragIcon size={26} stroke={2} />
        </div>
      )}
    </>
  );
}
