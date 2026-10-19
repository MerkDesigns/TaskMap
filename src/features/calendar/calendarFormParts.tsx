import {
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconClock,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { MENU_ACCENT_PRESETS } from "../../constants";
import { isLocalDate, type LocalDate, type LocalTime } from "../../domain/calendar/localDateTime";
import { Button, IconButton } from "../../ui/primitives/Button";
import { TextField } from "../../ui/primitives/FormControls";
import { calendarDayOfLocal } from "./calendarItems";
import "./calendarEditor.css";

/** Character limits of the forms' text fields; the document allows more. */
export const FORM_LIMITS = Object.freeze({ title: 100, location: 100, notes: 300 });

/** A day or time picked in the calendar island, in place of the form that asked for it. */
export type CalendarPick =
  | {
      readonly kind: "date";
      readonly title: string;
      readonly value: LocalDate;
      readonly apply: (date: LocalDate) => void;
    }
  | {
      readonly kind: "time";
      readonly title: string;
      readonly value: LocalTime;
      readonly apply: (time: LocalTime) => void;
    };

const numericDate = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
/** The order of day, month and year in the system's dates, e.g. day-month-year. */
const DATE_ORDER = numericDate
  .formatToParts(new Date(2026, 9, 21))
  .flatMap(({ type }) => (type === "day" || type === "month" || type === "year" ? [type] : []));

const two = (value: number) => String(value).padStart(2, "0");

/** The date as the system writes it with digits, e.g. "21/10/2026". */
export function formatDateText(date: LocalDate): string {
  const { year, month, day } = calendarDayOfLocal(date);
  return numericDate.format(new Date(year, month, day));
}

/** "dd/mm/yyyy", in the system's order and with its separator. */
export const DATE_TEXT_PLACEHOLDER = numericDate
  .formatToParts(new Date(2026, 9, 21))
  .map(({ type, value }) =>
    type === "day" ? "dd" : type === "month" ? "mm" : type === "year" ? "yyyy" : value,
  )
  .join("");

/**
 * A typed date: the system's order ("21/10/2026", "21.10.2026"), without a year for this year
 * ("21/10"), or year first ("2026-10-21"). Null when it is not a real day.
 */
export function parseDateText(text: string, thisYear = new Date().getFullYear()): LocalDate | null {
  const numbers = text
    .trim()
    .split(/[^0-9]+/)
    .filter(Boolean);
  if (numbers.length < 2 || numbers.length > 3) return null;
  let year: number;
  let month: number;
  let day: number;
  if (numbers.length === 3 && numbers[0].length === 4) {
    [year, month, day] = numbers.map(Number);
  } else {
    const order: string[] = DATE_ORDER.filter((part) => numbers.length === 3 || part !== "year");
    const value = (part: string) => Number(numbers[order.indexOf(part)]);
    day = value("day");
    month = value("month");
    year = numbers.length === 3 ? value("year") : thisYear;
    if (numbers.length === 3 && numbers[order.indexOf("year")].length === 2) year += 2000;
  }
  const date = `${String(year).padStart(4, "0")}-${two(month)}-${two(day)}`;
  return isLocalDate(date) ? date : null;
}

/** A typed time: "9", "930", "0930", "9:30", "21.45". Null when it is not a time of day. */
export function parseTimeText(text: string): LocalTime | null {
  const trimmed = text.trim();
  let hours: number;
  let minutes: number;
  const separated = /^(\d{1,2})\s*[:.h ]\s*(\d{1,2})$/.exec(trimmed);
  if (separated) {
    hours = Number(separated[1]);
    minutes = Number(separated[2]);
  } else if (/^\d{1,4}$/.test(trimmed)) {
    const digits = trimmed.length <= 2 ? trimmed : trimmed.padStart(4, "0");
    hours = Number(digits.length <= 2 ? digits : digits.slice(0, 2));
    minutes = digits.length <= 2 ? 0 : Number(digits.slice(2));
  } else {
    return null;
  }
  return hours < 24 && minutes < 60 ? `${two(hours)}:${two(minutes)}` : null;
}

/** Reports the element's height whenever it renders at a new one; never during reveal frames. */
export function useReportedHeight(
  ref: RefObject<HTMLElement | null>,
  onHeightChange: (height: number) => void,
) {
  const reported = useRef(0);
  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 0;
    if (height === reported.current) return;
    reported.current = height;
    onHeightChange(height);
  });
}

/** Focuses the element once, when the form opens, without scrolling the island. */
export function useInitialFocus(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [ref]);
}

export interface CalendarFormHeaderProps {
  readonly titleId: string;
  readonly title: string;
  readonly onBack: () => void;
  readonly onClose?: () => void;
  readonly onDelete?: () => void;
  readonly deleteLabel?: string;
}

