import { colorPickerHeaderControl } from "./color-picker/colorPickerHeaderControl";
import { copyPasteJsonHeaderControl } from "./copy-paste-json/copyPasteJsonHeaderControl";
import { counterHeaderControl } from "./counter/counterHeaderControl";
import type { HeaderControl, HeaderControlContext } from "./headerControl";
import { lockHeaderControl } from "./lock/lockHeaderControl";
import { privacyHeaderControl } from "./privacy/privacyHeaderControl";

/** Extension header controls in display order. */
const headerControls: readonly HeaderControl[] = Object.freeze([
  lockHeaderControl,
  privacyHeaderControl,
  colorPickerHeaderControl,
  counterHeaderControl,
  copyPasteJsonHeaderControl,
]);

/** The controls an element's header shows: installed on it, and offered for its type. */
export function headerControlsFor(context: HeaderControlContext): readonly HeaderControl[] {
  return headerControls.filter(
    (control) =>
      control.hosts.includes(context.host) && context.extensions[control.extension] !== undefined,
  );
}
