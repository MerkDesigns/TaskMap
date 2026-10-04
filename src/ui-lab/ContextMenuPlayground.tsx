import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { CanvasContextMenu } from "../components/ContextMenus";
import { asEntityId } from "../domain/ids/entityIds";
import { ContainerMenu, type ContainerMenuActions } from "../elements/container/ContainerMenu";
import type { ContainerDocumentElement } from "../elements/container/containerModel";
import { ContainerRenderer } from "../elements/container/ContainerRenderer";
import type { ContainerActions } from "../elements/container/containerView";
import type { ExtensionCommands } from "../extensions/extensionCommands";
import type { ElementExtensions } from "../types";
import { CanvasFrame } from "../ui/patterns/workspace/CanvasFrame";
import "./uiLab.css";

type PlaygroundMenu =
  | { readonly kind: "container"; readonly value: { left: number; top: number } }
  | { readonly kind: "canvas"; readonly value: { clientX: number; clientY: number } };

const CONTENT_REVISION = {};

const PLAYGROUND_CONTAINER: ContainerDocumentElement = {
  id: asEntityId("element", "element-00000000-0000-4000-8000-0000000000a1"),
  canvasId: asEntityId("canvas", "canvas-00000000-0000-4000-8000-0000000000a2"),
  type: "container",
  geometry: { x: 56, y: 56, width: 440, height: 260 },
  data: { name: "Production Container", accent: "#9f4f42", headerButtonsVisible: true },
};

const PLAYGROUND_EXTENSIONS: ElementExtensions = {
  search: { query: "" },
  lock: { enabled: true },
  colorPicker: { enabled: true },
};

export function ContextMenuPlayground() {
  const [element, setElement] = useState(PLAYGROUND_CONTAINER);
  const [extensions, setExtensions] = useState(PLAYGROUND_EXTENSIONS);
  const [menu, setMenu] = useState<PlaygroundMenu | null>(null);
  const [selected, setSelected] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(element.data.name);

  const updateData = (data: Partial<ContainerDocumentElement["data"]>) =>
    setElement((current) => ({ ...current, data: { ...current.data, ...data } }));
  const openContainerMenu = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ kind: "container", value: { left: event.clientX, top: event.clientY } });
  };
  const closeMenu = () => setMenu(null);

  const actions: ContainerActions = {
    onRenameDraftChange: setRenameDraft,
    onSaveRename: () => {
      updateData({ name: renameDraft.trim() || element.data.name });
      setRenaming(false);
    },
    onCancelRename: () => setRenaming(false),
    onSelect: () => setSelected(true),
    onStartMove: (event) => event.preventDefault(),
    onStartResize: (event) => event.preventDefault(),
    onToggleMenu: (event) => openContainerMenu(event),
    onHeaderButtonsVisibleChange: (_, visible) => updateData({ headerButtonsVisible: visible }),
    onOpenContentMenu: (event) => openContainerMenu(event),
    onWheelContent: () => undefined,
    onStartContentSelection: (event) => event.stopPropagation(),
  };

  const extensionCommands: ExtensionCommands = {
    toggle: (extension) => {
      if (extension === "checkbox") return;
      setExtensions((current) => ({
        ...current,
        [extension]: { enabled: !current[extension]?.enabled },
      }));
    },
    remove: (extension) => {
      setExtensions((current) => {
        const next = { ...current };
        delete next[extension];
        return next;
      });
      closeMenu();
    },
    updateAccent: (_, accent) => updateData({ accent }),
    updateSelectionAccent: (_, accent) => updateData({ accent }),
    setSearchQuery: (_, query) => setExtensions((current) => ({ ...current, search: { query } })),
    rememberRecentColor: () => undefined,
    copyJsonForAi: async () => undefined,
    pasteJsonFromAi: async () => undefined,
    openJsonEditor: () => undefined,
    openWorkflowEditor: () => undefined,
    runWorkflow: async () => undefined,
    stopWorkflow: async () => undefined,
    subscribeWorkflowRuns: () => () => undefined,
    getWorkflowRun: () => null,
  };

  const menuActions: ContainerMenuActions = {
    onStartRename: () => {
      setRenameDraft(element.data.name);
      setRenaming(true);
      closeMenu();
    },
    onUpdateAccent: (_, accent) => updateData({ accent }),
    onCut: closeMenu,
    onCopy: closeMenu,
    onMoveLayer: closeMenu,
    onDelete: closeMenu,
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
            element={element}
            actions={actions}
            extensionCommands={extensionCommands}
            view={{
              layer: 0,
              geometry: element.geometry,
              extensions,
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
        <ContainerMenu
          element={element}
          position={menu.value}
          closing={false}
          isMultiTarget={false}
          extensions={extensions}
          installedOnTargets={new Set(Object.keys(extensions) as (keyof typeof extensions)[])}
          extensionCommands={extensionCommands}
          actions={menuActions}
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
