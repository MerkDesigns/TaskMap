// A TaskMap document with its words replaced by random letters, for reproducing performance
// problems on someone's real data without seeing its text. Everything that shapes rendering stays:
// layout, layers, colours, extensions, connections and the length and spacing of every text.
import { createRetainedCanvasProjection } from "../../src/app/view-projection/createRetainedCanvasProjection";
import type { TaskMapDocument } from "../../src/domain/document/documentTypes";
import { validateTaskMapDocument } from "../../src/domain/document/validateDocument";

export interface ScrambleOptions {
  /** The new database's id; the copy must not share the original's identity. */
  readonly databaseId: string;
  /** A random integer in [0, below). */
  readonly randomInt: (below: number) => number;
}

export type ScrambleResult =
  | {
      readonly ok: true;
      readonly document: TaskMapDocument;
      /** How many strings were scrambled under each key: names only, never values. */
      readonly scrambledKeys: Readonly<Record<string, number>>;
    }
  | { readonly ok: false; readonly error: string };

// Strings under these keys are structure (references, enums, colours), not content. Every other
// string is scrambled, so a field this list does not know about can never leak.
const STRUCTURAL_KEYS = new Set([
  "schemaVersion",
  "databasePurpose",
  "type",
  "kind",
  "display",
  "mimeType",
  "accent",
  "color",
  "extensionId",
  "style",
]);

const isStructuralKey = (key: string) =>
  STRUCTURAL_KEYS.has(key) || /(^id|Id|Ids|Order)$/.test(key);

const COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%/]+\))$/i;

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = LOWER.toUpperCase();

/** Every letter and digit replaced by a random one of its kind; spacing and symbols kept. */
export function scrambleText(text: string, randomInt: (below: number) => number): string {
  return text.replace(/\p{L}|\p{N}/gu, (char) => {
    if (/\p{N}/u.test(char)) return String(randomInt(10));
    const upper = char !== char.toLowerCase() && char === char.toUpperCase();
    return (upper ? UPPER : LOWER)[randomInt(26)];
  });
}

export function scrambleDocument(input: unknown, options: ScrambleOptions): ScrambleResult {
  const scrambledKeys: Record<string, number> = {};

  const visit = (value: unknown, key: string, structural: boolean): unknown => {
    if (typeof value === "string") {
      if (structural || COLOR.test(value)) return value;
      scrambledKeys[key] = (scrambledKeys[key] ?? 0) + 1;
      return scrambleText(value, options.randomInt);
    }
    if (Array.isArray(value)) return value.map((item) => visit(item, key, structural));
    if (value && typeof value === "object") {
      // Object keys are ids or schema field names, never content.
      return Object.fromEntries(
        Object.entries(value).map(([childKey, child]) => [
          childKey,
          visit(child, childKey, isStructuralKey(childKey)),
        ]),
      );
    }
    return value;
  };

  const scrambled = visit(input, "", false) as Record<string, unknown>;
  const validated = validateTaskMapDocument({ ...scrambled, databaseId: options.databaseId });
  if (!validated.ok) {
    return {
      ok: false,
      error: `The scrambled document is invalid (${validated.stage}: ${JSON.stringify(validated.issues[0])})`,
    };
  }
  const projection = createRetainedCanvasProjection();
  try {
    const projected = projection.project(validated.document);
    if (!projected.ok) {
      const codes = [...new Set(projected.issues.map(({ code }) => code))].join(", ");
      return { ok: false, error: `The app would refuse the scrambled document (${codes})` };
    }
  } finally {
    projection.clear();
  }
  return { ok: true, document: validated.document, scrambledKeys };
}
