import { useEffect, useState } from "react";
import { calendarDayOf, formatClockTime, sameDay, type CalendarDay } from "./calendarMonth";

/** The time in the strip; it alone re-renders each minute, never the month. */
export function CalendarClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const current = new Date();
      setNow(current);
      window.clearTimeout(timer);
      // Just past the next minute, so a timer firing early never shows the old minute.
      timer = window.setTimeout(tick, 60_000 - (current.getTime() % 60_000) + 50);
    };
    tick();
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return (
    <time className="taskmap-calendar__clock" dateTime={now.toISOString()}>
      {formatClockTime(now)}
    </time>
  );
}

/** Today's date, turning over at midnight and rechecked whenever the window comes back. */
export function useToday(): CalendarDay {
  const [today, setToday] = useState(() => calendarDayOf(new Date()));
  useEffect(() => {
    let timer = 0;
    const refresh = () => {
      const now = new Date();
      setToday((current) => {
        const next = calendarDayOf(now);
        return sameDay(current, next) ? current : next;
      });
      window.clearTimeout(timer);
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      // A second past midnight, so a timer firing early never lands on the old day.
      timer = window.setTimeout(refresh, midnight.getTime() - now.getTime() + 1000);
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}
