import type { SyntheticEvent } from "react";
import type { HeaderControl } from "../headerControl";
import "./counter.css";

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

/** The container's card count, sized to its digits. */
export const counterHeaderControl: HeaderControl = {
  extension: "counter",
  hosts: ["container"],
  width: ({ cardCount }) => Math.max(36, String(cardCount).length * 8 + 26),
  Control: ({ context: { cardCount } }) => (
    <span
      className="taskmap-extension-counter"
      onPointerDown={stopPropagation}
      title={`${cardCount} ${cardCount === 1 ? "card" : "cards"}`}
    >
      {cardCount}
    </span>
  ),
};
