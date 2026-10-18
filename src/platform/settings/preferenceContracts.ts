import { z } from "zod";
import { entityIdSchema } from "../../domain/document/documentSchema";

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const chromeRadius = z.number().int().min(0).max(32);
export const chromeRadiiSchema = z
  .object({
    sidePanel: chromeRadius,
    canvasCard: chromeRadius,
    extensionCard: chromeRadius,
    quickExtensions: chromeRadius,
    quickExtensionsCard: chromeRadius,
    chrome: chromeRadius,
    settings: chromeRadius,
    settingsIsland: chromeRadius,
  })
  .strict();
export type ChromeRadii = z.infer<typeof chromeRadiiSchema>;
/** Shipped chrome radii (mirrored by the Rust `ChromeRadii::default`). */
export const DEFAULT_CHROME_RADII: ChromeRadii = Object.freeze({
  sidePanel: 19,
  canvasCard: 13,
  extensionCard: 10,
  quickExtensions: 17,
  quickExtensionsCard: 11,
  chrome: 14,
  settings: 12,
  settingsIsland: 8,
});
/** Every button the canvas toolbar can show; the ones not in the toolbar wait in its tray. */
export const TOOLBAR_BUTTON_IDS = [
  "canvases",
  "extensions",
  "settings",
  "privacy",
  "calendar",
  "sleep",
  "minimap",
  "placeholder-1",
  "placeholder-2",
  "placeholder-3",
] as const;
export type ToolbarButtonId = (typeof TOOLBAR_BUTTON_IDS)[number];
/** Slots in the toolbar's workspace group. */
export const TOOLBAR_SLOT_COUNT = 6;
/** Settings always stays in the toolbar: nothing else opens it. */
export const PINNED_TOOLBAR_BUTTON: ToolbarButtonId = "settings";
/** The shipped toolbar (mirrored by the Rust default). */
export const DEFAULT_TOOLBAR_BUTTONS: readonly ToolbarButtonId[] = Object.freeze([
  "canvases",
  "extensions",
  "settings",
  "privacy",
  "calendar",
  "sleep",
]);
export const toolbarButtonsSchema = z
  .array(z.enum(TOOLBAR_BUTTON_IDS))
  .min(1)
  .max(TOOLBAR_SLOT_COUNT)
  .refine((ids) => new Set(ids).size === ids.length && ids.includes(PINNED_TOOLBAR_BUTTON));
/** Shipped canvas background (`--taskmap-canvas-bg`, mirrored by the Rust default). */
export const DEFAULT_CANVAS_BACKGROUND_COLOR = "#0F1011";
export const devicePreferencesSchema = z
  .object({
    defaultElementColors: z
      .object({ container: color, textCard: color, textBlock: color, image: color, mindmap: color })
      .strict(),
    recentColors: z.array(color).max(8),
    toolbarButtonsVisible: z.boolean(),
    privacyModeEnabled: z.boolean(),
    chromeAutoHideEnabled: z.boolean(),
    chromeAutoHideDelayMs: z.number().int().min(1000).max(15000),
    chromeRadii: chromeRadiiSchema,
    /** TaskMap starts when the user signs in to Windows. */
    launchAtLogin: z.boolean(),
    /** Started at sign-in, it stays locked in the tray instead of opening its window. */
    launchToTray: z.boolean(),
    /** Background colour of every canvas. */
    canvasBackgroundColor: color,
    /** The toolbar's workspace buttons, in order. */
    toolbarButtons: toolbarButtonsSchema,
    /** The calendar island beside the toolbar is shown. */
    calendarVisible: z.boolean(),
    /** An expanded calendar stays open; only its chevron and sleep mode collapse it. */
    calendarStaysOpen: z.boolean(),
    dismissedUpdateVersion: z
      .string()
      .min(1)
      .max(128)
      .refine((value) => new TextEncoder().encode(value).length <= 128 && !/\p{Cc}/u.test(value))
      .nullable(),
  })
  .strict();
export const preferencesStateSchema = z
  .object({
    version: z.literal(1),
    edition: z.enum(["stable", "development"]),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    preferences: devicePreferencesSchema,
  })
  .strict();
export const rememberedViewportSchema = z
  .object({
    pan: z
      .object({
        x: z.number().finite().min(-1e9).max(1e9),
        y: z.number().finite().min(-1e9).max(1e9),
      })
      .strict(),
    zoom: z.number().min(0.5).max(2.5),
    screen: z
      .object({
        width: z.number().finite().nonnegative().max(1e6),
        height: z.number().finite().nonnegative().max(1e6),
      })
      .strict(),
  })
  .strict();
export const rememberedViewsSchema = z
  .object({
    version: z.literal(1),
    canvases: z
      .record(entityIdSchema("canvas"), rememberedViewportSchema)
      .refine((value) => Object.keys(value).length <= 256),
  })
  .strict();
export type DevicePreferences = z.infer<typeof devicePreferencesSchema>;
export type PreferencesState = z.infer<typeof preferencesStateSchema>;
export type RememberedViews = z.infer<typeof rememberedViewsSchema>;
export type SessionAuthority = { readonly databaseId: string; readonly sessionId: string };
