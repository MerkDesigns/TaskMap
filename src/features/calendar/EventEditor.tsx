import { IconSun } from "@tabler/icons-react";
import { useId, useRef, useState } from "react";
import type { AlertOffset, CalendarEvent, EventTiming } from "../../domain/calendar/calendarSchema";
import {
  localDateTimeOf,
  splitLocalDateTime,
  type LocalDate,
  type LocalTime,
} from "../../domain/calendar/localDateTime";
import { Field } from "../../ui/primitives/Field";
import { Select, TextField } from "../../ui/primitives/FormControls";
import { Switch } from "../../ui/primitives/SelectionControls";
import type { CalendarEditing } from "./calendarEditing";
import {
  CalendarFormHeader,
  ColorSaveFooter,
  FORM_LIMITS,
  DateField,
  TimeField,
  useInitialFocus,
  useReportedHeight,
  type CalendarPick,
} from "./calendarFormParts";
import { ALL_DAY_ALERTS, alertFromKey, alertKey, TIMED_ALERTS } from "./calendarItems";

export interface EventEditorProps {
  readonly editing: Extract<CalendarEditing, { kind: "event" }>;
  readonly onSave: (event: CalendarEvent) => void;
  readonly onDelete: () => void;
  /** Back to the month, keeping the calendar open. */
  readonly onBack: () => void;
  /** Leaves the event and closes the calendar. */
  readonly onClose: () => void;
  /** Asks the calendar to pick a day or time in place of the form. */
  readonly onPick: (pick: CalendarPick) => void;
  /** The form's height, whenever it changes, so the calendar can grow to fit it. */
  readonly onHeightChange: (height: number) => void;
}

function timingParts(timing: EventTiming) {
  if (timing.kind === "all-day") {
    return {
      startDate: timing.startDate,
      startTime: "09:00",
      endDate: timing.endDate,
      endTime: "10:00",
    };
  }
  const start = splitLocalDateTime(timing.start);
  const end = splitLocalDateTime(timing.end);
  return { startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time };
}

/** An hour later on the same day, stopping at the day's last minute. */
function hourAfter(time: LocalTime): LocalTime {
  const [hours, minutes] = time.split(":").map(Number);
  if (hours >= 23) return "23:59";
  return `${String(hours + 1).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Creates or edits one event inside the calendar island, in place of the month: a title and
 * place, all day or from a start to an end time, an alert, and a colour.
 */
export function EventEditor({
  editing,
  onSave,
  onDelete,
  onBack,
  onClose,
  onPick,
  onHeightChange,
}: EventEditorProps) {
  const { event: initial, isNew, failed } = editing;
  const initialParts = timingParts(initial.timing);
  const [title, setTitle] = useState(initial.title);
  const [location, setLocation] = useState(initial.location);
  const [accent, setAccent] = useState(initial.accent);
  const [allDay, setAllDay] = useState(initial.timing.kind === "all-day");
  const [startDate, setStartDate] = useState<LocalDate>(initialParts.startDate);
  const [startTime, setStartTime] = useState<LocalTime>(initialParts.startTime);
  const [endDate, setEndDate] = useState<LocalDate>(initialParts.endDate);
  const [endTime, setEndTime] = useState<LocalTime>(initialParts.endTime);
  const [alert, setAlert] = useState<AlertOffset | null>(initial.alerts[0] ?? null);
  // A second alert from before is kept as long as the kind of timing stays the same.
  const [laterAlerts, setLaterAlerts] = useState(initial.alerts.slice(1));
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  useInitialFocus(titleRef);
  useReportedHeight(rootRef, onHeightChange);

  const ordered = allDay
    ? endDate >= startDate
    : localDateTimeOf(endDate, endTime) >= localDateTimeOf(startDate, startTime);
  const complete = title.trim().length > 0 && ordered;
  const choices = allDay ? ALL_DAY_ALERTS : TIMED_ALERTS;
  const alertOptions = [
    { value: "none", label: "None" },
    ...choices.map(({ label, offset }) => ({ value: alertKey(offset), label })),
  ];

  // Moving the start past the end takes the end along, as calendar apps do.
  const changeStartDate = (date: LocalDate) => {
    setStartDate(date);
    if (endDate < date) setEndDate(date);
  };
  const changeStartTime = (time: LocalTime) => {
    setStartTime(time);
    if (startDate === endDate && endTime <= time) setEndTime(hourAfter(time));
  };

  const save = () => {
    if (!complete) return;
    onSave({
      ...initial,
      title: title.trim(),
      location: location.trim(),
      accent,
      timing: allDay
        ? { kind: "all-day", startDate, endDate }
        : {
            kind: "timed",
            start: localDateTimeOf(startDate, startTime),
            end: localDateTimeOf(endDate, endTime),
          },
      alerts: [...(alert ? [alert] : []), ...laterAlerts],
    });
  };

  const dateField = (label: string, value: LocalDate, apply: (date: LocalDate) => void) => (
    <DateField
      label={label}
      value={value}
      onChange={apply}
      onPick={() =>
        onPick({ kind: "date", title: `Choose the ${label.toLowerCase()}`, value, apply })
      }
    />
  );
  const timeField = (label: string, value: LocalTime, apply: (time: LocalTime) => void) => (
    <TimeField
      label={label}
      value={value}
      onChange={apply}
      disabled={allDay}
      onPick={() =>
        onPick({ kind: "time", title: `Choose the ${label.toLowerCase()}`, value, apply })
      }
    />
  );

  return (
    <div
      ref={rootRef}
      className="taskmap-calendar-form"
      role="group"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        onBack();
      }}
    >
      <CalendarFormHeader
        titleId={titleId}
        title={isNew ? "New event" : "Edit event"}
        onBack={onBack}
        onClose={onClose}
        onDelete={isNew ? undefined : onDelete}
        deleteLabel="Delete event"
      />
      <Field label="Title">
        <TextField
          ref={titleRef}
          value={title}
          maxLength={FORM_LIMITS.title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
          }}
        />
      </Field>
      <Field label="Location">
        <TextField
          value={location}
          maxLength={FORM_LIMITS.location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </Field>
      <div className="taskmap-calendar-form__span">
        <span className="taskmap-calendar-form__when-label" aria-hidden="true">
          <IconSun size={18} stroke={2} />
          All day
        </span>
        <Switch
          aria-label="All day"
          checked={allDay}
          onChange={(event) => {
            setAllDay(event.target.checked);
            setAlert(null);
            setLaterAlerts([]);
          }}
        />
      </div>
      <div className="taskmap-calendar-form__range">
        <span className="taskmap-calendar-form__range-label">Starts</span>
        {dateField("Start date", startDate, changeStartDate)}
        {timeField("Start time", startTime, changeStartTime)}
        <span className="taskmap-calendar-form__range-label">Ends</span>
        {dateField("End date", endDate, setEndDate)}
        {timeField("End time", endTime, setEndTime)}
      </div>
      {!ordered && (
        <p role="alert" className="taskmap-calendar-form__error">
          Ends before it starts
        </p>
      )}
      <Field label="Alert">
        <Select
          options={alertOptions}
          value={alertKey(alert)}
          onValueChange={(key) => setAlert(alertFromKey(key, choices))}
        />
      </Field>
      {failed && (
        <p role="alert" className="taskmap-calendar-form__error">
          The event could not be saved. Please try again.
        </p>
      )}
      <ColorSaveFooter
        accent={accent}
        onAccentChange={setAccent}
        canSave={complete}
        onSave={save}
      />
    </div>
  );
}
