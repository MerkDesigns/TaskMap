import { IconCheck } from "@tabler/icons-react";
import type { CardAdornment } from "../cardAdornment";
import "./checkbox.css";

/** A tick box before the card's text; ticking marks the text as done. */
export const checkboxCardAdornment: CardAdornment = {
  extension: "checkbox",
  Leading: ({ context, commands }) => {
    const checked = Boolean(context.extensions.checkbox?.checked);
    return (
      <button
        type="button"
        className="taskmap-extension-checkbox"
        aria-pressed={checked}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          commands.toggle("checkbox", context.elementId);
        }}
      >
        <span className="taskmap-extension-checkbox__box" style={{ borderColor: context.accent }}>
          <IconCheck size={16} stroke={2} />
        </span>
      </button>
    );
  },
  textState: ({ extensions }) => (extensions.checkbox?.checked ? "done" : undefined),
};