/** Back to the month, the form's title, and optionally delete and close. */
export function CalendarFormHeader({
  titleId,
  title,
  onBack,
  onClose,
  onDelete,
  deleteLabel = "Delete",
}: CalendarFormHeaderProps) {
  return (
    <div className="taskmap-calendar-form__header">
      <IconButton
        variant="ghost"
        size="compact"
        aria-label="Back"
        title="Back"
        icon={<IconArrowLeft size={18} stroke={2} />}
        onClick={onBack}
      />
      <h2 id={titleId} className="taskmap-calendar-form__title">
        {title}
      </h2>
      {onDelete && (
        <IconButton
          variant="ghost"
          size="compact"
          aria-label={deleteLabel}
          title={deleteLabel}
          icon={<IconTrash size={17} stroke={2} />}
          onClick={onDelete}
        />
      )}
      {onClose && (
        <IconButton
          variant="ghost"
          size="compact"
          aria-label="Close"
          title="Close"
          icon={<IconX size={17} stroke={2} />}
          onClick={onClose}
        />
      )}
    </div>
  );
}

interface TypedFieldProps<Value extends string> {
  readonly label: string;
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  readonly disabled?: boolean;
  /** Opens the calendar's picker for this field. */
  readonly onPick: () => void;
}

/**
 * A field to type a value into, committed on Enter or on leaving it; text that does not read as a
 * value goes back to the last one. Its icon opens the matching picker.
 */
function TypedField<Value extends string>({
  label,
  value,
  onChange,
  disabled = false,
  onPick,
  format,
  parse,
  placeholder,
  icon,
  className,
}: TypedFieldProps<Value> & {
  readonly format: (value: Value) => string;
  readonly parse: (text: string) => Value | null;
  readonly placeholder: string;
  readonly icon: ReactNode;
  readonly className: string;
}) {
  const [text, setText] = useState(() => format(value));
  const [shownValue, setShownValue] = useState(value);
  // A value chosen in a picker replaces whatever was typed.
  if (shownValue !== value) {
    setShownValue(value);
    setText(format(value));
  }
  const commit = () => {
    const parsed = parse(text);
    if (parsed === null) {
      setText(format(value));
      return;
    }
    setText(format(parsed));
    if (parsed !== value) onChange(parsed);
  };
  return (
    <span className={`taskmap-calendar-form__typed ${className}`}>
      <TextField
        aria-label={label}
        value={disabled ? "" : text}
        placeholder={disabled ? "" : placeholder}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        suffixSlot={
          <IconButton
            variant="ghost"
            size="compact"
            aria-label={`Pick ${label.toLowerCase()}`}
            title={`Pick ${label.toLowerCase()}`}
            disabled={disabled}
            icon={icon}
            onClick={onPick}
          />
        }
      />
    </span>
  );
}

export function DateField(props: TypedFieldProps<LocalDate>) {
  return (
    <TypedField
      {...props}
      format={formatDateText}
      parse={parseDateText}
      placeholder={DATE_TEXT_PLACEHOLDER}
      icon={<IconCalendar size={16} stroke={2} />}
      className="taskmap-calendar-form__typed--date"
    />
  );
}

export function TimeField(props: TypedFieldProps<LocalTime>) {
  return (
    <TypedField
      {...props}
      format={(time) => time}
      parse={parseTimeText}
      placeholder="hh:mm"
      icon={<IconClock size={16} stroke={2} />}
      className="taskmap-calendar-form__typed--time"
    />
  );
}

export interface ColorSaveFooterProps {
  readonly accent: string;
  readonly onAccentChange: (accent: string) => void;
  readonly canSave: boolean;
  readonly onSave: () => void;
}

/** The colour swatches and the Save button at the foot of a form. */
export function ColorSaveFooter({ accent, onAccentChange, canSave, onSave }: ColorSaveFooterProps) {
  return (
    <div className="taskmap-calendar-form__footer">
      <div className="taskmap-calendar-form__swatches" role="radiogroup" aria-label="Color">
        {MENU_ACCENT_PRESETS.map((preset) => (
          <button
            key={preset.accent}
            type="button"
            role="radio"
            aria-checked={accent === preset.accent}
            aria-label={preset.swatch}
            className="taskmap-calendar-form__swatch"
            style={{ background: preset.swatch }}
            onClick={() => onAccentChange(preset.accent)}
          />
        ))}
      </div>
      <Button
        variant="primary"
        size="compact"
        leadingIcon={<IconCheck size={16} stroke={2} />}
        disabled={!canSave}
        onClick={onSave}
      >
        Save
      </Button>
    </div>
  );
}
