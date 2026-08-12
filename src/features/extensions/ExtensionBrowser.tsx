import { ActionIcon, Menu, TextInput, Tooltip } from "@mantine/core";
import {
  IconBox,
  IconFilter,
  IconInfoCircle,
  IconNotes,
  IconPhoto,
  IconPuzzle,
  IconSearch,
  IconSitemap,
  IconStar,
  IconTextSize,
} from "@tabler/icons-react";
import type { ExtensionId, ExtensionTargetType } from "../../extensions/registry";
import {
  filterExtensions,
  MAX_EXTENSION_FAVORITES,
  type ExtensionFavorites,
  type ExtensionTargetFilter,
} from "./extensionBrowserModel";
import { useExtensionDragPreview } from "./useExtensionDragPreview";

const TARGETS: ReadonlyArray<{
  readonly id: ExtensionTargetType;
  readonly label: string;
  readonly Icon: typeof IconBox;
}> = [
  { id: "container", label: "Containers", Icon: IconBox },
  { id: "text-block", label: "Text blocks", Icon: IconNotes },
  { id: "text-card", label: "Text cards", Icon: IconTextSize },
  { id: "mindmap", label: "Mindmaps", Icon: IconSitemap },
  { id: "image", label: "Images", Icon: IconPhoto },
];

export interface ExtensionBrowserProps {
  readonly query: string;
  readonly target: ExtensionTargetFilter;
  readonly favorites: ExtensionFavorites;
  readonly onQueryChange: (query: string) => void;
  readonly onTargetChange: (target: ExtensionTargetFilter) => void;
  readonly onToggleFavorite: (extensionId: ExtensionId) => void;
  readonly onDropExtension?: (extensionId: ExtensionId, x: number, y: number) => void;
}

export function ExtensionBrowser(props: ExtensionBrowserProps) {
  const extensions = filterExtensions(props.query, props.target);
  const favorites = extensions.filter((extension) => props.favorites[extension.id]);
  const others = extensions.filter((extension) => !props.favorites[extension.id]);
  const favoriteCount = Object.values(props.favorites).filter(Boolean).length;
  const startDrag = useExtensionDragPreview(props.onDropExtension);

  return (
    <section className="taskmap-extension-browser" aria-label="Extensions">
      <header className="taskmap-browser-header">
        <div className="taskmap-browser-heading">
          <IconPuzzle size={19} />
          <strong>Extensions</strong>
          <span className="taskmap-browser-count">{extensions.length}</span>
        </div>
      </header>
      <div className="taskmap-extension-browser__tools">
        <TextInput
          size="sm"
          leftSection={<IconSearch size={15} />}
          placeholder="Search extensions"
          aria-label="Search extensions"
          value={props.query}
          onChange={(event) => props.onQueryChange(event.currentTarget.value)}
        />
        <Menu withinPortal position="bottom-end" closeOnItemClick>
          <Menu.Target>
            <ActionIcon
              variant={props.target === "all" ? "subtle" : "light"}
              color={props.target === "all" ? "gray" : "cyan"}
              size={36}
              aria-label="Filter extensions by target"
            >
              <IconFilter size={17} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Compatible target</Menu.Label>
            <Menu.Item onClick={() => props.onTargetChange("all")}>All targets</Menu.Item>
            {TARGETS.map(({ id, label, Icon }) => (
              <Menu.Item
                key={id}
                leftSection={<Icon size={15} />}
                onClick={() => props.onTargetChange(id)}
              >
                {label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </div>
      <div className="taskmap-extension-browser__list">
        {favorites.length ? (
          <ExtensionSection
            label="Favorites"
            extensions={favorites}
            favorites={props.favorites}
            favoriteCount={favoriteCount}
            onToggleFavorite={props.onToggleFavorite}
            onPointerDown={startDrag}
          />
        ) : null}
        <ExtensionSection
          label="Extensions"
          extensions={others}
          favorites={props.favorites}
          favoriteCount={favoriteCount}
          onToggleFavorite={props.onToggleFavorite}
          onPointerDown={startDrag}
        />
        {!extensions.length ? (
          <p className="taskmap-browser-empty">No matching extensions.</p>
        ) : null}
      </div>
      <p className="taskmap-extension-browser__drop-note">
        Drag previews are ready; canvas drop targets arrive with element rendering.
      </p>
    </section>
  );
}

function ExtensionSection({
  label,
  extensions,
  favorites,
  favoriteCount,
  onToggleFavorite,
  onPointerDown,
}: {
  readonly label: string;
  readonly extensions: ReturnType<typeof filterExtensions>;
  readonly favorites: ExtensionFavorites;
  readonly favoriteCount: number;
  readonly onToggleFavorite: (id: ExtensionId) => void;
  readonly onPointerDown: ReturnType<typeof useExtensionDragPreview>;
}) {
  return (
    <div className="taskmap-extension-section">
      <div className="taskmap-extension-section__label">{label}</div>
      {extensions.map((extension) => {
        const ExtensionIcon = extension.Icon;
        const favorite = Boolean(favorites[extension.id]);
        const favoriteDisabled = !favorite && favoriteCount >= MAX_EXTENSION_FAVORITES;
        return (
          <div
            key={extension.id}
            className="taskmap-extension-card"
            onPointerDown={(event) => onPointerDown(extension.id, event)}
          >
            <ExtensionIcon className="taskmap-extension-card__icon" size={22} />
            <div className="taskmap-extension-card__copy">
              <strong>{extension.label}</strong>
              <span>{extension.description}</span>
            </div>
            <Tooltip
              label={extension.targets
                .map((target) => TARGETS.find(({ id }) => id === target)?.label ?? target)
                .join(", ")}
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Compatible targets"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <IconInfoCircle size={15} />
              </ActionIcon>
            </Tooltip>
            <ActionIcon
              variant="subtle"
              color={favorite ? "yellow" : "gray"}
              size="sm"
              disabled={favoriteDisabled}
              aria-label={
                favorite
                  ? `Remove ${extension.label} from favorites`
                  : `Favorite ${extension.label}`
              }
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onToggleFavorite(extension.id)}
            >
              <IconStar size={16} fill={favorite ? "currentColor" : "none"} />
            </ActionIcon>
          </div>
        );
      })}
    </div>
  );
}
