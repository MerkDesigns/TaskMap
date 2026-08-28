import {
  IconBox,
  IconCheck,
  IconFilter,
  IconInfoCircle,
  IconNotes,
  IconPhoto,
  IconPuzzle,
  IconSearch,
  IconShieldLock,
  IconSitemap,
  IconStar,
  IconTextSize,
} from "@tabler/icons-react";
import { RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  EXTENSIONS,
  EXTENSION_REGISTRY,
  type ExtensionDefinition,
  type ExtensionId,
  type ExtensionTargetType,
} from "../extensions/registry";
import { useExtensionDrag } from "../extensions/useExtensionDrag";
import {
  ExtensionBrowserCard,
  ExtensionIconBox,
  WorkspacePanelHeader,
  WorkspaceSidePanel,
} from "../ui/patterns/workspace";
import { IconButton } from "../ui/primitives/Button";
import { SearchField } from "../ui/primitives/FormControls";
import { ScrollArea } from "../ui/primitives/Layout";
import { useClampedFixedPosition } from "../useClampedFixedPosition";
import { SharedSmallGlassPlane } from "../ui/materials/SharedSmallGlassPlane";
import { useSettledPanelWork } from "../ui/patterns/workspace/useSettledPanelWork";
import { useSharedSmallGlassList } from "../ui/patterns/workspace/useSharedSmallGlassList";

export type { ExtensionId } from "../extensions/registry";

type ExtensionsPanelProps = {
  active?: boolean;
  closing: boolean;
  onDropExtension: (extensionId: ExtensionId, clientX: number, clientY: number) => void;
  onDragExtension?: (extensionId: ExtensionId | null, clientX?: number, clientY?: number) => void;
  embedded?: boolean;
  panelRef?: RefObject<HTMLDivElement | null>;
  sharedPanel?: boolean;
  smallGlassBlur?: number;
};

const TARGET_META: Record<ExtensionTargetType, { title: string; Icon: typeof IconBox }> = {
  container: { title: "Containers", Icon: IconBox },
  "text-block": { title: "Text blocks", Icon: IconNotes },
  "text-card": { title: "Text cards", Icon: IconTextSize },
  mindmap: { title: "Mindmaps", Icon: IconSitemap },
  image: { title: "Images", Icon: IconPhoto },
};

function ExtensionInfoButton({ targets }: { targets: readonly ExtensionTargetType[] }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });
  const targetItems = (
    <div className="flex flex-col gap-1">
      {targets.map((target) => {
        const TargetIcon = TARGET_META[target].Icon;

        return (
          <div key={target} className="flex items-center gap-1.5 whitespace-nowrap text-white/82">
            <TargetIcon size={14} stroke={2} className="text-white/48" />
            <span>{TARGET_META[target].title}</span>
          </div>
        );
      })}
    </div>
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const updateTooltipPosition = () => {
      const button = buttonRef.current;
      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const tooltipWidth = tooltipRef.current?.offsetWidth ?? 130;
      const tooltipHeight = tooltipRef.current?.offsetHeight ?? 40;
      const margin = 8;
      const left = Math.min(rect.right, window.innerWidth - tooltipWidth - margin);
      const top = Math.min(rect.bottom, window.innerHeight - tooltipHeight - margin);

      setTooltipPosition({ left: Math.max(left, margin), top: Math.max(top, margin) });
    };

    updateTooltipPosition();
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="grid h-6 w-6 place-items-center rounded-md border border-white/[0.10] bg-black/[0.20] text-white/42 transition-colors hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white/72"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <IconInfoCircle size={15} stroke={2} />
      </button>
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            className="pointer-events-none fixed z-[1001] w-max rounded-md border border-white/[0.16] bg-[#18191d] px-2 py-1.5 text-[13px] font-medium leading-4 text-white/82 shadow-[0_12px_28px_rgba(0,0,0,0.42)]"
            style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
          >
            {targetItems}
          </div>,
          document.body,
        )}
    </>
  );
}

const EXTENSION_FAVORITES_STORAGE_KEY = "taskmap.extensionFavorites";
const MAX_EXTENSION_FAVORITES = 5;

export function loadExtensionFavorites(): Partial<Record<ExtensionId, boolean>> {
  try {
    const stored = window.localStorage.getItem(EXTENSION_FAVORITES_STORAGE_KEY);
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored) as Partial<Record<ExtensionId, boolean>>;
    return Object.fromEntries(
      EXTENSIONS.filter((extension) => parsed[extension.id])
        .slice(0, MAX_EXTENSION_FAVORITES)
        .map((extension) => [extension.id, true]),
    ) as Partial<Record<ExtensionId, boolean>>;
  } catch {
    return {};
  }
}

