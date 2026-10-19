import { IconCalendarPlus, IconSquarePlus } from "@tabler/icons-react";
import { useRef, type RefObject } from "react";
import { ContextMenu } from "../../ui/primitives/ContextMenu";
import { ContextMenuItem } from "../../ui/primitives/ContextMenuParts";
import { useClampedFixedPosition } from "../../useClampedFixedPosition";
import type { CalendarIslandBinding } from "./calendarEditing";
import { localDateOf } from "./calendarItems";
import { formatFullDate, type CalendarDay } from "./calendarMonth";

export interface CalendarDayMenuProps {
  readonly day: CalendarDay;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly at: { readonly left: number; readonly top: number };
  readonly returnFocusRef: RefObject<HTMLElement | null>;
  readonly binding: CalendarIslandBinding | undefined;
}

/** New events and reminders for a day. */
export function CalendarDayMenu({
  day,
  open,
  onOpenChange,
  at,
  returnFocusRef,
  binding,
}: CalendarDayMenuProps) {
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, at);
  const date = localDateOf(day);
  const run = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  return (
    <ContextMenu
      ref={menuRef}
      portal
      label={formatFullDate(day)}
      open={open}
      onOpenChange={onOpenChange}
      position={position}
      returnFocusRef={returnFocusRef}
    >
      <ContextMenuItem
        icon={<IconCalendarPlus size={17} stroke={2} />}
        disabled={!binding}
        onClick={run(() => binding?.openNewEvent(date))}
      >
        New event…
      </ContextMenuItem>
      <ContextMenuItem
        icon={<IconSquarePlus size={17} stroke={2} />}
        disabled={!binding}
        onClick={run(() => binding?.openNewReminder(date))}
      >
        New reminder…
      </ContextMenuItem>
    </ContextMenu>
  );
}
