import { IconLayoutDashboard } from "@tabler/icons-react";
import type { ChromeRadii } from "../platform/settings/preferenceContracts";
import { SettingsCommittedSlider, SettingsIsland } from "../ui/patterns/settings/SettingsPatterns";
import { setWorkspaceRadii } from "../ui/patterns/workspace/workspaceRadii";

const RADIUS_SLIDERS: readonly (readonly [keyof ChromeRadii, string])[] = [
  ["sidePanel", "Side panel"],
  ["canvasCard", "Canvas cards"],
  ["extensionCard", "Extension cards"],
  ["quickExtensions", "Quick extensions"],
  ["quickExtensionsCard", "Quick extension cards"],
  ["chrome", "Top bar"],
  ["settings", "Settings window"],
  ["settingsIsland", "Settings islands"],
];

export interface SettingsInterfaceIslandProps {
  readonly radii: ChromeRadii;
  readonly onRadiusChange: (key: keyof ChromeRadii, radius: number) => void;
}

/** Corner radii of the workspace chrome. */
export function SettingsInterfaceIsland({ radii, onRadiusChange }: SettingsInterfaceIslandProps) {
  return (
    <SettingsIsland>
      <div className="taskmap-settings-section-heading">
        <IconLayoutDashboard size={16} stroke={2} />
        <span>Interface roundness</span>
      </div>
      <div className="taskmap-settings-interface-grid">
        {RADIUS_SLIDERS.map(([key, label]) => (
          <SettingsCommittedSlider
            key={key}
            label={label}
            value={radii[key]}
            min={0}
            max={32}
            step={1}
            format={(value) => `${value}px`}
            onPreview={(value) => setWorkspaceRadii({ [key]: value })}
            onCommit={(value) => onRadiusChange(key, value)}
          />
        ))}
      </div>
    </SettingsIsland>
  );
}
