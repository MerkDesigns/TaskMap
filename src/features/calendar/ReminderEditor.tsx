import { IconCalendar, IconClock } from "@tabler/icons-react";
import { useId, useRef, useState } from "react";
import type { Reminder } from "../../domain/calendar/calendarSchema";
import type { LocalDate } from "../../domain/calendar/localDateTime";
import { Field } from "../../ui/primitives/Field";
import { Select, TextArea, TextField } from "../../ui/primitives/FormControls";
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

export interface ReminderEditorProps {
  readonly editing: Extract<CalendarEditing, { kind: "reminder" }>;
  readonly onSave: (reminder: Reminder) => void;
  readonly onDelete: () => void;
  /** Back to the month, keeping the calendar open. */
  readonly onBack: () => void;
  /** Leaves the reminder and closes the calendar. */
  readonly onClose: () => void;
  /** Asks the calendar to pick a day or time in place of the form. */
  readonly onPick: (pick: CalendarPick) => void;
  /** The form's height, whenever it changes, so the calendar can grow to fit it. */
  readonly onHeightChange: (height: number) => void;
}

/**
 * Creates or edits one reminder inside the calendar island, in place of the month: a title, notes
 * or a link, an optional day and time with an early alert, and a colour.
 */
export function ReminderEditor({
  editing,
  onSave,
  onDelete,
  onBack,
  onClose,
  onPick,
  onHeightChange,
}: ReminderEditorProps) {
  const { reminder: initial, isNew, fallbackDate, failed } = editing;
  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  const [accent, setAccent] = useState(initial.accent);
  const [hasDate, setHasDate] = useState(initial.due !== null);
  const [date, setDate] = useState<LocalDate>(initial.due?.date ?? fallbackDate);
  const [hasTime, setHasTime] = useState(initial.due?.time != null);
  const [time, setTime] = useState(initial.due?.time ?? "09:00");
  const [alert, setAlert] = useState(initial.alert);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  useInitialFocus(titleRef);
  useReportedHeight(rootRef, onHeightChange);

  const complete = title.trim().length > 0;
  const choices = hasTime ? TIMED_ALERTS : ALL_DAY_ALERTS;
  const alertOptions = [
    { value: "none", label: "None" },
    ...choices.map(({ label, offset }) => ({ value: alertKey(offset), label })),
  ];
  const save = () => {
    if (!complete) return;
    onSave({
      ...initial,
      title: title.trim(),
      notes,
      accent,
      due: hasDate ? { date, time: hasTime ? time : null } : null,
      alert: hasDate ? alert : null,
    });
  };

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
        title={isNew ? "New reminder" : "Edit reminder"}
        onBack={onBack}
        onClose={onClose}
        onDelete={isNew ? undefined : onDelete}
        deleteLabel="Delete reminder"
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
      <Field label="Notes / URL">
        <TextArea
          className="taskmap-calendar-form__notes"
          value={notes}
          rows={2}
          maxLength={FORM_LIMITS.notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
      <div className="taskmap-calendar-form__when">
        <span className="taskmap-calendar-form__when-label" aria-hidden="true">
          <IconCalendar size={18} stroke={2} />
          Date
        </span>
        <Switch
          aria-label="Date"
          checked={hasDate}
          onChange={(event) => {
            setHasDate(event.target.checked);
            if (!event.target.checked) setAlert(null);
          }}
        />
        <DateField
          label="Day"
          value={date}
          onChange={setDate}
          disabled={!hasDate}
          onPick={() =>
            onPick({ kind: "date", title: "Choose a day", value: date, apply: setDate })
          }
        />
        <span className="taskmap-calendar-form__when-label" aria-hidden="true">
          <IconClock size={18} stroke={2} />
          Time
        </span>
        <Switch
          aria-label="Time"
          disabled={!hasDate}
          checked={hasDate && hasTime}
          onChange={(event) => {
            setHasTime(event.target.checked);
            setAlert(null);
          }}
        />
        <TimeField
          label="Time of day"
          value={time}
          onChange={setTime}
          disabled={!hasDate || !hasTime}
          onPick={() =>
            onPick({ kind: "time", title: "Choose a time", value: time, apply: setTime })
          }
        />
      </div>
      <Field label="Alert">
        <Select
          disabled={!hasDate}
          options={alertOptions}
          value={alertKey(alert)}
          onValueChange={(key) => setAlert(alertFromKey(key, choices))}
        />
      </Field>
      {failed && (
        <p role="alert" className="taskmap-calendar-form__error">
          The reminder could not be saved. Please try again.
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
