import {
  IconEye,
  IconEyeOff,
  IconKeyboard,
  IconMoon,
  IconPalette,
  IconRefresh,
  IconRestore,
  IconSettings,
} from "@tabler/icons-react";
import { SettingsInterfaceIsland } from "./SettingsInterfaceIsland";
import {
  DEFAULT_CANVAS_BACKGROUND_COLOR,
  type ChromeRadii,
} from "../platform/settings/preferenceContracts";
import { Fragment, useEffect, useRef, useState } from "react";
import { commandErrorMessage } from "../app/commandError";
import { AppUpdateInfo, DefaultElementColors } from "../types";
import { Button, IconButton, Keycap, LiquidTabs, ScrollArea, Slider } from "../ui/primitives";
import {
  isNestedModalPresenceBlocking,
  ModalDialogHeader,
  ModalPresence,
  useDialogFocus,
} from "../ui/patterns/overlays";
import {
  SettingsCommittedSlider,
  SettingsIsland,
  SettingsIslandList,
  SettingsShell,
  SettingsToggleRow,
} from "../ui/patterns/settings";
import { ColorPickerMenu } from "./ColorPickerMenu";
import {
  DatabaseSettingsActions,
  type DatabaseSettingsActionsProps,
} from "./DatabaseSettingsActions";
import { UpdateAvailableModal } from "./ProductionDialogs";

export { ClearCanvasModal, UpdateAvailableModal } from "./ProductionDialogs";

type SettingsModalProps = {
  databaseActions: DatabaseSettingsActionsProps;
  gridOpacityEdit?: { begin(): void; commit(): void; cancel(): void };
  canvasBackgroundColor: string;
  onCanvasBackgroundColorChange: (color: string) => void;
  canvasGridOpacity: number;
  onCanvasGridOpacityChange: (opacity: number) => void;
  defaultElementColors: DefaultElementColors;
  onDefaultElementColorChange: (elementType: keyof DefaultElementColors, color: string) => void;
  recentColors: string[];
  onRememberRecentColor: (color?: string) => void;
  shadowsUnderElements: boolean;
  onShadowsUnderElementsChange: (enabled: boolean) => void;
  allowLockedElementDeletion: boolean;
  onAllowLockedElementDeletionChange: (enabled: boolean) => void;
  availableUpdate: AppUpdateInfo | null;
  appVersion: string;
  fpsCounterVisible: boolean;
  onFpsCounterVisibleChange: (visible: boolean) => void;
  privacyModeEnabled: boolean;
  onPrivacyModeEnabledChange: (enabled: boolean) => void;
  chromeRadii: ChromeRadii;
  onChromeRadiusChange: (key: keyof ChromeRadii, radius: number) => void;
  sleepDelayMs: number;
  onSleepDelayChange: (delayMs: number) => void;
  temporaryPanelsVisible: boolean;
  onTemporaryPanelsVisibleChange: (visible: boolean) => void;
  onCheckForUpdate: () => Promise<AppUpdateInfo | null>;
  onInstallUpdate: () => Promise<void>;
  onClose: () => void;
};

const DEFAULT_COLOR_OPTIONS: Array<{
  label: string;
  value: keyof DefaultElementColors;
}> = [
  { label: "Containers", value: "container" },
  { label: "Text cards", value: "textCard" },
  { label: "Text blocks", value: "textBlock" },
  { label: "Images", value: "image" },
  { label: "Mindmaps", value: "mindmap" },
];

const SHORTCUTS = [
  { label: "Open quick extensions menu", keys: ["Shift", "E"] },
  { label: "Open or close Canvases", keys: ["Tab"] },
  { label: "Switch Canvases / Extensions", keys: ["Shift", "Tab"] },
  { label: "Cycle canvases", keys: ["Ctrl", "Tab"] },
  { label: "Remove selected elements", keys: ["Delete"] },
  { label: "Undo", keys: ["Ctrl/Cmd", "Z"] },
  { label: "Redo", keys: ["Ctrl/Cmd", "Y"] },
  { label: "Pan canvas", keys: ["Middle drag"] },
  { label: "Zoom around pointer", keys: ["Mouse wheel"] },
  { label: "Enable alignment snapping", keys: ["Shift", "Drag"] },
  { label: "Open context menu", keys: ["Right-click"] },
  { label: "Box select", keys: ["Left-drag empty canvas"] },
  { label: "Connect mindmaps", keys: ["Hold C", "Drag point"] },
] as const;

