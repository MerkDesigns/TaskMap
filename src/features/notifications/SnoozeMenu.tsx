import { IconAlarmSnooze, IconClockHour4, IconSunrise } from "@tabler/icons-react";
import { useRef, type RefObject } from "react";
import { ALL_DAY_ALERT_TIME } from "../../domain/calendar/alertSchedule";
import { ContextMenu } from "../../ui/primitives/ContextMenu";
import { ContextMenuItem } from "../../ui/primitives/ContextMenuParts";
import { useClampedFixedPosition } from "../../useClampedFixedPosition";

/** When an alert snoozed now returns: in five minutes, in an hour, or tomorrow morning. */
export function snoozeChoices(now: number) {
  const tomorrow = new Date(now);
  const [hours, minutes] = ALL_DAY_ALERT_TIME.split(":").map(Number);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hours, minutes, 0, 0);
  return [
    { label: "5 minutes", until: now + 5 * 60_000, Icon: IconAlarmSnooze },
    { label: "1 hour", until: now + 3_600_000, Icon: IconClockHour4 },
    { label: `Tomorrow at ${ALL_DAY_ALERT_TIME}`, until: tomorrow.getTime(), Icon: IconSunrise },
  ] as const;
}

export interface SnoozeMenuProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly at: { readonly left: number; readonly top: number };
  readonly returnFocusRef: RefObject<HTMLElement | null>;
  readonly onSnooze: (until: number) => void;
}

/** How long to snooze an alert for. */
export function SnoozeMenu({ open, onOpenChange, at, returnFocusRef, onSnooze }: SnoozeMenuProps) {
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, at);
  return (
    <ContextMenu
      ref={menuRef}
      portal
      label="Snooze for"
      open={open}
      onOpenChange={onOpenChange}
      position={position}
      returnFocusRef={returnFocusRef}
    >
      {snoozeChoices(Date.now()).map(({ label, until, Icon }) => (
        <ContextMenuItem
          key={label}
          icon={<Icon size={17} stroke={2} />}
          onClick={() => {
            onOpenChange(false);
            onSnooze(until);
          }}
        >
          {label}
        </ContextMenuItem>
      ))}
    </ContextMenu>
  );
}
