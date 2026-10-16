import { useState } from "react";
import { ColorPickerMenu } from "../components/ColorPickerMenu";
import { MENU_ACCENT_PRESETS } from "../constants";
import {
  ContextMenuColorPickerSwatch,
  ContextMenuSwatch,
  ContextMenuSwatches,
} from "../ui/primitives/ContextMenuParts";

type AccentPreset = (typeof MENU_ACCENT_PRESETS)[number];

export interface ElementColorSwatchesInput {
  /** The element's current accent, compared against `accentOf` of each preset. */
  readonly accent: string;
  /** The accent a preset gives this kind of element. */
  readonly accentOf: (preset: AccentPreset) => string;
  /** How the swatches are announced, e.g. "Container accent". */
  readonly label: string;
  readonly recentColors: readonly string[];
  /** The menu is animating closed; the picker closes with it. */
  readonly closing: boolean;
  readonly onChange: (accent: string) => void;
  readonly onRememberRecentColor: (color?: string) => void;
}

/**
 * The color part of an element menu: `swatches` is the preset row whose last slot opens the full
 * color picker, and `panel` renders that picker beside the menu surface.
 */
export function useElementColorSwatches({
  accent,
  accentOf,
  label,
  recentColors,
  closing,
  onChange,
  onRememberRecentColor,
}: ElementColorSwatchesInput) {
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const presetChosen = MENU_ACCENT_PRESETS.some((preset) => accentOf(preset) === accent);

  const swatches = (
    <ContextMenuSwatches>
      {MENU_ACCENT_PRESETS.map((preset) => (
        <ContextMenuSwatch
          key={preset.swatch}
          color={preset.swatch}
          selected={accent === accentOf(preset)}
          title={label}
          aria-label={`${label} ${preset.swatch}`}
          onClick={() => onChange(accentOf(preset))}
        />
      ))}
      <ContextMenuColorPickerSwatch
        selected={!presetChosen}
        title="Extra colors"
        aria-label={`${label}: extra colors`}
        onClick={(event) => setPickerAnchor(event.currentTarget.getBoundingClientRect())}
      />
    </ContextMenuSwatches>
  );

  const panel =
    pickerAnchor && !closing ? (
      <ColorPickerMenu
        color={accent}
        left={pickerAnchor.right + 12}
        top={pickerAnchor.top}
        recentColors={[...recentColors]}
        onChange={onChange}
        onClose={(recentColor) => {
          onRememberRecentColor(recentColor);
          setPickerAnchor(null);
        }}
      />
    ) : null;

  return { swatches, panel };
}
