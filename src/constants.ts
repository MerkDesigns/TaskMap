export const CANVAS_WIDTH = 3000;
export const CANVAS_HEIGHT = 3000;
export const MIN_WIDTH = 220;
export const MIN_HEIGHT = 140;
export const MIN_IMAGE_SIZE = 80;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.05;
export const ALIGN_SNAP_DISTANCE = 8;
export const MINIMAP_MAX_SIZE = 176;

export const ACCENT_PRESETS = [
  { swatch: "#E85D61", accent: "#A74144", textCardAccent: "#A74144" },
  { swatch: "#E39343", accent: "#AA7234", textCardAccent: "#AA7234" },
  { swatch: "#DBC13D", accent: "#A99323", textCardAccent: "#A99323" },
  { swatch: "#91C85B", accent: "#729D49", textCardAccent: "#729D49" },
  { swatch: "#5DC7CA", accent: "#4C9A9C", textCardAccent: "#4C9A9C" },
  { swatch: "#5F96E8", accent: "#476FA8", textCardAccent: "#476FA8" },
  { swatch: "#836EF0", accent: "#6657B1", textCardAccent: "#6657B1" },
  { swatch: "#DC68D8", accent: "#A753A4", textCardAccent: "#A753A4" },
];

export const EXTENDED_ACCENT_PRESETS = [
  { swatch: "#E97146", accent: "#AD5837", textCardAccent: "#AD5837" },
  { swatch: "#51D88B", accent: "#41A76E", textCardAccent: "#41A76E" },
  { swatch: "#5684E0", accent: "#4165A7", textCardAccent: "#4165A7" },
  { swatch: "#A85CEB", accent: "#8648BC", textCardAccent: "#8648BC" },
  { swatch: "#DF6CA6", accent: "#A94F78", textCardAccent: "#A94F78" },
  { swatch: "#A0A0A0", accent: "#7B7B7B", textCardAccent: "#7B7B7B" },
  { swatch: "#555555", accent: "#313131", textCardAccent: "#313131" },
  { swatch: "#B6754A", accent: "#875839", textCardAccent: "#875839" },
];

export const ALL_ACCENT_PRESETS = [...ACCENT_PRESETS, ...EXTENDED_ACCENT_PRESETS];

export const DEFAULT_TEXT_CARD_ACCENT = ACCENT_PRESETS[5].textCardAccent;
export const DEFAULT_CONTAINER_ACCENT = DEFAULT_TEXT_CARD_ACCENT;
export const DEFAULT_ELEMENT_COLORS: DefaultElementColors = {
  container: DEFAULT_CONTAINER_ACCENT,
  textCard: DEFAULT_TEXT_CARD_ACCENT,
  textBlock: DEFAULT_CONTAINER_ACCENT,
  image: DEFAULT_CONTAINER_ACCENT,
};

export const getTextCardAccent = (accent: string) =>
  ALL_ACCENT_PRESETS.find((preset) => preset.accent === accent || preset.textCardAccent === accent)
    ?.textCardAccent ?? accent;

export const MENU_ITEM_CLASS =
  "flex h-[29px] w-full items-center gap-2 rounded-md px-2 text-left text-[12px] text-white/88 transition-colors hover:bg-white/[0.10] hover:text-white";
export const MENU_DIVIDER_CLASS = "mx-1 my-1 h-px bg-white/[0.10]";
export const CONTEXT_MENU_PANEL_CLASS =
  "context-menu-panel fixed z-30 w-[165px] rounded-[9px] border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-[12px] text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] [&_svg]:scale-[1.08]";
export const MENU_DANGER_ITEM_CLASS =
  "flex h-[29px] w-full items-center gap-2 rounded-md px-2 text-left text-[12px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300";
import type { DefaultElementColors } from "./types";
