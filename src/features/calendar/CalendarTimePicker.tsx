import { IconCheck } from "@tabler/icons-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { LocalTime } from "../../domain/calendar/localDateTime";
import { MaterialSurface } from "../../ui/materials/MaterialSurface";
import { Button } from "../../ui/primitives/Button";
import { CalendarFormHeader, useReportedHeight } from "./calendarFormParts";

/** Rows of a wheel; calendarEditor.css sizes them the same. */
const ROW = 36;
/** The selection band's corners, like the calendar's day highlight. */
const BAND_RADIUS = 10;
/**
 * A wheel event at least this large is one mouse-wheel notch (Windows sends about 100px per notch
 * by default, almost three rows); smaller ones, from a touchpad, add up to a row at a time.
 */
const WHEEL_NOTCH = 50;

const two = (value: number) => String(value).padStart(2, "0");

export interface CalendarTimePickerProps {
  readonly title: string;
  readonly value: LocalTime;
  readonly onSet: (time: LocalTime) => void;
  readonly onBack: () => void;
  readonly onHeightChange: (height: number) => void;
}

/**
 * Hours and minutes as two scrolling wheels, in place of the form that asked. Whatever rests in
 * the middle row, under a fixed glass band, is chosen; the time above follows while scrolling.
 */
export function CalendarTimePicker({
  title,
  value,
  onSet,
  onBack,
  onHeightChange,
}: CalendarTimePickerProps) {
  const [initialHour, initialMinute] = value.split(":").map(Number);
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useReportedHeight(rootRef, onHeightChange);
  const time = `${two(hour)}:${two(minute)}`;

  return (
    <div
      ref={rootRef}
      className="taskmap-calendar-form taskmap-time-picker"
      role="group"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        onBack();
      }}
    >
      <CalendarFormHeader titleId={titleId} title={title} onBack={onBack} />
      <output className="taskmap-time-picker__value" aria-live="polite">
        {time}
      </output>
      <div className="taskmap-time-picker__captions" aria-hidden="true">
        <span>Hours</span>
        <span>Minutes</span>
      </div>
      <div className="taskmap-time-picker__wheels">
        <MaterialSurface
          material="acrylic-small"
          effect="clear-selection"
          elevation="none"
          radius={BAND_RADIUS}
          aria-hidden="true"
          className="taskmap-time-picker__band"
        />
        <TimeWheel label="Hours" count={24} value={hour} onChange={setHour} />
        <span className="taskmap-time-picker__separator" aria-hidden="true">
          :
        </span>
        <TimeWheel label="Minutes" count={60} value={minute} onChange={setMinute} />
      </div>
      <Button
        variant="primary"
        className="taskmap-time-picker__set"
        leadingIcon={<IconCheck size={16} stroke={2} />}
        onClick={() => onSet(time)}
      >
        Set time
      </Button>
    </div>
  );
}

interface TimeWheelProps {
  readonly label: string;
  readonly count: number;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

/** One wheel: rows snap to the middle, and the row resting there is the value. */
function TimeWheel({ label, count, value, onChange }: TimeWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  /** The row a click, key or wheel notch is scrolling to; scroll events on the way are ignored. */
  const targetRef = useRef<number | null>(null);
  const id = useId();

  // Opens on the chosen row; afterwards only scrolling and clicks move the wheel.
  useLayoutEffect(() => {
    if (wheelRef.current) wheelRef.current.scrollTop = valueRef.current * ROW;
  }, []);

  const scrollToRowRef = useRef<(row: number) => void>(() => undefined);
  const scrollToRow = (row: number) => {
    const next = Math.min(count - 1, Math.max(0, row));
    const wheel = wheelRef.current;
    onChange(next);
    if (!wheel) return;
    // Already there (e.g. the first or last row), no scroll event would ever end the target.
    targetRef.current = Math.abs(wheel.scrollTop - next * ROW) < 1 ? null : next;
    wheel.scrollTo({ top: next * ROW, behavior: "smooth" });
  };
  scrollToRowRef.current = scrollToRow;

  // One row per wheel notch, whatever the system's scroll amount; the listener must be able to
  // cancel the native scroll, so it is not passive.
  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    let pending = 0;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta =
        event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? event.deltaY : event.deltaY * ROW;
      const from = targetRef.current ?? valueRef.current;
      if (Math.abs(delta) >= WHEEL_NOTCH) {
        pending = 0;
        scrollToRowRef.current(from + Math.sign(delta));
        return;
      }
      pending += delta;
      if (Math.abs(pending) < ROW) return;
      scrollToRowRef.current(from + Math.sign(pending));
      pending = 0;
    };
    wheel.addEventListener("wheel", handleWheel, { passive: false });
    return () => wheel.removeEventListener("wheel", handleWheel);
  }, []);

  const handleKeyDown = (event: KeyboardEvent) => {
    const step =
      event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowUp"
          ? -1
          : event.key === "PageDown"
            ? 5
            : event.key === "PageUp"
              ? -5
              : 0;
    if (!step) return;
    event.preventDefault();
    scrollToRow((targetRef.current ?? valueRef.current) + step);
  };

  return (
    <div
      ref={wheelRef}
      className="taskmap-time-picker__wheel"
      role="listbox"
      aria-label={label}
      aria-activedescendant={`${id}-${value}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onScroll={(event) => {
        const { scrollTop } = event.currentTarget;
        if (targetRef.current !== null) {
          if (Math.abs(scrollTop - targetRef.current * ROW) < 1) targetRef.current = null;
          return;
        }
        const row = Math.min(count - 1, Math.max(0, Math.round(scrollTop / ROW)));
        if (row !== valueRef.current) onChange(row);
      }}
    >
      {Array.from({ length: count }, (_, row) => (
        <div
          key={row}
          id={`${id}-${row}`}
          role="option"
          aria-selected={row === value}
          className="taskmap-time-picker__row"
          onClick={() => scrollToRow(row)}
        >
          {two(row)}
        </div>
      ))}
    </div>
  );
}
