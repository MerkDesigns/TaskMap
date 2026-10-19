import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { LocalDate } from "../../domain/calendar/localDateTime";
import { useReducedMotion } from "../../ui/motion/reducedMotionPreference";
import { IconButton } from "../../ui/primitives/Button";
import { LiquidCellIndicator } from "../../ui/primitives/LiquidCellIndicator";
import { localDateOf } from "./calendarItems";
import {
  addDays,
  addMonths,
  calendarWeekOf,
  daysOfWeeks,
  formatFullDate,
  formatMonthTitle,
  monthGrid,
  sameDay,
  WEEKDAY_LABELS,
  type CalendarDay,
  type CalendarMonth,
} from "./calendarMonth";

/** Day cells: 36px targets on a 39px pitch, seven across the island's fixed width. */
const CELL = 36;
const PITCH = 39;
/** Six weeks show any month. */
const GRID_WEEKS = 6;
/** Months further apart than this jump instead of scrolling past every week in between. */
const MAX_SCROLL_WEEKS = 14;
/** Today's mark and the selection glass share this rounded-square shape at rest. */
const MARK_RADIUS = 10;
const ARROW_STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export interface CalendarMonthGridProps {
  readonly today: CalendarDay;
  readonly selected: CalendarDay;
  readonly view: CalendarMonth;
  /** Days with something on them get a dot. */
  readonly marked: ReadonlySet<LocalDate>;
  readonly onViewChange: (view: CalendarMonth) => void;
  /** The arrow keys moved the selection. */
  readonly onSelect: (day: CalendarDay) => void;
  readonly onDayClick: (day: CalendarDay) => void;
  readonly onDayContextMenu?: (event: MouseEvent<HTMLButtonElement>, day: CalendarDay) => void;
}

/**
 * The month: its title with arrows, the weekdays and the grid of days. The grid is one continuous
 * list of weeks: switching months scrolls it to the month's first week, rendering both months'
 * rows until the scroll has settled, with a glass highlight gliding to the selected day.
 */
export function CalendarMonthGrid({
  today,
  selected,
  view,
  marked,
  onViewChange,
  onSelect,
  onDayClick,
  onDayContextMenu,
}: CalendarMonthGridProps) {
  const reducedMotion = useReducedMotion();
  const gridRef = useRef<HTMLDivElement>(null);
  const focusSelected = useRef(false);
  const viewWeek = calendarWeekOf(monthGrid(view)[0]);
  const [settledWeek, setSettledWeek] = useState(viewWeek);
  const instant = reducedMotion || Math.abs(viewWeek - settledWeek) > MAX_SCROLL_WEEKS;
  if (instant && settledWeek !== viewWeek) setSettledWeek(viewWeek);
  const firstWeek = Math.min(settledWeek, viewWeek);
  const days = daysOfWeeks(firstWeek, Math.max(settledWeek, viewWeek) + GRID_WEEKS - 1);
  const inView = (week: number) => week >= viewWeek && week < viewWeek + GRID_WEEKS;
  const selectedShown = days.some((day) => sameDay(day, selected) && inView(day.week));
  const todayCell = days.find((day) => sameDay(day, today));
  const selectedWeek = calendarWeekOf(selected);
  const selectedColumn = (new Date(selected.year, selected.month, selected.day).getDay() + 6) % 7;

  useLayoutEffect(() => {
    if (!focusSelected.current) return;
    focusSelected.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>("[aria-pressed='true']")?.focus();
  });

  const handleGridKeyDown = (event: KeyboardEvent) => {
    const step = ARROW_STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    focusSelected.current = true;
    onSelect(addDays(selected, step));
  };

  return (
    <>
      <div className="taskmap-calendar__month-header">
        <IconButton
          variant="ghost"
          size="compact"
          aria-label="Previous month"
          title="Previous month"
          icon={<IconChevronLeft size={18} stroke={2} />}
          onClick={() => onViewChange(addMonths(view, -1))}
        />
        <span className="taskmap-calendar__month-title" aria-live="polite">
          {formatMonthTitle(view)}
        </span>
        <IconButton
          variant="ghost"
          size="compact"
          aria-label="Next month"
          title="Next month"
          icon={<IconChevronRight size={18} stroke={2} />}
          onClick={() => onViewChange(addMonths(view, 1))}
        />
      </div>
      <div className="taskmap-calendar__weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div
        ref={gridRef}
        className="taskmap-calendar__grid"
        role="group"
        aria-label={formatMonthTitle(view)}
        onKeyDown={handleGridKeyDown}
      >
        <div
          className="taskmap-calendar__weeks"
          data-instant={instant || undefined}
          style={{ transform: `translate3d(0, ${-viewWeek * PITCH}px, 0)` }}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget) setSettledWeek(viewWeek);
          }}
        >
          {todayCell && (
            <span
              className="taskmap-calendar__today-mark"
              style={{
                translate: `${cellLeft(todayCell.column)}px ${cellTop(todayCell.week)}px`,
              }}
            />
          )}
          {/* Always shown: away from the month on screen it simply scrolls out of view. */}
          <LiquidCellIndicator
            x={cellLeft(selectedColumn) + CELL / 2}
            y={cellTop(selectedWeek) + CELL / 2}
            size={CELL}
            settledRadius={MARK_RADIUS}
            rigid
            clear
          />
          {days.map((day, index) => {
            const isSelected = sameDay(day, selected);
            const isToday = sameDay(day, today);
            return (
              <button
                key={`${day.year}-${day.month}-${day.day}`}
                type="button"
                className="taskmap-calendar__day"
                data-outside={day.month !== view.month || undefined}
                data-today={isToday || undefined}
                data-marked={marked.has(localDateOf(day)) || undefined}
                aria-hidden={!inView(day.week) || undefined}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                aria-label={formatFullDate(day)}
                tabIndex={
                  (isSelected && selectedShown) ||
                  (!selectedShown && index === (viewWeek - firstWeek) * 7)
                    ? 0
                    : -1
                }
                style={{ translate: `${cellLeft(day.column)}px ${cellTop(day.week)}px` }}
                onClick={() => onDayClick(day)}
                onContextMenu={(event) => onDayContextMenu?.(event, day)}
              >
                {day.day}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function cellLeft(column: number): number {
  return column * PITCH + (PITCH - CELL) / 2;
}

/** Rows sit at their week's place in the continuous list; the weeks layer scrolls past them. */
function cellTop(week: number): number {
  return week * PITCH + (PITCH - CELL) / 2;
}
