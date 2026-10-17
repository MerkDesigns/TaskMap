import {
  IconCalendar,
  IconCircleDashed,
  IconEye,
  IconEyeOff,
  IconMap,
  IconMapOff,
  IconMenu2,
  IconPuzzle,
  IconSettings,
  IconSquareRotated,
  IconTriangle,
  IconZzz,
  IconZzzOff,
  type Icon,
} from "@tabler/icons-react";
import type { ToolbarButtonId } from "../platform/settings/preferenceContracts";

/** How each toolbar button is named and drawn where its live state does not matter. */
export const TOOLBAR_BUTTONS: Readonly<
  Record<ToolbarButtonId, { readonly label: string; readonly Icon: Icon }>
> = Object.freeze({
  canvases: { label: "Canvases", Icon: IconMenu2 },
  extensions: { label: "Extensions", Icon: IconPuzzle },
  settings: { label: "Settings", Icon: IconSettings },
  privacy: { label: "Privacy mode", Icon: IconEye },
  calendar: { label: "Calendar", Icon: IconCalendar },
  sleep: { label: "Sleep mode", Icon: IconZzz },
  minimap: { label: "Minimap", Icon: IconMap },
  "placeholder-1": { label: "Placeholder 1", Icon: IconCircleDashed },
  "placeholder-2": { label: "Placeholder 2", Icon: IconSquareRotated },
  "placeholder-3": { label: "Placeholder 3", Icon: IconTriangle },
});

/** The toolbar toggles whose icon and colour follow a setting. */
export interface ToolbarToggleStates {
  readonly privacy: boolean;
  readonly calendar: boolean;
  readonly minimap: boolean;
  readonly sleep: boolean;
}

/** The icon a toolbar button shows for the current toggle states. */
export function toolbarButtonIcon(id: ToolbarButtonId, toggles: ToolbarToggleStates): Icon {
  switch (id) {
    case "privacy":
      return toggles.privacy ? IconEyeOff : IconEye;
    case "minimap":
      return toggles.minimap ? IconMap : IconMapOff;
    case "sleep":
      return toggles.sleep ? IconZzz : IconZzzOff;
    default:
      return TOOLBAR_BUTTONS[id].Icon;
  }
}

/** Whether a toolbar button shows as pressed for the current toggle states. */
export function toolbarButtonPressed(id: ToolbarButtonId, toggles: ToolbarToggleStates): boolean {
  return (
    (id === "privacy" || id === "calendar" || id === "minimap" || id === "sleep") && toggles[id]
  );
}
