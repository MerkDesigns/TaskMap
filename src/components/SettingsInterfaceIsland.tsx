import { IconLayoutDashboard } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { ChromeRadii } from "../platform/settings/preferenceContracts";
import { SettingsIsland } from "../ui/patterns/settings/SettingsPatterns";
import { setWorkspaceRadii } from "../ui/patterns/workspace/workspaceRadii";
import { Slider } from "../ui/primitives";

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
  readonly sleepDelayMs: number;
  readonly onSleepDelayChange: (delayMs: number) => void;
}

/** Corner radii of the workspace chrome and the sleep-mode idle delay. */
export function SettingsInterfaceIsland({
  radii,
  onRadiusChange,
  sleepDelayMs,
  onSleepDelayChange,
}: SettingsInterfaceIslandProps) {
  return (
    <SettingsIsland>
      <div className="taskmap-settings-section-heading">
        <IconLayoutDashboard size={16} stroke={2} />
        <span>Interface</span>
      </div>
      <div className="taskmap-settings-interface-grid">
        {RADIUS_SLIDERS.map(([key, label]) => (
          <CommittedSlider
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
        <CommittedSlider
          label="Sleep mode delay"
          className="taskmap-settings-interface-grid__wide"
          value={sleepDelayMs / 1000}
          min={1}
          max={15}
          step={0.5}
          format={(value) => `${value}s`}
          onCommit={(value) => onSleepDelayChange(Math.round(value * 1000))}
        />
      </div>
    </SettingsIsland>
  );
}

interface CommittedSliderProps {
  readonly label: string;
  readonly className?: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
  readonly onPreview?: (value: number) => void;
  readonly onCommit: (value: number) => void;
}

/**
 * Shows drags immediately (optionally previewing them live) and saves once on release, so a drag
 * never queues a save per pixel or lags behind a saved snapshot.
 */
function CommittedSlider({
  label,
  className,
  value,
  min,
  max,
  step,
  format,
  onPreview,
  onCommit,
}: CommittedSliderProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <label className={["taskmap-settings-interface-slider", className].filter(Boolean).join(" ")}>
      <span className="taskmap-settings-slider-heading">
        <span>{label}</span>
        <span className="taskmap-settings-slider-value">{format(draft)}</span>
      </span>
      <Slider
        className="taskmap-settings-slider"
        min={min}
        max={max}
        step={step}
        value={draft}
        aria-label={label}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          setDraft(next);
          onPreview?.(next);
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </label>
  );
}
