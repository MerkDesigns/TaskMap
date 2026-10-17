import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCircleDashed,
} from "@tabler/icons-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  supplyMaterialSurfaceSize,
  writeMaterialReveal,
} from "../../ui/materials/materialGeometryInvalidation";
import { useMotionFrameScheduler } from "../../ui/motion/MotionProvider";
import { useReducedMotion } from "../../ui/motion/reducedMotionPreference";
import { useChromeAsleep } from "../../ui/patterns/workspace/chromeSleep";
import { ToolbarGroup } from "../../ui/patterns/workspace/FloatingCanvasToolbar";
import { IconButton } from "../../ui/primitives/Button";
import { ContextMenu } from "../../ui/primitives/ContextMenu";
import { ContextMenuItem } from "../../ui/primitives/ContextMenuParts";
import { LiquidCellIndicator } from "../../ui/primitives/LiquidCellIndicator";
import { useClampedFixedPosition } from "../../useClampedFixedPosition";
import {
  addDays,
  addMonths,
  formatCompactDate,
  formatFullDate,
  formatMonthTitle,
  monthGrid,
  monthOf,
  sameDay,
  sameMonth,
  WEEKDAY_LABELS,
  type CalendarDay,
  type CalendarMonth,
} from "./calendarMonth";
import { CalendarClock, useToday } from "./calendarTime";
import "./calendarIsland.css";

/** Day cells: 36px targets on a 39px pitch, seven across the island's fixed width. */
const CELL = 36;
const PITCH = 39;
/** Today's mark and the selection glass share this rounded-square shape at rest. */
const MARK_RADIUS = 10;
/** Sleep mode's flight out; the island collapses only once it is out of sight. */
const SLEEP_FLIGHT_MS = 320;
/** The island's size, compact and expanded; calendarIsland.css lays out the same. */
const ISLAND_WIDTH = 300;
const COMPACT_HEIGHT = 40;
const EXPANDED_HEIGHT = 348;
/** A full expand or collapse, at the side panel's ease-in-out. */
const REVEAL_MS = 300;
const easeInOutCubic = (progress: number) =>
  progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
const ARROW_STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export interface CalendarIslandProps {
  /** The island is shown; it slides out before unmounting when this turns false. */
  readonly open: boolean;
  readonly radius?: number;
}

/**
 * The calendar beside the toolbar, after the Windows calendar flyout: a compact strip with today's
 * date that expands downward into the month, with a glass highlight gliding to the selected day.
 */
export function CalendarIsland({ open, radius }: CalendarIslandProps) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  if (!mounted) return null;
  return <CalendarIslandSurface open={open} radius={radius} onClosed={() => setMounted(false)} />;
}

