import { IconArrowLeft, IconChevronDown } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useIslandReveal } from "../../ui/patterns/workspace/useIslandReveal";
import { ToolbarGroup } from "../../ui/patterns/workspace/FloatingCanvasToolbar";
import { IconButton } from "../../ui/primitives/Button";
import { CalendarDayMenu } from "./CalendarDayMenu";
import { CalendarDayPanel, dayItemCount, dayPanelHeight } from "./CalendarDayPanel";
import type { CalendarIslandBinding } from "./calendarEditing";
import type { CalendarPick } from "./calendarFormParts";
import { calendarDayOfLocal, localDateOf, markedDates } from "./calendarItems";
import {
  formatCompactDate,
  formatFullDate,
  monthOf,
  sameDay,
  sameMonth,
  type CalendarDay,
  type CalendarMonth,
} from "./calendarMonth";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarClock, useToday } from "./calendarTime";
import { CalendarTimePicker } from "./CalendarTimePicker";
import { EventEditor } from "./EventEditor";
import { ReminderEditor } from "./ReminderEditor";
import "./calendarIsland.css";

/** The island's width, its compact height and its height showing the month. */
const ISLAND_WIDTH = 300;
const COMPACT_HEIGHT = 40;
const MONTH_HEIGHT = 348;
/** The bar above the month while it picks a day for a form. */
const PICK_BAR_HEIGHT = 40;
/** A form's or the time picker's height until it has been measured. */
const VIEW_FALLBACK_HEIGHT = 420;

export interface CalendarIslandProps {
  /** The island is shown; it slides out before unmounting when this turns false. */
  readonly open: boolean;
  readonly radius?: number;
  /** Clicks elsewhere and Escape leave it expanded; only its chevron and sleep collapse it. */
  readonly staysOpen?: boolean;
  /** The document's events and reminders and their editors; absent outside a session. */
  readonly calendar?: CalendarIslandBinding;
}

/**
 * The calendar beside the toolbar, after the Windows calendar flyout: a compact strip with today's
 * date that expands downward into the month. It also holds the event and reminder forms, and the
 * day and time pickers those forms open in their place.
 */
export function CalendarIsland({ open, radius, staysOpen = false, calendar }: CalendarIslandProps) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  if (!mounted) return null;
  return (
    <CalendarIslandSurface
      open={open}
      radius={radius}
      staysOpen={staysOpen}
      calendar={calendar}
      onClosed={() => setMounted(false)}
    />
  );
}

