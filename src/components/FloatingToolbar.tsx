import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconEye,
  IconEyeOff,
  IconMap,
  IconMapOff,
  IconMenu2,
  IconPuzzle,
  IconSettings,
  IconZzz,
  IconZzzOff,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import {
  FloatingCanvasToolbar,
  ToolbarGroup,
} from "../ui/patterns/workspace/FloatingCanvasToolbar";
import { IconButton, ToggleButton } from "../ui/primitives/Button";

export type FloatingToolbarProps = {
  canRedo: boolean;
  canUndo: boolean;
  canvasesOpen: boolean;
  extensionsOpen: boolean;
  minimapEnabled: boolean;
  privacyModeEnabled: boolean;
  sleepModeEnabled: boolean;
  toolbarRadius?: number;
  onMinimapEnabledChange: (enabled: boolean) => void;
  onPrivacyModeEnabledChange: (enabled: boolean) => void;
  onSleepModeEnabledChange: (enabled: boolean) => void;
  onRedo: () => void;
  onToggleExtensions: () => void;
  onToggleCanvases: () => void;
  onUndo: () => void;
  onOpenSettings: () => void;
};

export function FloatingToolbar({
  canRedo,
  canUndo,
  canvasesOpen,
  extensionsOpen,
  minimapEnabled,
  privacyModeEnabled,
  sleepModeEnabled,
  toolbarRadius,
  onMinimapEnabledChange,
  onPrivacyModeEnabledChange,
  onSleepModeEnabledChange,
  onRedo,
  onToggleExtensions,
  onToggleCanvases,
  onUndo,
  onOpenSettings,
}: FloatingToolbarProps) {
  const privacyTitle = privacyModeEnabled ? "Disable privacy mode" : "Enable privacy mode";
  const minimapTitle = minimapEnabled ? "Disable minimap" : "Enable minimap";
  const sleepTitle = sleepModeEnabled ? "Disable sleep mode" : "Enable sleep mode";

  return (
    <FloatingCanvasToolbar aria-label="Canvas toolbar">
      <ToolbarGroup label="Workspace controls" radius={toolbarRadius}>
        <ToolbarToggleButton
          pressed={canvasesOpen}
          onClick={onToggleCanvases}
          title="Canvases"
          icon={<IconMenu2 size={18} stroke={2} />}
        />
        <ToolbarToggleButton
          pressed={extensionsOpen}
          onClick={onToggleExtensions}
          title="Extensions"
          icon={<IconPuzzle size={18} stroke={2} />}
        />
        <IconButton
          variant="ghost"
          size="compact"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
          icon={<IconSettings size={18} stroke={2} />}
        />
        <ToolbarToggleButton
          pressed={privacyModeEnabled}
          onClick={() => onPrivacyModeEnabledChange(!privacyModeEnabled)}
          title={privacyTitle}
          icon={
            privacyModeEnabled ? (
              <IconEyeOff size={18} stroke={2} />
            ) : (
              <IconEye size={18} stroke={2} />
            )
          }
        />
        <ToolbarToggleButton
          pressed={minimapEnabled}
          onClick={() => onMinimapEnabledChange(!minimapEnabled)}
          title={minimapTitle}
          icon={
            minimapEnabled ? <IconMap size={18} stroke={2} /> : <IconMapOff size={18} stroke={2} />
          }
        />
        {/* Sleep mode: the chrome fades out when idle and returns on any input. */}
        <ToolbarToggleButton
          pressed={sleepModeEnabled}
          onClick={() => onSleepModeEnabledChange(!sleepModeEnabled)}
          title={sleepTitle}
          icon={
            sleepModeEnabled ? (
              <IconZzz size={18} stroke={2} />
            ) : (
              <IconZzzOff size={18} stroke={2} />
            )
          }
        />
      </ToolbarGroup>
      <ToolbarGroup label="History controls" radius={toolbarRadius}>
        <IconButton
          variant="ghost"
          size="compact"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          aria-label="Undo"
          icon={<IconArrowBackUp size={18} stroke={2} />}
        />
        <IconButton
          variant="ghost"
          size="compact"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
          aria-label="Redo"
          icon={<IconArrowForwardUp size={18} stroke={2} />}
        />
      </ToolbarGroup>
    </FloatingCanvasToolbar>
  );
}

interface ToolbarToggleButtonProps {
  readonly icon: ReactNode;
  readonly onClick: () => void;
  readonly pressed: boolean;
  readonly title: string;
}

function ToolbarToggleButton({ icon, onClick, pressed, title }: ToolbarToggleButtonProps) {
  return (
    <ToggleButton
      variant="ghost"
      size="compact"
      className="taskmap-floating-canvas-toolbar__icon-toggle"
      pressed={pressed}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <span aria-hidden="true">{icon}</span>
    </ToggleButton>
  );
}