type QuickExtensionsMenuProps = {
  left: number;
  top: number;
  onClose: () => void;
  onDropExtension: (extensionId: ExtensionId, clientX: number, clientY: number) => void;
  onDragExtension?: (extensionId: ExtensionId | null, clientX?: number, clientY?: number) => void;
};

export function QuickExtensionsMenu({
  left,
  top,
  onClose,
  onDropExtension,
  onDragExtension,
}: QuickExtensionsMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const favorites = loadExtensionFavorites();
  const position = useClampedFixedPosition(menuRef, { left: left + 10, top: top + 10 });
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredExtensions = EXTENSIONS.filter(
    (extension) =>
      !normalizedSearchQuery ||
      [
        extension.label,
        extension.description,
        ...extension.targets.map((target) => TARGET_META[target].title),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery),
  );
  const favoriteExtensions = filteredExtensions.filter((extension) => favorites[extension.id]);
  const otherExtensions = filteredExtensions.filter((extension) => !favorites[extension.id]);
  const { drag, startExtensionDrag } = useExtensionDrag({
    sourceRef: menuRef,
    onDropExtension,
    onDragExtension,
    onDropComplete: onClose,
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [onClose]);

  const renderCategory = (
    label: string,
    extensions: readonly ExtensionDefinition[],
    scrollable = false,
  ) => (
    <div className={scrollable ? "flex min-h-0 flex-1 flex-col" : ""}>
      <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
        {label}
      </div>
      <div
        className={`space-y-1 ${scrollable ? "quick-extensions-scroll min-h-0 overflow-y-auto pr-1.5" : ""}`}
      >
        {extensions.map((extension) => {
          const ExtensionIcon = extension.Icon;
          return (
            <div
              key={extension.id}
              className="flex h-[43px] w-full touch-none select-none items-center gap-2.5 rounded-md border border-white/[0.14] bg-[#15161a] px-2.5 text-white transition-colors hover:border-white/[0.24] hover:bg-[#1d1e24]"
              onPointerDown={(event) => startExtensionDrag(event, extension.id)}
              title={extension.label}
            >
              <ExtensionIcon size={22} stroke={2} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left text-[16px] font-medium text-white">
                {extension.label}
              </span>
              <ExtensionInfoButton targets={extension.targets} />
            </div>
          );
        })}
      </div>
    </div>
  );

  const DragIcon = drag ? EXTENSION_REGISTRY[drag.extensionId].Icon : IconPuzzle;

  return (
    <>
      <div
        ref={menuRef}
        data-quick-extensions-menu
        className="frosted-glass context-menu-enter fixed z-[1000] flex max-h-[516px] w-[269px] flex-col rounded-lg border border-white/[0.15] bg-[#1b1b1e]/94 p-2.5 text-white shadow-[0_14px_34px_rgba(0,0,0,0.48)]"
        style={position}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <label className="mb-2.5 flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/[0.10] bg-[#111216] px-2.5 text-white/42 focus-within:border-white/[0.20] focus-within:text-white/68">
          <IconSearch size={16} stroke={2} />
          <input
            ref={searchInputRef}
            className="min-w-0 flex-1 bg-transparent text-sm text-white/82 outline-none placeholder:text-white/32"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="Search extensions"
            spellCheck={false}
          />
        </label>
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          {favoriteExtensions.length > 0 && renderCategory("Favorited", favoriteExtensions)}
          {favoriteExtensions.length > 0 && otherExtensions.length > 0 && (
            <div className="h-px shrink-0 bg-white/[0.09]" />
          )}
          {otherExtensions.length > 0 &&
            renderCategory(
              favoriteExtensions.length > 0 ? "Not favorited" : "Extensions",
              otherExtensions,
              true,
            )}
          {filteredExtensions.length === 0 && (
            <div className="rounded-md border border-white/[0.10] bg-[#15161a] px-3 py-4 text-center text-sm text-white/42">
              No extensions found
            </div>
          )}
        </div>
      </div>
      {drag &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[1001] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg border border-white/[0.16] bg-[#15161a] text-white/78 shadow-[0_18px_48px_rgba(0,0,0,0.52)]"
            style={{ left: drag.clientX, top: drag.clientY }}
          >
            <DragIcon size={26} stroke={2} />
          </div>,
          document.body,
        )}
    </>
  );
}

export function ExtensionsPanel({
  active = true,
  closing,
  onDropExtension,
  onDragExtension,
  embedded = false,
  panelRef,
  sharedPanel = false,
  smallGlassBlur,
}: ExtensionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<ExtensionTargetType[]>(
    Object.keys(TARGET_META) as ExtensionTargetType[],
  );
  const [favorites, setFavorites] =
    useState<Partial<Record<ExtensionId, boolean>>>(loadExtensionFavorites);
  const localPanelRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const sharedSmallGlassPlaneRef = useRef<HTMLDivElement | null>(null);
  const [filterPosition, setFilterPosition] = useState({ left: 0, top: 0 });
  const activePanelRef = panelRef ?? localPanelRef;
  const workActive = useSettledPanelWork(active);
  useSharedSmallGlassList({
    active: workActive && !embedded,
    cardSelector: "[data-extension-card-id]",
    planeRef: sharedSmallGlassPlaneRef,
    viewportRef: scrollAreaRef,
  });
  const { drag, startExtensionDrag } = useExtensionDrag({
    sourceRef: activePanelRef,
    onDropExtension,
    onDragExtension,
  });

  useLayoutEffect(() => {
    if (!active) setFilterOpen(false);
  }, [active]);

  useEffect(() => {
    window.localStorage.setItem(EXTENSION_FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (!filterOpen) {
      return;
    }

    const updatePosition = () => {
      const button = filterButtonRef.current;
      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const width = filterMenuRef.current?.offsetWidth ?? 190;
      const height = filterMenuRef.current?.offsetHeight ?? 152;
      setFilterPosition({
        left: Math.max(8, Math.min(rect.right + 8, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(rect.top, window.innerHeight - height - 8)),
      });
    };
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (!filterButtonRef.current?.contains(target) && !filterMenuRef.current?.contains(target)) {
        setFilterOpen(false);
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [filterOpen]);

  const DragIcon = drag ? EXTENSION_REGISTRY[drag.extensionId].Icon : IconShieldLock;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const allTargetsSelected = selectedTargets.length === Object.keys(TARGET_META).length;
  const filteredExtensions = EXTENSIONS.filter((extension) => {
    const matchesTarget = extension.targets.some((target) => selectedTargets.includes(target));
    const matchesSearch =
      !normalizedSearchQuery ||
      [
        extension.label,
        extension.description,
        ...extension.targets.map((target) => TARGET_META[target].title),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery);
    return matchesTarget && matchesSearch;
  });
  const favoriteExtensions = filteredExtensions.filter((extension) => favorites[extension.id]);
  const otherExtensions = filteredExtensions.filter((extension) => !favorites[extension.id]);
  const favoriteCount = EXTENSIONS.filter((extension) => favorites[extension.id]).length;
  const renderExtensionCard = (extension: (typeof EXTENSIONS)[number]) => {
    const ExtensionIcon = extension.Icon;
    const favorited = Boolean(favorites[extension.id]);
    const favoriteLimitReached = !favorited && favoriteCount >= MAX_EXTENSION_FAVORITES;
    const favoriteTitle = favorited
      ? "Remove favorite"
      : favoriteLimitReached
        ? `Maximum ${MAX_EXTENSION_FAVORITES} favorites`
        : "Favorite";

    return (
      <ExtensionBrowserCard
        key={extension.id}
        embedded={embedded}
        geometryActive={workActive}
        data-extension-card-id={extension.id}
        onPointerDown={(event) => startExtensionDrag(event, extension.id)}
      >
        <ExtensionIconBox>
          <ExtensionIcon size={19} stroke={2} />
        </ExtensionIconBox>
        <span className="taskmap-extension-browser-card__copy">
          <span className="taskmap-extension-browser-card__title">{extension.label}</span>
          <span className="taskmap-extension-browser-card__description">
            {extension.description}
          </span>
        </span>
        <span className="taskmap-extension-browser-card__actions">
          <ExtensionInfoButton targets={extension.targets} />
          <IconButton
            variant="ghost"
            size="compact"
            className="taskmap-extension-browser-favorite"
            data-favorited={favorited || undefined}
            aria-label={favoriteTitle}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (favoriteLimitReached) {
                return;
              }
              setFavorites((current) => ({
                ...current,
                [extension.id]: !current[extension.id],
              }));
            }}
            title={favoriteTitle}
            disabled={favoriteLimitReached}
            icon={<IconStar size={15} stroke={2} fill={favorited ? "currentColor" : "none"} />}
          />
        </span>
      </ExtensionBrowserCard>
    );
  };

  const panelContent = (
    <>
      <WorkspacePanelHeader icon={<IconPuzzle size={17} stroke={2} />} title="Extensions" />

      <div className="taskmap-extension-browser-controls">
        <div className="taskmap-extension-browser-search">
          <SearchField
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search extensions"
            spellCheck={false}
            aria-label="Search extensions"
            prefixSlot={<IconSearch size={16} stroke={2} />}
          />
        </div>
        <IconButton
          ref={filterButtonRef}
          variant="secondary"
          className="taskmap-extension-browser-filter"
          data-filter-active={!allTargetsSelected || undefined}
          onClick={() => setFilterOpen((current) => !current)}
          title="Filter by element"
          aria-label="Filter by element"
          aria-expanded={filterOpen}
          icon={
            <>
              <IconFilter size={17} stroke={2} />
              {!allTargetsSelected && <span className="taskmap-extension-browser-filter__status" />}
            </>
          }
        />
      </div>

      {filterOpen &&
        createPortal(
          <div
            ref={filterMenuRef}
            data-extension-filter-menu
            className="taskmap-target-theme context-menu-panel context-menu-enter fixed z-[1001] w-[190px] rounded-lg border border-white/[0.15] bg-[#1b1b1e] p-1 text-sm text-white shadow-[0_14px_34px_rgba(0,0,0,0.48)]"
            style={filterPosition}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {(Object.keys(TARGET_META) as ExtensionTargetType[]).map((target) => {
              const selected = selectedTargets.includes(target);
              const TargetIcon = TARGET_META[target].Icon;

              return (
                <button
                  key={target}
                  type="button"
                  className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-white/76 transition-colors hover:bg-white/[0.10] hover:text-white"
                  onClick={() =>
                    setSelectedTargets((current) =>
                      current.includes(target)
                        ? current.filter((currentTarget) => currentTarget !== target)
                        : [...current, target],
                    )
                  }
                >
                  <TargetIcon size={16} stroke={2} className="text-white/48" />
                  <span className="flex-1">{TARGET_META[target].title}</span>
                  <span
                    className="taskmap-extension-filter-check"
                    data-selected={selected || undefined}
                  >
                    <IconCheck size={12} stroke={2} />
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}

      <div className="taskmap-extension-browser-scroll-frame min-h-0 flex-1">
        {!embedded && (
          <SharedSmallGlassPlane
            ref={sharedSmallGlassPlaneRef}
            batchId="extension-browser-small"
            blurPx={smallGlassBlur}
            kind="small-extension"
          />
        )}
        <ScrollArea
          ref={scrollAreaRef}
          hiddenScrollbar
          className="taskmap-extension-browser-scroll-area space-y-2"
        >
          {favoriteExtensions.length > 0 && (
            <div className="taskmap-extension-browser-section">
              <div className="taskmap-extension-browser-section__heading">Favorites</div>
              {favoriteExtensions.map(renderExtensionCard)}
            </div>
          )}
          {otherExtensions.length > 0 && (
            <div className="taskmap-extension-browser-section">
              {favoriteExtensions.length > 0 && (
                <div className="taskmap-extension-browser-section__heading taskmap-extension-browser-section__heading--continuation">
                  Extensions
                </div>
              )}
              {otherExtensions.map(renderExtensionCard)}
            </div>
          )}
          {filteredExtensions.length === 0 && (
            <div className="taskmap-extension-browser-empty">No extensions found</div>
          )}
        </ScrollArea>
      </div>
    </>
  );

  const dragPreview = drag && (
    <div
      data-extension-drag-preview
      className="pointer-events-none fixed z-[1000] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg border border-white/[0.16] bg-[#15161a] text-white/78 shadow-[0_18px_48px_rgba(0,0,0,0.52)]"
      style={{ left: drag.clientX, top: drag.clientY }}
    >
      <DragIcon size={26} stroke={2} />
    </div>
  );

  if (embedded || sharedPanel) {
    return (
      <>
        <div
          ref={panelRef ? undefined : localPanelRef}
          className="flex h-full min-h-0 flex-col"
          data-extension-browser-shared-panel={sharedPanel || undefined}
        >
          {panelContent}
        </div>
        {dragPreview && createPortal(dragPreview, document.body)}
      </>
    );
  }

  return (
    <>
      <WorkspaceSidePanel ref={localPanelRef} closing={closing} label="Extensions panel">
        {panelContent}
      </WorkspaceSidePanel>

      {dragPreview && createPortal(dragPreview, document.body)}
    </>
  );
}
