import { useState } from "react";
import { DEFAULT_CHROME_RADII, type ChromeRadii } from "../platform/settings/preferenceContracts";
import type { CanvasGridStyle, DefaultElementColors } from "../types";
import { DEFAULT_ELEMENT_COLORS } from "../constants";
import { DEFAULT_GRID_OPACITY } from "../app/defaultData";

export interface SettingsGesture {
  begin(): void;
  commit(): void;
  cancel(): void;
}

/** Legacy settings owner retained until the database route replaces legacy startup. */
export function useLegacyCanvasSettings() {
  const [canvasGridStyle, setCanvasGridStyle] = useState<CanvasGridStyle>("dots");
  const [canvasGridOpacity, setCanvasGridOpacity] =
    useState<Record<CanvasGridStyle, number>>(DEFAULT_GRID_OPACITY);
  const [defaultElementColors, setDefaultElementColors] =
    useState<DefaultElementColors>(DEFAULT_ELEMENT_COLORS);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [shadowsUnderElements, setShadowsUnderElements] = useState(false);
  const [allowLockedElementDeletion, setAllowLockedElementDeletion] = useState(true);
  const [minimapEnabled, setMinimapEnabled] = useState(true);
  const [privacyModeEnabled, setPrivacyModeEnabled] = useState(false);
  const [toolbarButtonsVisible, setToolbarButtonsVisible] = useState(false);
  const [chromeAutoHideEnabled, setChromeAutoHideEnabled] = useState(false);
  const [chromeAutoHideDelayMs, setChromeAutoHideDelayMs] = useState(3000);
  const [chromeRadii, setChromeRadii] = useState<ChromeRadii>(DEFAULT_CHROME_RADII);
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string | undefined>(
    undefined,
  );
  return {
    canvasGridStyle,
    setCanvasGridStyle,
    canvasGridOpacity,
    setCanvasGridOpacity,
    defaultElementColors,
    setDefaultElementColors,
    recentColors,
    setRecentColors,
    shadowsUnderElements,
    setShadowsUnderElements,
    allowLockedElementDeletion,
    setAllowLockedElementDeletion,
    minimapEnabled,
    setMinimapEnabled,
    privacyModeEnabled,
    setPrivacyModeEnabled,
    toolbarButtonsVisible,
    setToolbarButtonsVisible,
    chromeAutoHideEnabled,
    setChromeAutoHideEnabled,
    chromeAutoHideDelayMs,
    setChromeAutoHideDelayMs,
    chromeRadii,
    setChromeRadii,
    dismissedUpdateVersion,
    setDismissedUpdateVersion,
    gridOpacityEdit: undefined as SettingsGesture | undefined,
    settingsError: null as string | null,
  };
}