function CalendarIslandSurface({
  open,
  radius,
  staysOpen,
  calendar,
  onClosed,
}: CalendarIslandProps & { readonly onClosed: () => void }) {
  const today = useToday();
  const [selected, setSelected] = useState<CalendarDay>(today);
  const [view, setView] = useState<CalendarMonth>(() => monthOf(today));
  const surfaceRef = useRef<HTMLElement>(null);
  const [dayMenu, setDayMenu] = useState<{ readonly left: number; readonly top: number } | null>(
    null,
  );
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const dayMenuReturnFocus = useRef<HTMLElement | null>(null);
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const [formHeight, setFormHeight] = useState(VIEW_FALLBACK_HEIGHT);
  const [timePickerHeight, setTimePickerHeight] = useState(VIEW_FALLBACK_HEIGHT);
  const [pick, setPick] = useState<CalendarPick | null>(null);
  const editing = calendar?.editing ?? null;
  const shown: "month" | "form" | "pick-date" | "pick-time" =
    pick?.kind === "date"
      ? "pick-date"
      : pick?.kind === "time"
        ? "pick-time"
        : editing
          ? "form"
          : "month";
  const selectedDate = localDateOf(selected);
  const expandedHeight =
    shown === "form"
      ? COMPACT_HEIGHT + formHeight
      : shown === "pick-time"
        ? COMPACT_HEIGHT + timePickerHeight
        : shown === "pick-date"
          ? MONTH_HEIGHT + PICK_BAR_HEIGHT
          : MONTH_HEIGHT +
            (dayPanelOpen
              ? dayPanelHeight(dayItemCount(calendar?.calendar ?? null, selectedDate))
              : 0);
  const { expanded, size, expand, collapse } = useIslandReveal({
    surfaceRef,
    width: ISLAND_WIDTH,
    compactHeight: COMPACT_HEIGHT,
    expandedHeight,
    staysOpen,
    // An event or reminder being written must not be lost to a stray click or Escape.
    holdOpen: dayMenuOpen || editing !== null,
  });
  const marked = useMemo(() => markedDates(calendar?.calendar ?? null), [calendar?.calendar]);

  // Opening an event or reminder, from here or from elsewhere such as the inbox, shows its form.
  const editingSession = editing?.session;
  useEffect(() => {
    setPick(null);
    if (editingSession !== undefined) expand();
  }, [editingSession, expand]);

  useEffect(() => {
    if (!expanded) setDayPanelOpen(false);
  }, [expanded]);

  const select = (day: CalendarDay) => {
    setSelected(day);
    if (!sameMonth(monthOf(day), view)) setView(monthOf(day));
  };

  const clickDay = (day: CalendarDay) => {
    if (pick?.kind === "date") {
      pick.apply(localDateOf(day));
      setPick(null);
      return;
    }
    // Clicking a day shows its events and reminders below the month; clicking it again hides them.
    setDayPanelOpen(!(dayPanelOpen && sameDay(day, selected)));
    select(day);
  };

  const startPick = (next: CalendarPick) => {
    if (next.kind === "date") {
      const day = calendarDayOfLocal(next.value);
      setSelected(day);
      setView(monthOf(day));
    }
    setPick(next);
  };

  const toggleExpanded = () => {
    if (expanded) {
      collapse();
      return;
    }
    setView(monthOf(selected));
    expand();
  };

  const openDayMenu = (event: MouseEvent<HTMLButtonElement>, day: CalendarDay) => {
    event.preventDefault();
    if (shown !== "month") return;
    select(day);
    dayMenuReturnFocus.current = event.currentTarget;
    setDayMenu({ left: event.clientX, top: event.clientY });
    setDayMenuOpen(true);
  };

  const closeEditor = () => {
    setPick(null);
    calendar?.closeEditor();
  };
  const formProps = {
    onBack: closeEditor,
    onClose: () => {
      closeEditor();
      collapse();
    },
    onPick: startPick,
    onHeightChange: (height: number) => {
      if (height > 0) setFormHeight(height);
    },
  };

  return (
    <>
      <ToolbarGroup
        ref={surfaceRef}
        label="Calendar"
        radius={radius}
        sleepCorner="top"
        geometrySource="owner"
        open={open}
        onClosed={onClosed}
        className="taskmap-calendar"
        data-expanded={expanded || undefined}
        style={{ width: size.width, height: size.height }}
      >
        <div className="taskmap-calendar__content">
          <div className="taskmap-calendar__strip">
            <span className="taskmap-calendar__today-label">{formatCompactDate(today)}</span>
            <span className="taskmap-calendar__divider" aria-hidden="true" />
            <CalendarClock />
            <IconButton
              variant="ghost"
              size="compact"
              className="taskmap-calendar__chevron"
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse calendar" : "Expand calendar"}
              title={expanded ? "Collapse calendar" : "Expand calendar"}
              icon={<IconChevronDown size={18} stroke={2} />}
              onClick={toggleExpanded}
            />
          </div>
          {/* The form stays mounted while a picker shows in its place, keeping what was typed. */}
          {editing && (
            <div className="taskmap-calendar__view" inert={!expanded} hidden={shown !== "form"}>
              {editing.kind === "event" ? (
                <EventEditor
                  key={editing.session}
                  editing={editing}
                  onSave={(event) => calendar?.saveEvent(event)}
                  onDelete={() => calendar?.deleteEvent(editing.event.id)}
                  {...formProps}
                />
              ) : (
                <ReminderEditor
                  key={editing.session}
                  editing={editing}
                  onSave={(reminder) => calendar?.saveReminder(reminder)}
                  onDelete={() => calendar?.deleteReminder(editing.reminder.id)}
                  {...formProps}
                />
              )}
            </div>
          )}
          {pick?.kind === "time" && (
            <div className="taskmap-calendar__view" inert={!expanded}>
              <CalendarTimePicker
                title={pick.title}
                value={pick.value}
                onSet={(time) => {
                  pick.apply(time);
                  setPick(null);
                }}
                onBack={() => setPick(null)}
                onHeightChange={(height) => {
                  if (height > 0) setTimePickerHeight(height);
                }}
              />
            </div>
          )}
          <div
            className="taskmap-calendar__month"
            inert={!expanded}
            hidden={shown !== "month" && shown !== "pick-date"}
            onKeyDown={(event) => {
              if (shown !== "pick-date" || event.key !== "Escape" || event.defaultPrevented) {
                return;
              }
              event.preventDefault();
              setPick(null);
            }}
          >
            {pick?.kind === "date" && (
              <div className="taskmap-calendar__pick-bar">
                <IconButton
                  variant="ghost"
                  size="compact"
                  aria-label="Back"
                  title="Back"
                  icon={<IconArrowLeft size={18} stroke={2} />}
                  onClick={() => setPick(null)}
                />
                <span className="taskmap-calendar__pick-title">{pick.title}</span>
              </div>
            )}
            <CalendarMonthGrid
              today={today}
              selected={selected}
              view={view}
              marked={marked}
              onViewChange={setView}
              onSelect={select}
              onDayClick={clickDay}
              onDayContextMenu={openDayMenu}
            />
            {dayPanelOpen && shown === "month" && (
              <CalendarDayPanel
                calendar={calendar?.calendar ?? null}
                date={selectedDate}
                label={`${formatFullDate(selected)}: events and reminders`}
                onOpenEvent={(eventId) => calendar?.openEvent(eventId)}
                onOpenReminder={(reminderId) => calendar?.openReminder(reminderId)}
                onSetReminderCompleted={(reminderId, completed) =>
                  calendar?.setReminderCompleted(reminderId, completed)
                }
              />
            )}
          </div>
        </div>
      </ToolbarGroup>
      {dayMenu && (
        <CalendarDayMenu
          day={selected}
          open={dayMenuOpen}
          onOpenChange={setDayMenuOpen}
          at={dayMenu}
          returnFocusRef={dayMenuReturnFocus}
          binding={calendar}
        />
      )}
    </>
  );
}
