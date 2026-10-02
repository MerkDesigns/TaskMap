import {
  IconArrowAutofitDown,
  IconArrowAutofitDownFilled,
  IconArrowAutofitUp,
  IconArrowAutofitUpFilled,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { ContextMenuActionGroup, ContextMenuIconAction } from "../ui/primitives/ContextMenuParts";
import { Tooltip } from "../ui/primitives/Tooltip";

export type LayerMove = "back" | "backward" | "forward" | "front";

const LAYER_MOVES: readonly { direction: LayerMove; label: string; icon: ReactNode }[] = [
  { direction: "back", label: "Send to back", icon: <IconArrowAutofitDown size={20} stroke={2} /> },
  {
    direction: "backward",
    label: "Send one layer back",
    icon: <IconArrowAutofitDownFilled size={20} />,
  },
  {
    direction: "forward",
    label: "Bring one layer forward",
    icon: <IconArrowAutofitUpFilled size={20} />,
  },
  {
    direction: "front",
    label: "Bring to front",
    icon: <IconArrowAutofitUp size={20} stroke={2} />,
  },
];

/** The layer-order button row shared by element context menus. */
export function LayerOrderActions({ onMove }: { readonly onMove: (direction: LayerMove) => void }) {
  return (
    <ContextMenuActionGroup label="Layer order">
      {LAYER_MOVES.map(({ direction, label, icon }) => (
        <Tooltip key={direction} label={label} openDelayMs={1000}>
          <ContextMenuIconAction aria-label={label} icon={icon} onClick={() => onMove(direction)} />
        </Tooltip>
      ))}
    </ContextMenuActionGroup>
  );
}
