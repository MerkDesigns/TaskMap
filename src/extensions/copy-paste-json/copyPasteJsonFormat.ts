import { z } from "zod";
import type { ContainerElement, TextCardElement } from "../../types";

export const COPY_PASTE_JSON_INSTRUCTION =
  "You may edit the container and cards. Set each hyperlink to an HTTP(S) URL or null. Return only JSON in this same structure.";

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "must be a six-digit hex color such as #1A2B3C");

const httpHyperlinkSchema = z.string().superRefine((value, context) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must use HTTP or HTTPS",
      });
    }
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "must be a valid HTTP or HTTPS URL",
    });
  }
});

const copyPasteJsonCardSchema = z
  .object({
    text: z.string(),
    color: hexColorSchema,
    hyperlink: httpHyperlinkSchema.nullable(),
  })
  .strict();

export const copyPasteJsonPayloadSchema = z
  .object({
    instruction: z.string().min(1),
    name: z.string().refine((value) => value.trim().length > 0, "must not be empty"),
    color: hexColorSchema,
    cards: z.array(copyPasteJsonCardSchema),
  })
  .strict();

export type CopyPasteJsonPayload = z.infer<typeof copyPasteJsonPayloadSchema>;

export type CopyPasteJsonParseResult =
  { success: true; data: CopyPasteJsonPayload } | { success: false; error: string };

const formatIssuePath = (path: (string | number)[]) => {
  if (path[0] === "cards" && typeof path[1] === "number") {
    const field = typeof path[2] === "string" ? ` ${path[2]}` : "";
    return `Card ${path[1] + 1}${field}`;
  }

  if (path[0] === "color") return "Container color";
  if (path[0] === "name") return "Container name";
  if (path[0] === "instruction") return "Instruction";
  if (path[0] === "cards") return "Cards";
  return "JSON";
};

export const parseCopyPasteJson = (value: string): CopyPasteJsonParseResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { success: false, error: "Clipboard does not contain valid JSON." };
  }

  const result = copyPasteJsonPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: `${formatIssuePath(issue.path)} ${issue.message}.`,
    };
  }

  return { success: true, data: result.data };
};

export const serializeContainerForAi = (
  container: Readonly<Pick<ContainerElement, "name" | "accent">>,
  orderedCards: readonly Readonly<Pick<TextCardElement, "text" | "accent" | "link">>[],
) =>
  JSON.stringify(
    {
      instruction: COPY_PASTE_JSON_INSTRUCTION,
      name: container.name,
      color: container.accent,
      cards: orderedCards.map((card) => ({
        text: card.text,
        color: card.accent,
        hyperlink: card.link ?? null,
      })),
    } satisfies CopyPasteJsonPayload,
    null,
    2,
  );
