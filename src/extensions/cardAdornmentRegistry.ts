import type { CardAdornment, CardAdornmentContext } from "./cardAdornment";
import { checkboxCardAdornment } from "./checkbox/checkboxCardAdornment";

/** Text-card adornments in display order. */
const cardAdornments: readonly CardAdornment[] = Object.freeze([checkboxCardAdornment]);

/** The adornments installed on a text card. */
export function cardAdornmentsFor(context: CardAdornmentContext): readonly CardAdornment[] {
  return cardAdornments.filter(
    (adornment) => context.extensions[adornment.extension] !== undefined,
  );
}