function CalendarIslandSurface({
  open,
  radius,
  onClosed,
}: CalendarIslandProps & { readonly onClosed: () => void }) {
  const today = useToday();
  const [expanded, setExpanded] = useState(false);
  // Laid out at the expanded height from the start of an expand until a collapse has finished.
  const [tall, setTall] = useState(false);
  const revealRef = useRef(COMPACT_HEIGHT);
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<CalendarDay>(today);
  const [view, setView] = useState<CalendarMonth>(() => monthOf(today));
  const surfaceRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const focusSelected = useRef(false);
  const asleep = useChromeAsleep();
  const [dayMenu, setDayMenu] = useState<{ readonly left: number; readonly top: number } | null>(
    null,
  );
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const dayMenuRef = useRef<HTMLElement | null>(null);
  const dayMenuReturnFocus = useRef<HTMLElement | null>(null);
  const dayMenuPosition = useClampedFixedPosition(dayMenuRef, dayMenu ?? { left: 0, top: 0 });

  const days = monthGrid(view);
  const selectedIndex = days.findIndex((day) => sameDay(day, selected));
  const todayIndex = days.findIndex((day) => sameDay(day, today));

  useLayoutEffect(() => {
    if (!focusSelected.current) return;
    focusSelected.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>("[aria-pressed='true']")?.focus();
  });

  // The calendar stays compact most of the time: sleep, a click elsewhere and Escape collapse it.
  useEffect(() => {
    if (!asleep) return;
    const timer = window.setTimeout(() => setExpanded(false), SLEEP_FLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [asleep]);
  useEffect(() => {
    // An open day menu takes the outside click and Escape for itself.
    if (!expanded || dayMenuOpen) return;
    const collapseOutside = (event: PointerEvent) => {
      if (!surfaceRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    const collapseOnEscape = (event: globalThis.KeyboardEvent) => {
      // A menu that just closed on this Escape has already claimed it.
      if (event.key === "Escape" && !event.defaultPrevented) setExpanded(false);
    };
    window.addEventListener("pointerdown", collapseOutside, true);
    window.addEventListener("keydown", collapseOnEscape);
    return () => {
      window.removeEventListener("pointerdown", collapseOutside, true);
      window.removeEventListener("keydown", collapseOnEscape);
    };
  }, [dayMenuOpen, expanded]);

  const select = (day: CalendarDay) => {
    setSelected(day);
    if (!sameMonth(monthOf(day), view)) setView(monthOf(day));
  };

  const toggleExpanded = () => {
    if (!expanded) {
      setView(monthOf(selected));
      setTall(true);
    }
    setExpanded(!expanded);
  };

  // Expanding animates how much of the full-height island is revealed rather than its height, so
  // no frame relayouts the island or rebuilds its glass; only the end of a collapse shrinks it.
  // The island supplies its size, so its glass rim is redrawn in the same frame as a height change;
  // an observed size arrives a frame late and the old rim shows stretched over the new height.
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const size = { width: ISLAND_WIDTH, height: tall ? EXPANDED_HEIGHT : COMPACT_HEIGHT };
    supplyMaterialSurfaceSize(surface, size)?.();
  }, [tall]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    if (!tall) {
      revealRef.current = COMPACT_HEIGHT;
      writeMaterialReveal(surface, COMPACT_HEIGHT, COMPACT_HEIGHT);
      return;
    }
    const from = revealRef.current;
    const to = expanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
    const durationMs = reducedMotion
      ? 0
      : (REVEAL_MS * Math.abs(to - from)) / (EXPANDED_HEIGHT - COMPACT_HEIGHT);
    writeMaterialReveal(surface, from, EXPANDED_HEIGHT);
    let elapsedMs = 0;
    return scheduler.subscribe(({ deltaMs }) => {
      elapsedMs += deltaMs;
      const progress = durationMs === 0 ? 1 : Math.min(1, elapsedMs / durationMs);
      revealRef.current = from + (to - from) * easeInOutCubic(progress);
      writeMaterialReveal(surface, revealRef.current, EXPANDED_HEIGHT);
      if (progress < 1) return true;
      if (!expanded) setTall(false);
      return false;
    });
  }, [expanded, reducedMotion, scheduler, tall]);

  const openDayMenu = (event: MouseEvent<HTMLButtonElement>, day: CalendarDay) => {
    event.preventDefault();
    select(day);
    dayMenuReturnFocus.current = event.currentTarget;
    setDayMenu({ left: event.clientX, top: event.clientY });
    setDayMenuOpen(true);
  };

  const handleGridKeyDown = (event: KeyboardEvent) => {
    const step = ARROW_STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    focusSelected.current = true;
    select(addDays(selected, step));
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
        data-tall={tall || undefined}
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
          <div className="taskmap-calendar__month" inert={!expanded}>
            <div className="taskmap-calendar__month-header">
              <IconButton
                variant="ghost"
                size="compact"
                aria-label="Previous month"
                title="Previous month"
                icon={<IconChevronLeft size={18} stroke={2} />}
                onClick={() => setView(addMonths(view, -1))}
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
                onClick={() => setView(addMonths(view, 1))}
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
              {todayIndex >= 0 && (
                <span
                  className="taskmap-calendar__today-mark"
                  style={{ translate: `${cellLeft(todayIndex)}px ${cellTop(todayIndex)}px` }}
                />
              )}
              <LiquidCellIndicator
                x={cellLeft(Math.max(0, selectedIndex)) + CELL / 2}
                y={cellTop(Math.max(0, selectedIndex)) + CELL / 2}
                size={CELL}
                settledRadius={MARK_RADIUS}
                visible={expanded && selectedIndex >= 0}
                rigid
                clear
              />
              {days.map((day, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={`${day.year}-${day.month}-${day.day}`}
                    type="button"
                    className="taskmap-calendar__day"
                    data-outside={!day.inMonth || undefined}
                    data-today={index === todayIndex || undefined}
                    aria-pressed={isSelected}
                    aria-current={index === todayIndex ? "date" : undefined}
                    aria-label={formatFullDate(day)}
                    tabIndex={isSelected || (selectedIndex < 0 && index === 0) ? 0 : -1}
                    style={{ translate: `${cellLeft(index)}px ${cellTop(index)}px` }}
                    onClick={() => select(day)}
                    onContextMenu={(event) => openDayMenu(event, day)}
                  >
                    {day.day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </ToolbarGroup>
      {dayMenu && (
        <ContextMenu
          ref={dayMenuRef}
          portal
          label={formatFullDate(selected)}
          open={dayMenuOpen}
          onOpenChange={setDayMenuOpen}
          position={dayMenuPosition}
          returnFocusRef={dayMenuReturnFocus}
        >
          {/* Reminders and calendar extensions will fill this menu. */}
          <ContextMenuItem
            icon={<IconCircleDashed size={17} stroke={2} />}
            onClick={() => setDayMenuOpen(false)}
          >
            Placeholder
          </ContextMenuItem>
        </ContextMenu>
      )}
    </>
  );
}

function cellLeft(index: number): number {
  return (index % 7) * PITCH + (PITCH - CELL) / 2;
}

function cellTop(index: number): number {
  return Math.floor(index / 7) * PITCH + (PITCH - CELL) / 2;
}
