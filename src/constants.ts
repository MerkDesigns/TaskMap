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
  { swatch: "#008b9a", accent: "#005763", textCardAccent: "#007482" },
  { swatch: "#2f80ed", accent: "#2d5f87", textCardAccent: "#2e72c0" },
  { swatch: "#6352e8", accent: "#3d4a9a", textCardAccent: "#514ec7" },
  { swatch: "#8b5cf6", accent: "#5b3f86", textCardAccent: "#764fc4" },
  { swatch: "#d946ef", accent: "#7a3d61", textCardAccent: "#af42b1" },
  { swatch: "#ef4444", accent: "#81473d", textCardAccent: "#be4641" },
  { swatch: "#f59e0b", accent: "#6f5c2b", textCardAccent: "#ba8119" },
  { swatch: "#22c55e", accent: "#3f6b3c", textCardAccent: "#2f9e4f" },
];

// Unlocked by the "More colors" extension. Hues are chosen to stay visually
// distinct from the base presets above (orange, lime, sky, rose, slate,
// bronze, emerald, periwinkle).
export const EXTENDED_ACCENT_PRESETS = [
  { swatch: "#f97316", accent: "#7c4a2c", textCardAccent: "#c2641f" },
  { swatch: "#84cc16", accent: "#566b2c", textCardAccent: "#69a019" },
  { swatch: "#0ea5e9", accent: "#2c5d77", textCardAccent: "#1683b8" },
  { swatch: "#f43f5e", accent: "#7e3a47", textCardAccent: "#c23a50" },
  { swatch: "#64748b", accent: "#454f5e", textCardAccent: "#5b6779" },
  { swatch: "#a16207", accent: "#5f4a25", textCardAccent: "#876217" },
  { swatch: "#10b981", accent: "#2f6356", textCardAccent: "#159069" },
  { swatch: "#818cf8", accent: "#4a4f8a", textCardAccent: "#6068c9" },
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
