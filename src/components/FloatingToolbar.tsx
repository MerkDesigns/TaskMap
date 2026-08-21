import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconEyeOff,
  IconMap,
  IconMapOff,
  IconMenu2,
  IconPuzzle,
  IconSettings,
} from "@tabler/icons-react";
import { useLayoutEffect, type ReactNode, type TransitionEvent } from "react";
import { useMaterialSurfaceGeometryInvalidation } from "../ui/materials/MaterialSurfaceRegistration";
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
  toolbarRadius?: number;
  toolbarButtonsVisible: boolean;
  onMinimapEnabledChange: (enabled: boolean) => void;
  onPrivacyModeEnabledChange: (enabled: boolean) => void;
  onRedo: () => void;
  onToolbarButtonsVisibleChange: (visible: boolean) => void;
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
  toolbarRadius,
  toolbarButtonsVisible,
  onMinimapEnabledChange,
  onPrivacyModeEnabledChange,
  onRedo,
  onToolbarButtonsVisibleChange,
  onToggleExtensions,
  onToggleCanvases,
  onUndo,
  onOpenSettings,
}: FloatingToolbarProps) {
  const invalidateGeometry = useMaterialSurfaceGeometryInvalidation();
  // The material registry's shared ResizeObserver follows intermediate width frames. These
  // notifications cover the transition boundaries without introducing a toolbar-owned rAF.
  useLayoutEffect(invalidateGeometry, [invalidateGeometry, toolbarButtonsVisible]);

  const privacyTitle = privacyModeEnabled ? "Disable privacy mode" : "Enable privacy mode";
  const minimapTitle = minimapEnabled ? "Disable minimap" : "Enable minimap";
  const visibilityTitle = toolbarButtonsVisible ? "Hide toolbar buttons" : "Show toolbar buttons";
  const handleOptionalControlsTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "max-width") return;
    invalidateGeometry();
  };

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
        <IconButton
          variant="ghost"
          size="compact"
          onClick={() => onToolbarButtonsVisibleChange(!toolbarButtonsVisible)}
          title={visibilityTitle}
          aria-label={visibilityTitle}
          aria-expanded={toolbarButtonsVisible}
          icon={
            toolbarButtonsVisible ? (
              <IconChevronLeft size={18} stroke={2} />
            ) : (
              <IconChevronRight size={18} stroke={2} />
            )
          }
        />
        <div
          className="taskmap-floating-canvas-toolbar__optional-controls"
          aria-hidden={!toolbarButtonsVisible}
          onTransitionEnd={handleOptionalControlsTransitionEnd}
        >
          <ToolbarToggleButton
            pressed={privacyModeEnabled}
            onClick={() => onPrivacyModeEnabledChange(!privacyModeEnabled)}
            title={privacyTitle}
            tabIndex={toolbarButtonsVisible ? 0 : -1}
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
            tabIndex={toolbarButtonsVisible ? 0 : -1}
            icon={
              minimapEnabled ? (
                <IconMap size={18} stroke={2} />
              ) : (
                <IconMapOff size={18} stroke={2} />
              )
            }
          />
        </div>
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
  readonly tabIndex?: number;
  readonly title: string;
}

function ToolbarToggleButton({
  icon,
  onClick,
  pressed,
  tabIndex,
  title,
}: ToolbarToggleButtonProps) {
  return (
    <ToggleButton
      variant="ghost"
      size="compact"
      className="taskmap-floating-canvas-toolbar__icon-toggle"
      pressed={pressed}
      onClick={onClick}
      title={title}
      aria-label={title}
      tabIndex={tabIndex}
    >
      <span aria-hidden="true">{icon}</span>
    </ToggleButton>
  );
}
