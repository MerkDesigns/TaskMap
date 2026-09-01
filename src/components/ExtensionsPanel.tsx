import {
  IconBox,
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
import {
  RefObject,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
import { Checkbox } from "../ui/primitives/SelectionControls";
import { ScrollArea } from "../ui/primitives/Layout";
import { Tooltip } from "../ui/primitives/Tooltip";
import { MaterialSurface } from "../ui/materials/MaterialSurface";
import { useClampedFixedPosition } from "../useClampedFixedPosition";
import { SharedSmallGlassPlane } from "../ui/materials/SharedSmallGlassPlane";
import { FadeLift } from "../ui/motion/presenceController";
import { MOTION_DURATION_MS } from "../ui/motion/motionTokens";
import { useSurfacePresence } from "../ui/motion/useSurfacePresence";
import { useSettledPanelWork } from "../ui/patterns/workspace/useSettledPanelWork";
import { useSharedSmallGlassList } from "../ui/patterns/workspace/useSharedSmallGlassList";
import "./QuickExtensionsMenu.css";

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

  return (
    <Tooltip label={targetItems} openDelayMs={500}>
      <button
        type="button"
        aria-label="Compatible elements"
        className="taskmap-extension-info-button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <IconInfoCircle size={15} stroke={2} />
      </button>
    </Tooltip>
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
  majorRadius?: number;
  minorRadius?: number;
  iconRadius?: number;
  iconBackgroundOpacity?: number;
  open: boolean;
  onExitComplete: () => void;
  onRequestClose: () => void;
  onDropExtension: (extensionId: ExtensionId, clientX: number, clientY: number) => void;
  onDragExtension?: (extensionId: ExtensionId | null, clientX?: number, clientY?: number) => void;
};

export function QuickExtensionsMenu({
  left,
  top,
  majorRadius = 17,
  minorRadius = 9,
  iconRadius = 7,
  iconBackgroundOpacity = 0.75,
  open,
  onExitComplete,
  onRequestClose,
  onDropExtension,
  onDragExtension,
}: QuickExtensionsMenuProps) {
  const menuRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const sharedSmallGlassPlaneRef = useRef<HTMLDivElement | null>(null);
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
  const geometryActive = useDeferredValue(open, false);
  const presence = useSurfacePresence(menuRef, {
    effects: FadeLift,
    durationMs: MOTION_DURATION_MS.normal,
    initialProgress: open ? 0 : 1,
    onComplete: (endpoint) => {
      if (endpoint === "hidden") onExitComplete();
    },
  });
  useLayoutEffect(() => {
    if (open) presence.show();
    else presence.hide();
  }, [open, presence]);
  const requestClose = useCallback(() => onRequestClose(), [onRequestClose]);
  const { drag, startExtensionDrag } = useExtensionDrag({
    sourceRef: menuRef,
    onDropExtension,
    onDragExtension,
    onDropComplete: requestClose,
  });
  useSharedSmallGlassList({
    active: geometryActive,
    cardSelector: "[data-extension-card-id]",
    planeRef: sharedSmallGlassPlaneRef,
    viewportRef: scrollAreaRef,
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
        requestClose();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [requestClose]);

  const renderCategory = (
    label: string,
    extensions: readonly ExtensionDefinition[],
    scrollable = false,
  ) => (
    <div
      className={
        scrollable
          ? "taskmap-quick-extensions-menu__category taskmap-quick-extensions-menu__category--scrollable"
          : "taskmap-quick-extensions-menu__category"
      }
    >
      <div className="taskmap-quick-extensions-menu__heading">{label}</div>
      <div
        data-shared-small-glass-viewport={scrollable || undefined}
        className={
          scrollable
            ? "taskmap-quick-extensions-menu__list quick-extensions-scroll taskmap-quick-extensions-menu__list--scrollable"
            : "taskmap-quick-extensions-menu__list"
        }
      >
        {extensions.map((extension) => {
          const ExtensionIcon = extension.Icon;
          return (
            <ExtensionBrowserCard
              key={extension.id}
              embedded={false}
              radius={minorRadius}
              data-extension-card-id={extension.id}
              className="taskmap-quick-extensions-menu__card"
              onPointerDown={(event) => startExtensionDrag(event, extension.id)}
            >
              <ExtensionIconBox
                radius={iconRadius}
                style={
                  {
                    "--taskmap-material-fill-opacity": iconBackgroundOpacity,
                  } as CSSProperties
                }
              >
                <ExtensionIcon size={19} stroke={2} />
              </ExtensionIconBox>
              <span className="taskmap-extension-browser-card__title">{extension.label}</span>
              <span className="taskmap-extension-browser-card__actions">
                <ExtensionInfoButton targets={extension.targets} />
              </span>
            </ExtensionBrowserCard>
          );
        })}
      </div>
    </div>
  );

  const DragIcon = drag ? EXTENSION_REGISTRY[drag.extensionId].Icon : IconPuzzle;

  return (
    <>
      <MaterialSurface
        ref={menuRef}
        data-quick-extensions-menu
        data-closing={!open || undefined}
        material="acrylic-large"
        elevation="none"
        radius={majorRadius}
        className="taskmap-quick-extensions-menu"
        style={position}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="taskmap-quick-extensions-menu__search taskmap-quick-extensions-menu__fade-content">
          <SearchField
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                requestClose();
              }
            }}
            placeholder="Search extensions"
            spellCheck={false}
            aria-label="Search extensions"
            prefixSlot={<IconSearch size={16} stroke={2} />}
          />
        </div>
        <div className="taskmap-quick-extensions-menu__scroll-frame">
          <SharedSmallGlassPlane
            ref={sharedSmallGlassPlaneRef}
            batchId="quick-extension-browser-small"
            kind="small-extension"
          />
          <div ref={scrollAreaRef} className="taskmap-quick-extensions-menu__content">
            {favoriteExtensions.length > 0 && renderCategory("Favorited", favoriteExtensions)}
            {otherExtensions.length > 0 &&
              renderCategory(
                favoriteExtensions.length > 0 ? "Not favorited" : "Extensions",
                otherExtensions,
                true,
              )}
            {filteredExtensions.length === 0 && (
              <div className="taskmap-extension-browser-empty">No extensions found</div>
            )}
          </div>
        </div>
      </MaterialSurface>
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
  const deferredActive = useDeferredValue(active && !closing, false);
  const workActive = useSettledPanelWork(deferredActive);
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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("pointerdown", closeOnOutsidePointer, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      window.removeEventListener("keydown", closeOnEscape);
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
          <MaterialSurface
            ref={filterMenuRef}
            material="opaque"
            radius={8}
            data-extension-filter-menu
            className="taskmap-target-theme context-menu-panel context-menu-enter fixed z-[1001] w-[190px] p-1 text-sm text-white"
            style={filterPosition}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {(Object.keys(TARGET_META) as ExtensionTargetType[]).map((target) => {
              const selected = selectedTargets.includes(target);
              const TargetIcon = TARGET_META[target].Icon;

              return (
                <Checkbox
                  key={target}
                  className="taskmap-extension-filter-option"
                  checked={selected}
                  onChange={() =>
                    setSelectedTargets((current) =>
                      current.includes(target)
                        ? current.filter((currentTarget) => currentTarget !== target)
                        : [...current, target],
                    )
                  }
                  label={
                    <>
                      <TargetIcon size={16} stroke={2} className="text-white/48" />
                      <span>{TARGET_META[target].title}</span>
                    </>
                  }
                />
              );
            })}
          </MaterialSurface>,
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
