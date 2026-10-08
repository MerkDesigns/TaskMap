// The data inside a TaskMap 0.3 export (`.tmap`), schema version 2, as the legacy app wrote it
// (src/types.ts on main). Only the fields the migration reads are listed; the rest is ignored.
import { z } from "zod";

const accent = z.string().optional();
const position = { x: z.number(), y: z.number() };
const size = { width: z.number(), height: z.number() };
const extensions = z.record(z.unknown()).optional();
const layered = { id: z.string(), layer: z.number().optional(), extensions };
const contained = { containerId: z.string().optional(), order: z.number().optional() };

export const legacyCanvasSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  containers: z.array(
    z.object({
      ...layered,
      ...position,
      ...size,
      name: z.string(),
      accent,
      headerButtonsVisible: z.boolean().optional(),
    }),
  ),
  textCards: z.array(
    z.object({
      ...layered,
      ...position,
      ...contained,
      kind: z.literal("mindmap").optional(),
      text: z.string(),
      accent,
      link: z.string().optional(),
    }),
  ),
  textBlocks: z.array(
    z.object({
      ...layered,
      ...position,
      ...size,
      name: z.string(),
      text: z.string(),
      accent,
      headerButtonsVisible: z.boolean().optional(),
    }),
  ),
  images: z.array(
    z.object({
      ...layered,
      ...position,
      ...size,
      ...contained,
      imageId: z.string().optional(),
      accent,
      background: z.boolean().optional(),
    }),
  ),
  mindmapConnections: z.array(
    z.object({
      id: z.string(),
      sourceId: z.string(),
      sourcePort: z.enum(["left", "right", "top", "bottom"]),
      targetId: z.string(),
      targetPort: z.enum(["left", "right", "top", "bottom"]),
    }),
  ),
});

export const legacyAppDataSchema = z.object({
  schemaVersion: z.literal(2),
  activeCanvasId: z.string(),
  canvases: z.array(legacyCanvasSchema),
  canvasGridStyle: z.enum(["dots", "lines"]),
  canvasGridOpacity: z.object({ dots: z.number(), lines: z.number() }),
  shadowsUnderElements: z.boolean(),
  allowLockedElementDeletion: z.boolean(),
  minimapEnabled: z.boolean(),
});

/** An image bundled in the export, as the legacy app stored it (WebP or GIF). */
export const legacyImageSchema = z.object({
  hash: z.string(),
  format: z.string(),
  width: z.number(),
  height: z.number(),
  data: z.string(),
});

export type LegacyCanvas = z.infer<typeof legacyCanvasSchema>;
export type LegacyImage = z.infer<typeof legacyImageSchema>;
