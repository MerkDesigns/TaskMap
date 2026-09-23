import { z } from "zod";
import { entityIdSchema } from "../../domain/document/documentSchema";

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
export const devicePreferencesSchema = z
  .object({
    defaultElementColors: z
      .object({ container: color, textCard: color, textBlock: color, image: color, mindmap: color })
      .strict(),
    recentColors: z.array(color).max(8),
    toolbarButtonsVisible: z.boolean(),
    privacyModeEnabled: z.boolean(),
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
