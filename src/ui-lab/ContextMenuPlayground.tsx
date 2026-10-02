import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { CanvasContextMenu, ContainerContextMenu } from "../components/ContextMenus";
import { asEntityId } from "../domain/ids/entityIds";
import { ContainerRenderer } from "../elements/container/ContainerRenderer";
import type { ContainerDocumentElement } from "../elements/container/containerModel";
import type { ContainerActions } from "../elements/container/containerView";
import { EXTENSION_REGISTRY } from "../extensions/registry";
import { CanvasFrame } from "../ui/patterns/workspace/CanvasFrame";
import type { ContainerElement, ContainerMenuState, ElementExtensions } from "../types";
import "./uiLab.css";

type PlaygroundMenu =
  | { readonly kind: "container"; readonly value: ContainerMenuState }
  | { readonly kind: "canvas"; readonly value: { clientX: number; clientY: number } };

const CONTENT_REVISION = {};

const PLAYGROUND_ID = "element-00000000-0000-4000-8000-0000000000a1";
const PLAYGROUND_CANVAS_ID = asEntityId("canvas", "canvas-00000000-0000-4000-8000-0000000000a2");

function createPlaygroundContainer(): ContainerElement {
  return {
    id: PLAYGROUND_ID,
    name: "Production Container",
    x: 56,
    y: 56,
    width: 440,
    height: 260,
    accent: "#9f4f42",
    headerButtonsVisible: true,
    extensions: {
      search: EXTENSION_REGISTRY.search.createDefault(),
      lock: EXTENSION_REGISTRY.lock.createDefault(),
      colorPicker: EXTENSION_REGISTRY.colorPicker.createDefault(),
    },
  };
}

/** The renderer reads document elements; the playground keeps a retained-shape container for its menu. */
function toDocumentElement(element: ContainerElement): ContainerDocumentElement {
  return {
    id: asEntityId("element", element.id),
    canvasId: PLAYGROUND_CANVAS_ID,
    type: "container",
    geometry: { x: element.x, y: element.y, width: element.width, height: element.height },
    data: {
      name: element.name,
      accent: element.accent,
      headerButtonsVisible: element.headerButtonsVisible ?? true,
    },
  };
}

export function ContextMenuPlayground() {
  const [element, setElement] = useState(createPlaygroundContainer);
  const [menu, setMenu] = useState<PlaygroundMenu | null>(null);
  const [selected, setSelected] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(element.name);

  const openContainerMenu = (
    event: ReactMouseEvent<HTMLElement>,
    target: ContainerElement = element,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({
      kind: "container",
      value: { id: target.id, left: event.clientX, top: event.clientY },
    });
  };

  const removeExtension = (extensionId: keyof ElementExtensions) => {
    setElement((current) => {
      const extensions = { ...current.extensions };
      delete extensions[extensionId];
      return { ...current, extensions };
    });
    setMenu(null);
  };

  const closeMenu = () => setMenu(null);
  const documentElement = useMemo(() => toDocumentElement(element), [element]);
  const actions: ContainerActions = {
    onRenameDraftChange: setRenameDraft,
    onSaveRename: () => {
      setElement((current) => ({ ...current, name: renameDraft.trim() || current.name }));
      setRenaming(false);
    },
    onCancelRename: () => setRenaming(false),
    onSelect: () => setSelected(true),
    onStartMove: (event) => event.preventDefault(),
    onStartResize: (event) => event.preventDefault(),
    onToggleMenu: (event) => openContainerMenu(event),
    onTogglePrivacy: () => undefined,
    onToggleLock: () =>
      setElement((current) => ({
        ...current,
        extensions: {
          ...current.extensions,
          lock: { enabled: !current.extensions?.lock?.enabled },
        },
      })),
    onUpdateAccent: (_, accent) => setElement((current) => ({ ...current, accent })),
    onRememberRecentColor: () => undefined,
    onCopyJsonForAi: async () => undefined,
    onPasteJsonFromAi: async () => undefined,
    onOpenJsonEditor: () => undefined,
    onHeaderButtonsVisibleChange: (_, visible) =>
      setElement((current) => ({ ...current, headerButtonsVisible: visible })),
    onSearchChange: (_, query) =>
      setElement((current) => ({
        ...current,
        extensions: { ...current.extensions, search: { query } },
      })),
    onOpenContentMenu: (event) => openContainerMenu(event),
    onWheelContent: () => undefined,
    onStartContentSelection: (event) => event.stopPropagation(),
  };

  return (
    <section
      className="taskmap-ui-lab-context-menu"
      aria-labelledby="context-menu-playground-title"
      onPointerDownCapture={(event) => {
        if (!(event.target as Element).closest("[data-context-menu]")) closeMenu();
      }}
    >
      <div className="taskmap-ui-lab-prototype__heading">
        <span className="taskmap-ui-lab__eyebrow">Production canvas interaction</span>
        <h2 id="context-menu-playground-title">Context Menu playground</h2>
        <p>Right-click the Container or empty canvas space.</p>
      </div>

      <CanvasFrame
        className="taskmap-ui-lab-context-menu__canvas"
        aria-label="Context menu playground canvas"
        data-grid-style="dots"
        onContextMenu={(event) => {
          event.preventDefault();
          if (event.target !== event.currentTarget) return;
          setSelected(false);
          setMenu({
            kind: "canvas",
            value: { clientX: event.clientX, clientY: event.clientY },
          });
        }}
      >
        <div className="taskmap-ui-lab-context-menu__container" onContextMenu={openContainerMenu}>
          <ContainerRenderer
            element={documentElement}
            actions={actions}
            view={{
              layer: 0,
              extensions: element.extensions,
              cardCount: 0,
              selected,
              multiSelected: false,
              entering: false,
              deleting: false,
              moving: false,
              shadowsUnderElements: false,
              recentColors: [],
              renaming,
              renameDraft,
              contentRevision: CONTENT_REVISION,
              contentEditRevision: "ui-lab-context-menu",
            }}
          />
        </div>
      </CanvasFrame>

      {menu?.kind === "container" ? (
        <ContainerContextMenu
          menu={menu.value}
          element={element}
          closing={false}
          onStartRename={() => {
            setRenameDraft(element.name);
            setRenaming(true);
            closeMenu();
          }}
          onUpdateAccent={(_, accent) => setElement((current) => ({ ...current, accent }))}
          onCut={closeMenu}
          onCopy={closeMenu}
          onRemovePrivacyExtension={() => removeExtension("privacy")}
          onRemoveSearchExtension={() => removeExtension("search")}
          onRemoveLockExtension={() => removeExtension("lock")}
          onRemoveColorPickerExtension={() => removeExtension("colorPicker")}
          onRemoveAutoCheckboxExtension={() => removeExtension("autoCheckbox")}
          onRemoveCounterExtension={() => removeExtension("counter")}
          onRemoveInheritCardColorExtension={() => removeExtension("inheritCardColor")}
          onRemoveCopyPasteJsonExtension={() => removeExtension("copyPasteJson")}
          onMoveLayer={closeMenu}
          onDelete={closeMenu}
        />
      ) : null}

      {menu?.kind === "canvas" ? (
        <CanvasContextMenu
          menu={menu.value}
          hasCopiedItem={false}
          closing={false}
          onPaste={closeMenu}
          onCreate={closeMenu}
          onCreateTextCard={closeMenu}
          onCreateTextBlock={closeMenu}
          onCreateImage={closeMenu}
          onCreateMindmap={closeMenu}
          onClear={closeMenu}
        />
      ) : null}
    </section>
  );
}
