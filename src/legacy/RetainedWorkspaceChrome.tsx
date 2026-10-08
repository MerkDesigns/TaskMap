import {
  lazy,
  memo,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from "react";
import type { CanvasInteractionController } from "../app/interactions/canvasInteractionTypes";
import { CanvasManager as CanvasManagerView } from "../components/CanvasManager";
import { ExtensionsPanel, QuickExtensionsMenu } from "../components/ExtensionsPanel";
import { FloatingToolbar } from "../components/FloatingToolbar";
import { Minimap } from "../components/Minimap";
import type { RetainedExtensionKey } from "../extensions/retainedExtensionDefinition";
import type { TaskCanvas } from "../types";
import {
  WorkspaceChromeLayer,
  WorkspaceSidePanel,
  WorkspaceSidePanelContentSwitcher,
} from "../ui/patterns/workspace";
import { useChromeAutoHide } from "../ui/patterns/workspace/chromeSleep";
import { setWorkspaceRadii, useWorkspaceRadii } from "../ui/patterns/workspace/workspaceRadii";
import {
  useWorkspaceIntroArrival,
  useWorkspaceIntroDeparture,
} from "../ui/patterns/workspace/workspaceIntro";
import type { useCanvasManagement } from "./useCanvasManagement";
import type { useLegacyCanvasSettings } from "./useLegacyCanvasSettings";
import type { useLeftPanel } from "./useLeftPanel";
import type { useMinimapPresence } from "./useMinimapPresence";

// Core surfaces are imported up front: a lazy first open waited on React's ~300 ms Suspense reveal
// throttle (the first Tab took ~306 ms versus ~35 ms afterwards), and the app loads from local disk.
const CanvasManager = memo(
  CanvasManagerView,
  (previous, next) =>
    previous.active === next.active &&
    previous.canvases === next.canvases &&
    previous.activeCanvasId === next.activeCanvasId &&
    previous.cycleHighlightCanvasId === next.cycleHighlightCanvasId &&
    previous.cardRadius === next.cardRadius &&
    previous.closing === next.closing &&
    previous.embedded === next.embedded &&
    previous.sharedPanel === next.sharedPanel &&
    previous.minimalView === next.minimalView &&
    previous.panelRadius === next.panelRadius &&
    previous.viewportWidth === next.viewportWidth &&
    previous.viewportHeight === next.viewportHeight,
);
const DevelopmentFpsCounter = import.meta.env.DEV
  ? lazy(() =>
      import("../components/FpsCounter").then(({ FpsCounter }) => ({ default: FpsCounter })),
    )
  : null;

// Canvas workspace geometry. The matching CSS tokens live on `.taskmap-workspace-root--canvas`.
const CANVAS_PREVIEW_GAP = 9;

type MinimapProps = ComponentProps<typeof Minimap>;

export interface RetainedWorkspaceChromeProps {
  readonly controller: CanvasInteractionController;
  readonly settings: ReturnType<typeof useLegacyCanvasSettings>;
  readonly leftPanel: ReturnType<typeof useLeftPanel>;
  /** The Canvas Browser's canvases, with the open one's live preview viewport. */
  readonly canvases: TaskCanvas[];
  readonly activeCanvasId: string;
  readonly canvasManagement: ReturnType<typeof useCanvasManagement>;
  readonly viewportSize: { readonly width: number; readonly height: number };
  readonly onDropExtension: (id: RetainedExtensionKey, clientX: number, clientY: number) => void;
  readonly minimap: Pick<
    MinimapProps,
    | "elements"
    | "textBlocks"
    | "textCards"
    | "images"
    | "mindmapConnections"
    | "canvasWidth"
    | "canvasHeight"
    | "zoom"
    | "viewportWorld"
    | "onResetZoom"
  > & { readonly presence: ReturnType<typeof useMinimapPresence> };
  /** The document store, whose history enables the undo and redo buttons. */
  readonly historyStore: {
    readonly subscribe: (listener: () => void) => () => void;
    readonly getState: () => {
      readonly documentWorkspace: {
        readonly history: {
          readonly past: readonly unknown[];
          readonly future: readonly unknown[];
        };
      };
    };
  };
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onOpenSettings: () => void;
  readonly quickExtensions: { readonly left: number; readonly top: number } | null;
  readonly onCloseQuickExtensions: () => void;
  readonly fpsCounterVisible: boolean;
}

function useHistoryAvailability(store: RetainedWorkspaceChromeProps["historyStore"]) {
  const canUndo = useSyncExternalStore(
    store.subscribe,
    () => store.getState().documentWorkspace.history.past.length > 0,
  );
  const canRedo = useSyncExternalStore(
    store.subscribe,
    () => store.getState().documentWorkspace.history.future.length > 0,
  );
  return { canUndo, canRedo };
}

/**
 * The side panel follows the chrome: sleep mode closes it with the toolbars and reopens it when
 * they wake, the unlock reveal ends with the Canvas Browser sliding in, and locking slides it out.
 */
function useSidePanelPresence(
  leftPanel: ReturnType<typeof useLeftPanel>,
  settings: ReturnType<typeof useLegacyCanvasSettings>,
) {
  const slept = useRef<"canvases" | "extensions" | null>(null);
  useChromeAutoHide(
    settings.chromeAutoHideEnabled,
    () => {
      const shown = leftPanel.current();
      slept.current = shown === "closed" ? null : shown;
      if (shown !== "closed") leftPanel.close(shown);
    },
    () => {
      const panel = slept.current;
      slept.current = null;
      if (panel) leftPanel.show(panel);
    },
    settings.chromeAutoHideDelayMs,
  );
  useWorkspaceIntroArrival(() => leftPanel.show("canvases"));
  useWorkspaceIntroDeparture(() => {
    const shown = leftPanel.current();
    if (shown !== "closed") leftPanel.close(shown);
  });
}

/**
 * The chrome over the canvas: the side panel switching between the Canvas Browser and the
 * Extensions panel, the minimap, the floating toolbar, the quick extensions menu and the
 * development FPS counter.
 */
export function RetainedWorkspaceChrome({
  controller,
  settings,
  leftPanel,
  canvases,
  activeCanvasId,
  canvasManagement,
  viewportSize,
  onDropExtension,
  minimap: { presence, ...minimapScene },
  historyStore,
  onUndo,
  onRedo,
  onOpenSettings,
  quickExtensions,
  onCloseQuickExtensions,
  fpsCounterVisible,
}: RetainedWorkspaceChromeProps) {
  const radii = useWorkspaceRadii();
  const history = useHistoryAvailability(historyStore);
  useSidePanelPresence(leftPanel, settings);
  // Saved radii drive the shared store; Settings previews slider drags there before saving.
  useLayoutEffect(() => {
    setWorkspaceRadii(settings.chromeRadii);
  }, [settings.chromeRadii]);
  const panelRef = useRef<HTMLDivElement>(null);
  const [minimalView, setMinimalView] = useState(false);
  const { canvasManagerOpen, canvasManagerClosing, extensionsOpen, extensionsClosing } = leftPanel;
  const panelOpen = canvasManagerOpen || extensionsOpen;
  const panelClosing = canvasManagerClosing || extensionsClosing;
  const activeIndex = extensionsOpen ? 1 : 0;

  return (
    <>
      <WorkspaceChromeLayer>
        {panelOpen && (
          <Suspense fallback={null}>
            <WorkspaceSidePanel
              ref={panelRef}
              backdropRevision={activeCanvasId}
              closing={panelClosing}
              label={activeIndex === 0 ? "Canvases panel" : "Extensions panel"}
              radius={radii.sidePanel}
              className="taskmap-workspace-side-panel--switching"
            >
              <WorkspaceSidePanelContentSwitcher
                activeIndex={activeIndex}
                views={[
                  <CanvasManager
                    key="canvases"
                    active={activeIndex === 0}
                    canvases={canvases}
                    activeCanvasId={activeCanvasId}
                    cycleHighlightCanvasId={canvasManagement.cycleHighlightId}
                    closing={panelClosing}
                    cardRadius={radii.canvasCard}
                    previewGap={CANVAS_PREVIEW_GAP}
                    minimalView={minimalView}
                    sharedPanel
                    viewportWidth={viewportSize.width}
                    viewportHeight={viewportSize.height}
                    controller={controller}
                    onMinimalViewChange={setMinimalView}
                    onCreateCanvas={canvasManagement.create}
                    onSelectCanvas={canvasManagement.select}
                    onUpdateCanvas={canvasManagement.update}
                    onDeleteCanvas={canvasManagement.remove}
                    onReorderCanvases={canvasManagement.reorder}
                  />,
                  <ExtensionsPanel
                    key="extensions"
                    active={activeIndex === 1}
                    closing={panelClosing}
                    panelRef={panelRef}
                    cardRadius={radii.extensionCard}
                    sharedPanel
                    onDropExtension={onDropExtension}
                  />,
                ]}
              />
            </WorkspaceSidePanel>
          </Suspense>
        )}
        {settings.minimapEnabled && presence.mounted && (
          <Minimap
            controller={controller}
            {...minimapScene}
            visible={presence.visible}
            onHoldChange={presence.hold}
          />
        )}
        <FloatingToolbar
          canRedo={history.canRedo}
          canUndo={history.canUndo}
          canvasesOpen={canvasManagerOpen && !canvasManagerClosing}
          extensionsOpen={extensionsOpen && !extensionsClosing}
          minimapEnabled={settings.minimapEnabled}
          privacyModeEnabled={settings.privacyModeEnabled}
          sleepModeEnabled={settings.chromeAutoHideEnabled}
          onSleepModeEnabledChange={settings.setChromeAutoHideEnabled}
          toolbarRadius={radii.chrome}
          onMinimapEnabledChange={settings.setMinimapEnabled}
          onPrivacyModeEnabledChange={settings.setPrivacyModeEnabled}
          onRedo={onRedo}
          onToggleExtensions={() => leftPanel.toggle("extensions")}
          onToggleCanvases={() => leftPanel.toggle("canvases")}
          onUndo={onUndo}
          onOpenSettings={onOpenSettings}
        />
      </WorkspaceChromeLayer>
      {import.meta.env.DEV && fpsCounterVisible && DevelopmentFpsCounter && (
        <Suspense fallback={null}>
          <DevelopmentFpsCounter />
        </Suspense>
      )}
      {quickExtensions && (
        <Suspense fallback={null}>
          <QuickExtensionsMenu
            left={quickExtensions.left}
            top={quickExtensions.top}
            majorRadius={radii.quickExtensions}
            minorRadius={radii.quickExtensionsCard}
            onClose={onCloseQuickExtensions}
            onDropExtension={onDropExtension}
          />
        </Suspense>
      )}
    </>
  );
}