const SETTINGS_TABS = import.meta.env.DEV
  ? (["visual", "data", "misc", "shortcuts", "dev"] as const)
  : (["visual", "data", "misc", "shortcuts"] as const);

// The data tab holds the open database's session actions.
const SETTINGS_TAB_ITEMS = SETTINGS_TABS.map((tab) => ({
  value: tab,
  label: tab === "data" ? "database" : tab,
}));

export function SettingsModal({
  databaseActions,
  gridOpacityEdit,
  canvasBackgroundColor,
  onCanvasBackgroundColorChange,
  canvasGridOpacity,
  onCanvasGridOpacityChange,
  defaultElementColors,
  onDefaultElementColorChange,
  recentColors,
  onRememberRecentColor,
  shadowsUnderElements,
  onShadowsUnderElementsChange,
  allowLockedElementDeletion,
  onAllowLockedElementDeletionChange,
  availableUpdate,
  appVersion,
  fpsCounterVisible,
  onFpsCounterVisibleChange,
  privacyModeEnabled,
  onPrivacyModeEnabledChange,
  chromeRadii,
  onChromeRadiusChange,
  sleepDelayMs,
  onSleepDelayChange,
  temporaryPanelsVisible,
  onTemporaryPanelsVisibleChange,
  onCheckForUpdate,
  onInstallUpdate,
  onClose,
}: SettingsModalProps) {
  const opacityCancelled = useRef(false);
  const [, setUpdateStatus] = useState("");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"visual" | "data" | "misc" | "shortcuts" | "dev">(
    "visual",
  );
  const [colorPicker, setColorPicker] = useState<{
    target: keyof DefaultElementColors | "canvasBackground";
    left: number;
    top: number;
  } | null>(null);
  const dialogRef = useDialogFocus();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isNestedModalPresenceBlocking()) return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (activeTab !== "visual") {
      setColorPicker(null);
    }
  }, [activeTab]);

  const handleCheckForUpdate = async () => {
    setUpdateStatus("");
    setUpdateBusy(true);

    try {
      const update = await onCheckForUpdate();
      if (update) {
        setUpdateStatus("");
        setUpdateModalOpen(true);
      } else {
        setUpdateStatus("");
      }
    } catch (error) {
      setUpdateStatus(commandErrorMessage(error));
    } finally {
      setUpdateBusy(false);
    }
  };

  return (
    <Fragment>
      <SettingsShell
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        data-settings-primary-shell
      >
        <ModalDialogHeader
          titleId="settings-title"
          title="Settings"
          icon={<IconSettings size={19} stroke={2} className="taskmap-modal-dialog__icon" />}
          onClose={onClose}
          closeLabel="Close settings"
        />
        <div className="taskmap-settings-body">
          <LiquidTabs
            className="taskmap-settings-navigation"
            label="Settings categories"
            items={SETTINGS_TAB_ITEMS}
            value={activeTab}
            onValueChange={(tab) => {
              gridOpacityEdit?.cancel();
              setActiveTab(tab);
            }}
          />
          <SettingsIslandList key={activeTab}>
            <div
              className={[
                "taskmap-settings-content-stack",
                activeTab === "shortcuts" && "taskmap-settings-content-stack--fit",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {activeTab === "visual" && (
                <>
                  <SettingsIsland>
                    <div className="taskmap-settings-section-heading">Canvas</div>
                    <div className="taskmap-settings-grid-controls">
                      <div className="taskmap-settings-background-control">
                        <Button
                          variant="ghost"
                          className="taskmap-settings-color-trigger"
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setColorPicker({
                              target: "canvasBackground",
                              left: rect.right + 8,
                              top: rect.top,
                            });
                          }}
                          title="Choose canvas background color"
                        >
                          <span
                            className="taskmap-settings-color-swatch"
                            style={{ backgroundColor: canvasBackgroundColor }}
                          />
                          <span className="taskmap-settings-color-copy">
                            <span className="taskmap-settings-color-label">Background</span>
                            <span className="taskmap-settings-color-value">
                              {canvasBackgroundColor}
                            </span>
                          </span>
                        </Button>
                        <IconButton
                          variant="ghost"
                          size="compact"
                          className="taskmap-settings-background-reset"
                          aria-label="Reset canvas background color"
                          title="Reset to default"
                          disabled={
                            canvasBackgroundColor.toLowerCase() ===
                            DEFAULT_CANVAS_BACKGROUND_COLOR.toLowerCase()
                          }
                          onClick={() =>
                            onCanvasBackgroundColorChange(DEFAULT_CANVAS_BACKGROUND_COLOR)
                          }
                          icon={<IconRestore size={14} stroke={2} />}
                        />
                      </div>
                      <div>
                        <div className="taskmap-settings-slider-heading">
                          <span>Dot grid opacity</span>
                          <span className="taskmap-settings-slider-value">
                            {Math.round(canvasGridOpacity)}%
                          </span>
                        </div>
                        <Slider
                          onPointerDown={(event) => {
                            opacityCancelled.current = false;
                            if (gridOpacityEdit) {
                              event.currentTarget.setPointerCapture(event.pointerId);
                              gridOpacityEdit.begin();
                            }
                          }}
                          onPointerUp={() => {
                            gridOpacityEdit?.commit();
                            opacityCancelled.current = false;
                          }}
                          onPointerCancel={() => {
                            gridOpacityEdit?.cancel();
                            opacityCancelled.current = true;
                          }}
                          onLostPointerCapture={() => gridOpacityEdit?.cancel()}
                          onBlur={() => gridOpacityEdit?.commit()}
                          onKeyDown={(event) => {
                            opacityCancelled.current = false;
                            if (event.key === "Escape" && gridOpacityEdit) {
                              opacityCancelled.current = true;
                              event.stopPropagation();
                              gridOpacityEdit.cancel();
                            }
                          }}
                          className="taskmap-settings-slider"
                          min={0}
                          max={100}
                          value={canvasGridOpacity}
                          spellCheck={false}
                          onChange={(event) => {
                            if (!opacityCancelled.current)
                              onCanvasGridOpacityChange(Number(event.currentTarget.value));
                          }}
                          title="Dot grid opacity"
                        />
                      </div>
                    </div>
                  </SettingsIsland>
                  <SettingsInterfaceIsland
                    radii={chromeRadii}
                    onRadiusChange={onChromeRadiusChange}
                  />
                  <SettingsIsland>
                    <div className="taskmap-settings-section-heading">
                      <IconPalette size={16} stroke={2} />
                      <span>Default element colors</span>
                    </div>
                    <div className="taskmap-settings-section-description">
                      Applied to newly created elements.
                    </div>
                    <div className="taskmap-settings-color-grid">
                      {DEFAULT_COLOR_OPTIONS.map(({ label, value }) => (
                        <Button
                          key={value}
                          variant="ghost"
                          className="taskmap-settings-color-trigger"
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setColorPicker({
                              target: value,
                              left: rect.right + 8,
                              top: rect.top,
                            });
                          }}
                          title={`Choose default ${label.toLowerCase()} color`}
                        >
                          <span
                            className="taskmap-settings-color-swatch"
                            style={{ backgroundColor: defaultElementColors[value] }}
                          />
                          <span className="taskmap-settings-color-copy">
                            <span className="taskmap-settings-color-label">{label}</span>
                            <span className="taskmap-settings-color-value">
                              {defaultElementColors[value]}
                            </span>
                          </span>
                        </Button>
                      ))}
                    </div>
                  </SettingsIsland>
                  <SettingsToggleRow
                    label="Canvas-only shadows"
                    description="Shadows fall on the canvas, never onto overlapping elements."
                    checked={shadowsUnderElements}
                    onCheckedChange={onShadowsUnderElementsChange}
                  />
                </>
              )}
              {activeTab === "data" && <DatabaseSettingsActions {...databaseActions} />}
              {activeTab === "misc" && (
                <div className="taskmap-settings-misc">
                  <SettingsToggleRow
                    label="Allow removing locked elements"
                    description="Lock canvas interactions without preventing removal."
                    checked={allowLockedElementDeletion}
                    onCheckedChange={onAllowLockedElementDeletionChange}
                  />
                  <SettingsToggleRow
                    label="Privacy mode"
                    description="Hide TaskMap from screenshots and screen capture."
                    leading={
                      privacyModeEnabled ? (
                        <IconEyeOff size={18} stroke={2} />
                      ) : (
                        <IconEye size={18} stroke={2} />
                      )
                    }
                    checked={privacyModeEnabled}
                    onCheckedChange={onPrivacyModeEnabledChange}
                  />
                  <SettingsIsland>
                    <div className="taskmap-settings-section-heading">
                      <IconMoon size={16} stroke={2} />
                      <span>Sleep mode</span>
                    </div>
                    <div className="taskmap-settings-section-description">
                      Hides the toolbars and side panel after this long without input.
                    </div>
                    <SettingsCommittedSlider
                      label="Delay"
                      value={sleepDelayMs / 1000}
                      min={1}
                      max={15}
                      step={0.5}
                      format={(value) => `${value}s`}
                      onCommit={(value) => onSleepDelayChange(Math.round(value * 1000))}
                    />
                  </SettingsIsland>
                  <Button
                    className="taskmap-settings-update-button"
                    leadingIcon={<IconRefresh size={17} stroke={2} />}
                    onClick={handleCheckForUpdate}
                    disabled={updateBusy}
                  >
                    {updateBusy ? "Checking..." : "Check for updates"}
                  </Button>
                </div>
              )}
              {activeTab === "shortcuts" && (
                <div className="taskmap-settings-shortcuts-tab">
                  <div className="taskmap-settings-section-heading">
                    <IconKeyboard size={16} stroke={2} />
                    <span>Shortcuts</span>
                  </div>
                  <SettingsIsland className="taskmap-settings-shortcuts">
                    <ScrollArea scrollbar="hidden" className="taskmap-settings-shortcuts__rows">
                      {SHORTCUTS.map((shortcut) => (
                        <div key={shortcut.label} className="taskmap-settings-shortcut-row">
                          <span className="taskmap-settings-shortcut-label">{shortcut.label}</span>
                          <span className="taskmap-settings-key-group">
                            {shortcut.keys.map((key) => (
                              <Keycap key={key}>{key}</Keycap>
                            ))}
                          </span>
                        </div>
                      ))}
                    </ScrollArea>
                  </SettingsIsland>
                </div>
              )}
              {import.meta.env.DEV && activeTab === "dev" && (
                <div className="taskmap-settings-content-stack">
                  <SettingsToggleRow
                    label="FPS counter"
                    description="Show frame timing overlay."
                    checked={fpsCounterVisible}
                    onCheckedChange={onFpsCounterVisibleChange}
                  />
                  <SettingsToggleRow
                    label="Visual tuner"
                    description="Show temporary glass and workspace geometry controls."
                    checked={temporaryPanelsVisible}
                    onCheckedChange={onTemporaryPanelsVisibleChange}
                  />
                </div>
              )}
            </div>
          </SettingsIslandList>
        </div>
        <div className="taskmap-settings-footer">MADE BY MERK - v{appVersion}</div>
      </SettingsShell>
      {colorPicker && (
        <ColorPickerMenu
          aboveModals
          key={colorPicker.target}
          color={
            colorPicker.target === "canvasBackground"
              ? canvasBackgroundColor
              : defaultElementColors[colorPicker.target]
          }
          left={colorPicker.left}
          top={colorPicker.top}
          recentColors={recentColors}
          onChange={(color) =>
            colorPicker.target === "canvasBackground"
              ? onCanvasBackgroundColorChange(color)
              : onDefaultElementColorChange(colorPicker.target, color)
          }
          onClose={(recentColor) => {
            onRememberRecentColor(recentColor);
            setColorPicker(null);
          }}
        />
      )}
      <ModalPresence open={updateModalOpen && Boolean(availableUpdate)} placement="nested">
        {availableUpdate ? (
          <UpdateAvailableModal
            update={availableUpdate}
            onInstall={onInstallUpdate}
            onDismiss={() => setUpdateModalOpen(false)}
          />
        ) : null}
      </ModalPresence>
    </Fragment>
  );
}
