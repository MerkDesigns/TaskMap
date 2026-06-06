export const CANVAS_WIDTH = 3000;
export const CANVAS_HEIGHT = 3000;
export const MIN_WIDTH = 220;
export const MIN_HEIGHT = 140;
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
  { swatch: "#008b9a", accent: "#005763", textCardAccent: "#006e7c" },
  { swatch: "#2f80ed", accent: "#2d5f87", textCardAccent: "#2e6eb5" },
  { swatch: "#4f46e5", accent: "#314d91", textCardAccent: "#3f4ab7" },
  { swatch: "#8b5cf6", accent: "#5b3f86", textCardAccent: "#714cb8" },
  { swatch: "#d946ef", accent: "#7a3d61", textCardAccent: "#a541a1" },
  { swatch: "#ef4444", accent: "#81473d", textCardAccent: "#b24640" },
  { swatch: "#f59e0b", accent: "#6f5c2b", textCardAccent: "#ab7a1d" },
  { swatch: "#22c55e", accent: "#3f6b3c", textCardAccent: "#32944b" },
];

export const DEFAULT_CONTAINER_ACCENT = ACCENT_PRESETS[0].accent;
export const DEFAULT_TEXT_CARD_ACCENT = ACCENT_PRESETS[0].textCardAccent;

export const getTextCardAccent = (accent: string) =>
  ACCENT_PRESETS.find((preset) => preset.accent === accent || preset.textCardAccent === accent)
    ?.textCardAccent ?? accent;

export const MENU_ITEM_CLASS =
  "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-white/88 transition-colors hover:bg-white/[0.10] hover:text-white";
export const MENU_DIVIDER_CLASS = "my-1 h-px bg-white/[0.18]";
