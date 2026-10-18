import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCalendar,
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
import type { ToolbarButtonId } from "../platform/settings/preferenceContracts";
import { CalendarIsland } from "../features/calendar/CalendarIsland";
import { TOOLBAR_BUTTONS } from "./toolbarButtons";
import {
  FloatingCanvasToolbar,
  ToolbarGroup,
} from "../ui/patterns/workspace/FloatingCanvasToolbar";
import { IconButton, ToggleButton } from "../ui/primitives/Button";

export type FloatingToolbarProps = {
  /** The workspace buttons, in order (Settings → Misc → Toolbar). */
  buttons: readonly ToolbarButtonId[];
  calendarOpen: boolean;
  /** The expanded calendar ignores clicks elsewhere (Settings > Misc). */
  calendarStaysOpen?: boolean;
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
  onToggleCalendar: () => void;
  onUndo: () => void;
  onOpenSettings: () => void;
};

export function FloatingToolbar({
  buttons,
  calendarOpen,
  calendarStaysOpen,
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
  onToggleCalendar,
  onUndo,
  onOpenSettings,
}: FloatingToolbarProps) {
  const privacyTitle = privacyModeEnabled ? "Disable privacy mode" : "Enable privacy mode";
  const minimapTitle = minimapEnabled ? "Disable minimap" : "Enable minimap";
  const sleepTitle = sleepModeEnabled ? "Disable sleep mode" : "Enable sleep mode";

  const workspaceButtons: Record<ToolbarButtonId, ReactNode> = {
    canvases: (
      <ToolbarToggleButton
        key="canvases"
        pressed={canvasesOpen}
        onClick={onToggleCanvases}
        title="Canvases"
        icon={<IconMenu2 size={18} stroke={2} />}
      />
    ),
    extensions: (
      <ToolbarToggleButton
        key="extensions"
        pressed={extensionsOpen}
        onClick={onToggleExtensions}
        title="Extensions"
        icon={<IconPuzzle size={18} stroke={2} />}
      />
    ),
    settings: (
      <IconButton
        key="settings"
        variant="ghost"
        size="compact"
        onClick={onOpenSettings}
        title="Settings"
        aria-label="Settings"
        icon={<IconSettings size={18} stroke={2} />}
      />
    ),
    privacy: (
      <ToolbarToggleButton
        key="privacy"
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
    ),
    minimap: (
      <ToolbarToggleButton
        key="minimap"
        pressed={minimapEnabled}
        onClick={() => onMinimapEnabledChange(!minimapEnabled)}
        title={minimapTitle}
        icon={
          minimapEnabled ? <IconMap size={18} stroke={2} /> : <IconMapOff size={18} stroke={2} />
        }
      />
    ),
    calendar: (
      <ToolbarToggleButton
        key="calendar"
        pressed={calendarOpen}
        onClick={onToggleCalendar}
        title="Calendar"
        icon={<IconCalendar size={18} stroke={2} />}
      />
    ),
    // Sleep mode: the chrome fades out when idle and returns on any input.
    sleep: (
      <ToolbarToggleButton
        key="sleep"
        pressed={sleepModeEnabled}
        onClick={() => onSleepModeEnabledChange(!sleepModeEnabled)}
        title={sleepTitle}
        icon={
          sleepModeEnabled ? <IconZzz size={18} stroke={2} /> : <IconZzzOff size={18} stroke={2} />
        }
      />
    ),
    "placeholder-1": placeholderButton("placeholder-1"),
    "placeholder-2": placeholderButton("placeholder-2"),
    "placeholder-3": placeholderButton("placeholder-3"),
  };

  return (
    <FloatingCanvasToolbar aria-label="Canvas toolbar">
      <ToolbarGroup label="Workspace controls" radius={toolbarRadius}>
        {buttons.map((id) => workspaceButtons[id])}
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
      <CalendarIsland open={calendarOpen} radius={toolbarRadius} staysOpen={calendarStaysOpen} />
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

/** Placeholders reserve toolbar slots for buttons still to come; they do nothing yet. */
function placeholderButton(id: "placeholder-1" | "placeholder-2" | "placeholder-3") {
  const { label, Icon } = TOOLBAR_BUTTONS[id];
  return (
    <IconButton
      key={id}
      variant="ghost"
      size="compact"
      title={label}
      aria-label={label}
      icon={<Icon size={18} stroke={2} />}
    />
  );
}
