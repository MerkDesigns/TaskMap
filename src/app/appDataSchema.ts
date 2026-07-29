import { z } from "zod";
import { DEFAULT_ELEMENT_COLORS } from "../constants";
import type { AppData } from "../types";

export const APP_DATA_SCHEMA_VERSION = 1 as const;

const finiteNumber = z.number().finite();
const positiveNumber = finiteNumber.positive();
const optionalLayer = finiteNumber.optional();

const extensionsSchema = z
  .object({
    privacy: z.object({ enabled: z.boolean() }).optional(),
    lock: z.object({ enabled: z.boolean() }).optional(),
    colorPicker: z.object({ enabled: z.boolean() }).optional(),
    checkbox: z.object({ checked: z.boolean() }).optional(),
    commandRunner: z
      .object({
        commands: z.array(
          z.object({
            command: z.string().refine((value) => value.trim().length > 0, {
              message: "Command must not be empty",
            }),
            workingDirectory: z.string().optional(),
            runMode: z.enum(["terminal", "background"]),
            runAsAdmin: z.boolean().optional(),
          }),
        ),
      })
      .optional(),
    autoCheckbox: z.object({ enabled: z.boolean() }).optional(),
    dailyReset: z.object({ lastResetDate: z.string() }).optional(),
    counter: z.object({ enabled: z.boolean() }).optional(),
    inheritCardColor: z.object({ enabled: z.boolean() }).optional(),
    copyPasteJson: z.object({ enabled: z.boolean() }).optional(),
    pickCard: z
      .object({
        selectedCardId: z.string().optional(),
        lastCardId: z.string().optional(),
      })
      .optional(),
    search: z.object({ query: z.string() }).optional(),
    sorting: z
      .object({
        mode: z.enum(["alphabet", "color"]).nullable(),
        direction: z.enum(["asc", "desc"]),
      })
      .optional(),
  })
  .passthrough()
  .superRefine((extensions, context) => {
    if (extensions.checkbox && extensions.commandRunner) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Checkbox and Command Runner cannot both be installed",
      });
    }
  });

const containerSchema = z
  .object({
    id: z.string().min(1),
    layer: optionalLayer,
    headerButtonsVisible: z.boolean().optional(),
    name: z.string(),
    x: finiteNumber,
    y: finiteNumber,
    width: positiveNumber,
    height: positiveNumber,
    accent: z.string().min(1),
    extensions: extensionsSchema.optional(),
  })
  .passthrough();

const textCardSchema = z
  .object({
    id: z.string().min(1),
    layer: optionalLayer,
    text: z.string(),
    x: finiteNumber,
    y: finiteNumber,
    accent: z.string().min(1),
    link: z.string().optional(),
    containerId: z.string().optional(),
    order: finiteNumber.optional(),
    extensions: extensionsSchema.optional(),
  })
  .passthrough();

const textBlockSchema = z
  .object({
    id: z.string().min(1),
    layer: optionalLayer,
    headerButtonsVisible: z.boolean().optional(),
    name: z.string(),
    text: z.string(),
    x: finiteNumber,
    y: finiteNumber,
    width: positiveNumber,
    height: positiveNumber,
    accent: z.string().min(1),
    extensions: extensionsSchema.optional(),
  })
  .passthrough();

const imageSchema = z
  .object({
    id: z.string().min(1),
    layer: optionalLayer,
    imageId: z.string().min(1).optional(),
    format: z.string().min(1).optional(),
    x: finiteNumber,
    y: finiteNumber,
    width: positiveNumber,
    height: positiveNumber,
    naturalWidth: positiveNumber.optional(),
    naturalHeight: positiveNumber.optional(),
    accent: z.string().min(1),
    background: z.boolean().optional(),
    containerId: z.string().optional(),
    order: finiteNumber.optional(),
    extensions: extensionsSchema.optional(),
  })
  .passthrough();

const taskCanvasSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    width: positiveNumber,
    height: positiveNumber,
    containers: z.array(containerSchema),
    textCards: z.array(textCardSchema),
    textBlocks: z.array(textBlockSchema),
    images: z.array(imageSchema),
    pan: z.object({ x: finiteNumber, y: finiteNumber }),
    zoom: positiveNumber,
    previewViewport: z
      .object({
        width: positiveNumber,
        height: positiveNumber,
      })
      .optional(),
  })
  .passthrough()
  .superRefine((canvas, context) => {
    const ids = [
      ...canvas.containers.map(({ id }) => id),
      ...canvas.textCards.map(({ id }) => id),
      ...canvas.textBlocks.map(({ id }) => id),
      ...canvas.images.map(({ id }) => id),
    ];
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Element IDs must be unique within a canvas",
      });
    }
  });

export const appDataSchema = z
  .object({
    schemaVersion: z.literal(APP_DATA_SCHEMA_VERSION),
    activeCanvasId: z.string().min(1),
    canvases: z.array(taskCanvasSchema).min(1),
    canvasGridStyle: z.enum(["dots", "lines"]),
    canvasGridOpacity: z.object({
      dots: finiteNumber.min(0).max(100),
      lines: finiteNumber.min(0).max(100),
    }),
    defaultElementColors: z
      .object({
        container: z.string().min(1),
        textCard: z.string().min(1),
        textBlock: z.string().min(1),
        image: z.string().min(1),
      })
      .default(DEFAULT_ELEMENT_COLORS),
    recentColors: z.array(z.string().min(1)).max(8).default([]),
    shadowsUnderElements: z.boolean().default(false),
    allowLockedElementDeletion: z.boolean().default(true),
    discordRpcEnabled: z.boolean(),
    discordRpcShowCanvas: z.boolean(),
    minimapEnabled: z.boolean(),
    privacyModeEnabled: z.boolean(),
    toolbarButtonsVisible: z.boolean(),
    dismissedUpdateVersion: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, context) => {
    const canvasIds = data.canvases.map(({ id }) => id);
    if (new Set(canvasIds).size !== canvasIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Canvas IDs must be unique" });
    }
    if (!canvasIds.includes(data.activeCanvasId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activeCanvasId"],
        message: "Active canvas does not exist",
      });
    }
  });

const describeIssue = (issue: z.ZodIssue) => {
  const path = issue.path.length ? issue.path.join(".") : "root";
  return `${path}: ${issue.message}`;
};

export const validateAppData = (value: unknown): AppData => {
  const result = appDataSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid TaskMap data (${describeIssue(result.error.issues[0])})`);
  }
  return result.data as AppData;
};
