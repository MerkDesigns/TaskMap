import { Tooltip as MantineTooltip, type FloatingPosition } from "@mantine/core";
import type { ReactElement, ReactNode } from "react";
import "./tooltip.css";

export interface TooltipProps {
  readonly children: ReactElement;
  readonly disabled?: boolean;
  readonly label: ReactNode;
  readonly openDelay?: number;
  readonly position?: FloatingPosition;
}

export function Tooltip({ children, disabled, label, openDelay = 350, position }: TooltipProps) {
  return (
    <MantineTooltip
      disabled={disabled}
      label={label}
      openDelay={openDelay}
      position={position}
      events={{ hover: true, focus: false, touch: false }}
      classNames={{ tooltip: "taskmap-tooltip", arrow: "taskmap-tooltip__arrow" }}
    >
      {children}
    </MantineTooltip>
  );
}
