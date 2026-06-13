export const CANVAS_WIDTH = 3000;
export const CANVAS_HEIGHT = 3000;
export const MIN_WIDTH = 220;
export const MIN_HEIGHT = 140;
export const MIN_IMAGE_SIZE = 80;
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.05;
export const ALIGN_SNAP_DISTANCE = 8;
export const MINIMAP_MAX_SIZE = 176;

export const CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT;
export const MINIMAP_WIDTH =
  CANVAS_ASPECT >= 1 ? MINIMAP_MAX_SIZE : Math.max(72, Math.round(MINIMAP_MAX_SIZE * CANVAS_ASPECT));
export const MINIMAP_HEIGHT =
  CANVAS_ASPECT >= 1 ? Math.max(72, Math.round(MINIMAP_MAX_SIZE / CANVAS_ASPECT)) : MINIMAP_MAX_SIZE;

export const ACCENT_PRESETS = [
  { swatch: "#F98284", accent: "#955456", textCardAccent: "#C86B6E" },
  { swatch: "#F28E42", accent: "#915A32", textCardAccent: "#C3753A" },
  { swatch: "#C0AC2B", accent: "#766B25", textCardAccent: "#9C8C28" },
  { swatch: "#73C163", accent: "#4B7644", textCardAccent: "#609C54" },
  { swatch: "#31C4AE", accent: "#27786D", textCardAccent: "#2C9F8E" },
  { swatch: "#30BCE1", accent: "#277489", textCardAccent: "#2B99B6" },
  { swatch: "#7CABF8", accent: "#506A96", textCardAccent: "#678BC8" },
  { swatch: "#B994F9", accent: "#725E96", textCardAccent: "#9679C9" },
];

export const EXTENDED_ACCENT_PRESETS = [
  { swatch: "#D96FE8", accent: "#84498D", textCardAccent: "#AF5DBC" },
  { swatch: "#F7A36C", accent: "#946649", textCardAccent: "#C7855B" },
  { swatch: "#A8CF45", accent: "#697E33", textCardAccent: "#89A73C" },
  { swatch: "#53D6A2", accent: "#3A8267", textCardAccent: "#47AD85" },
  { swatch: "#46C8D7", accent: "#337A84", textCardAccent: "#3DA2AE" },
  { swatch: "#56AFFF", accent: "#3B6C9A", textCardAccent: "#498ECE" },
  { swatch: "#B59AF7", accent: "#706195", textCardAccent: "#937EC7" },
  { swatch: "#98A1B3", accent: "#606570", textCardAccent: "#7D8492" },
];

export const ALL_ACCENT_PRESETS = [...ACCENT_PRESETS, ...EXTENDED_ACCENT_PRESETS];

export const DEFAULT_CONTAINER_ACCENT = ACCENT_PRESETS[0].accent;
export const DEFAULT_TEXT_CARD_ACCENT = ACCENT_PRESETS[0].textCardAccent;

export const getTextCardAccent = (accent: string) =>
  ALL_ACCENT_PRESETS.find((preset) => preset.accent === accent || preset.textCardAccent === accent)
    ?.textCardAccent ?? accent;

export const MENU_ITEM_CLASS =
  "flex h-[34px] w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-white/88 transition-colors hover:bg-white/[0.10] hover:text-white";
export const MENU_DIVIDER_CLASS = "my-1 h-px bg-white/[0.18]";
