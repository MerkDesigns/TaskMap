import type { CardAdornment, CardAdornmentContext } from "./cardAdornment";
import type { RetainedExtensionKey } from "./retainedExtensionDefinition";
import { checkboxCardAdornment } from "./checkbox/checkboxCardAdornment";
import { workflowCardAdornment } from "./workflow/workflowCardAdornment";

/** Text-card adornments in display order. */
const cardAdornments: readonly CardAdornment[] = Object.freeze([
  checkboxCardAdornment,
  workflowCardAdornment,
]);

/** Whether installing the extension adds an adornment, and so changes a card's size. */
export const addsCardAdornment = (extension: RetainedExtensionKey) =>
  cardAdornments.some((adornment) => adornment.extension === extension);

/** The adornments installed on a text card. */
export function cardAdornmentsFor(context: CardAdornmentContext): readonly CardAdornment[] {
  return cardAdornments.filter(
    (adornment) => context.extensions[adornment.extension] !== undefined,
  );
}
